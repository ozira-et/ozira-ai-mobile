// Mobile adapter for the canonical OZIRA Persistent Run contract.
//
// The local mapping is only a lookup hint that survives an app restart. The
// server response remains authoritative for state, version, ownership and
// file-reference visibility.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const STORAGE_KEY = 'ozira_persistent_run_links_v1';
let cache = null;

async function load(ownerId) {
  const owner = String(ownerId || '');
  if (!owner) throw Object.assign(new Error('Authenticated user is required.'), { code: 'AUTH_REQUIRED', status: 401 });
  if (!cache) {
    try { cache = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || 'null'); } catch (_) { cache = null; }
  }
  if (!cache || cache.ownerId !== owner) {
    cache = { ownerId: owner, runs: {} };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  if (!cache.runs || typeof cache.runs !== 'object') cache.runs = {};
  return cache;
}

async function save() {
  if (cache) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

function key(conversationId) { return String(conversationId || ''); }
function metadataReference(attachment) {
  if (!attachment) return null;
  return {
    kind: attachment.kind || 'file',
    name: String(attachment.name || 'file').slice(0, 240),
    mimeType: String(attachment.mimeType || 'application/octet-stream').slice(0, 120),
  };
}

function mergeFileReferences(existing, attachment) {
  const refs = Array.isArray(existing) ? existing.slice() : [];
  const next = metadataReference(attachment);
  if (!next) return refs;
  const fingerprint = `${next.kind}:${next.name}:${next.mimeType}`;
  if (!refs.some(ref => `${ref.kind}:${ref.name}:${ref.mimeType}` === fingerprint)) refs.push(next);
  return refs.slice(0, 200);
}

export async function createOrResolveRun({ ownerId, conversationId, objective, token, fileReference } = {}) {
  const state = await load(ownerId);
  const conversationKey = key(conversationId);
  if (!conversationKey) throw Object.assign(new Error('Conversation is required.'), { code: 'VALIDATION', status: 400 });
  const cached = state.runs[conversationKey];
  if (cached?.runId) {
    try {
      const current = await getPersistentRun({ ownerId, conversationId, token });
      return current;
    } catch (error) {
      if (error.code !== 'NOT_FOUND') throw error;
      delete state.runs[conversationKey];
      await save();
    }
  }
  // A fresh device may have no local link at all. Resolve the server-owned
  // run before creating anything so a conversation cannot fork merely because
  // the user opened it on another client first. The stable create idempotency
  // key remains the final safety net if discovery is temporarily unavailable.
  const discovered = await getPersistentRun({ ownerId, conversationId: conversationKey, token });
  if (discovered) return discovered;
  const idempotencyKey = `mobile:${conversationKey}`.slice(0, 160);
  const response = await api.createRun({
    conversationId: conversationKey,
    objective: String(objective || 'Assistant task').slice(0, 2000),
    idempotencyKey,
    fileReferences: mergeFileReferences([], fileReference),
  }, token);
  const run = response.run;
  if (!run?.runId) throw Object.assign(new Error('The server did not return a Persistent Run.'), { code: 'UNKNOWN', status: 502 });
  state.runs[conversationKey] = { runId: run.runId };
  await save();
  return run;
}

export async function getPersistentRun({ ownerId, conversationId, token } = {}) {
  const state = await load(ownerId);
  const conversationKey = key(conversationId);
  if (!conversationKey) return null;

  // The server is authoritative. The local mapping is only a compatibility
  // cache for offline/older-server cases and is refreshed from discovery.
  try {
    const discovered = await api.discoverRun(conversationKey, token);
    if (discovered?.run?.runId) {
      state.runs[conversationKey] = { runId: discovered.run.runId };
      await save();
      return discovered.run;
    }
  } catch (_) {
    // Preserve the existing offline behavior by falling through to the local
    // hint when the discovery endpoint is unreachable.
  }
  const entry = state.runs[conversationKey];
  if (!entry?.runId) return null;
  try {
    const response = await api.getRun(entry.runId, token);
    return response.run || null;
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      delete state.runs[conversationKey];
      await save();
      return null;
    }
    throw error;
  }
}

export async function resumePersistentRun({ ownerId, conversationId, token } = {}) {
  const run = await getPersistentRun({ ownerId, conversationId, token });
  if (!run?.runId) return null;
  const response = await api.resumeRun(run.runId, token);
  return response.run || null;
}

export async function updatePersistentRun({ ownerId, conversationId, token, patch = {}, retryConflict = true } = {}) {
  const state = await load(ownerId);
  const entry = state.runs[key(conversationId)];
  if (!entry?.runId) return null;
  const send = version => api.updateRun(entry.runId, { ...patch, stateVersion: version }, token);
  try {
    const response = await send(Number(patch.stateVersion));
    return response.run || null;
  } catch (error) {
    if (!retryConflict || error.code !== 'VERSION_CONFLICT') throw error;
    // Re-read canonical state and retry once with its current version. This
    // never writes the stale state over the newer server state.
    const current = await getPersistentRun({ ownerId, conversationId, token });
    if (!current) throw error;
    const response = await send(Number(current.stateVersion));
    return response.run || null;
  }
}

export async function clearPersistentRunCache() {
  cache = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export { metadataReference, mergeFileReferences };
