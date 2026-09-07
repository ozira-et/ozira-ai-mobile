// Mobile adapter for the canonical OZIRA Persistent Run contract.
//
// The local mapping is only a lookup hint that survives an app restart. The
// server response remains authoritative for state, version, ownership and
// file-reference visibility.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { config } from './config';
import { captureAccountSession, assertCurrentAccount } from './accountSession';

const STORAGE_KEY = 'ozira_persistent_run_links_v1';
const states = new Map();
const scopes = new WeakMap();
const environment = config.SUPABASE_URL || config.API_BASE;
const storageKey = owner => STORAGE_KEY + ':' + encodeURIComponent(environment) + ':' + encodeURIComponent(owner);

async function load(ownerId) {
  const owner = String(ownerId || '');
  if (!owner) throw Object.assign(new Error('Authenticated user is required.'), { code: 'AUTH_REQUIRED', status: 401 });
  const scope = captureAccountSession();
  assertCurrentAccount(scope);
  if (scope.ownerId !== owner) throw Object.assign(new Error('Run owner does not match session.'), { code: 'ACCOUNT_SESSION_CHANGED', status: 401 });
  for (const generation of states.keys()) if (generation !== scope.generation) states.delete(generation);
  if (!states.has(scope.generation)) states.set(scope.generation, (async () => {
    let state;
    try { state = JSON.parse(await AsyncStorage.getItem(storageKey(owner))); } catch (_) {}
    assertCurrentAccount(scope);
    if (!state || state.ownerId !== owner || state.environment !== environment) {
      let legacy;
      try { legacy = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY)); } catch (_) {}
      assertCurrentAccount(scope);
      // v1 contains explicit ownership, but only hints; every use still reads the server.
      state = { ownerId: owner, environment, runs: legacy?.ownerId === owner ? legacy.runs || {} : {} };
    }
    if (!state.runs || typeof state.runs !== 'object') state.runs = {};
    scopes.set(state, scope);
    return state;
  })());
  const state = await states.get(scope.generation);
  assertCurrentAccount(scope);
  return state;
}

async function save(state) {
  assertCurrentAccount(scopes.get(state));
  await AsyncStorage.setItem(storageKey(state.ownerId), JSON.stringify(state));
  assertCurrentAccount(scopes.get(state));
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
  // A fresh device may have no local link at all. Resolve the server-owned
  // run before creating anything so a conversation cannot fork merely because
  // the user opened it on another client first. The stable create idempotency
  // key remains the final safety net for concurrent creates after a successful
  // empty discovery. Failed discovery must not authorize a new run.
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
  await save(state);
  return run;
}

export async function getPersistentRun({ ownerId, conversationId, token } = {}) {
  const state = await load(ownerId);
  const conversationKey = key(conversationId);
  if (!conversationKey) return null;

  // The server is authoritative. The local mapping is only a compatibility
  // cache for offline/older-server cases and is refreshed from discovery.
  let discoveryError = null;
  try {
    const discovered = await api.discoverRun(conversationKey, token);
    if (discovered?.run?.runId) {
      state.runs[conversationKey] = { runId: discovered.run.runId };
      await save(state);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.info('[OZIRA Phase1B] server run discovery', {
          conversationId: conversationKey,
          runId: discovered.run.runId,
          stateVersion: Number(discovered.run.stateVersion),
        });
      }
      return discovered.run;
    }
    if (discovered?.run !== null) {
      throw Object.assign(new Error('The server returned an invalid run discovery result.'), {
        code: 'RUN_DISCOVERY_INVALID', status: 502,
      });
    }
  } catch (error) {
    if (error.status === 401 || error.status === 403) throw error;
    // A hint can still be verified by an authenticated get, but a failed
    // discovery is not an authoritative absence result.
    discoveryError = error;
  }
  const entry = state.runs[conversationKey];
  if (!entry?.runId) {
    if (discoveryError) throw discoveryError;
    return null;
  }
  try {
    const response = await api.getRun(entry.runId, token);
    if (!response.run && discoveryError) throw discoveryError;
    return response.run || null;
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      if (discoveryError) throw discoveryError;
      delete state.runs[conversationKey];
      await save(state);
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

export async function updatePersistentRun({ ownerId, conversationId, token, patch = {} } = {}) {
  const state = await load(ownerId);
  const entry = state.runs[key(conversationId)];
  if (!entry?.runId) return null;
  const send = version => api.updateRun(entry.runId, { ...patch, stateVersion: version }, token);
  try {
    const response = await send(Number(patch.stateVersion));
    return response.run || null;
  } catch (error) {
    if (error.code !== 'VERSION_CONFLICT') throw error;
    // Refresh for explicit reconciliation, never replay the rejected patch.
    // Preserve the original 409 even if the follow-up read fails.
    try {
      error.currentRun = await getPersistentRun({ ownerId, conversationId, token });
    } catch (_) { /* The caller must still see the original conflict. */ }
    throw error;
  }
}

export async function clearPersistentRunCache() {
  const scope = captureAccountSession();
  assertCurrentAccount(scope);
  states.delete(scope.generation);
  await AsyncStorage.removeItem(storageKey(scope.ownerId));
}

export { metadataReference, mergeFileReferences };
