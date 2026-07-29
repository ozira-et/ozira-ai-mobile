// Chat history and folders live on the account, not on the device, so the same
// chats appear in the mobile app and on the web. This file keeps the API it had
// when everything was local — the screens call exactly the same functions — but
// the conversation and folder ones now go through the server.
//
// The on-device file is still written on every successful call, demoted from
// source of truth to a read cache: with no network the app shows the last known
// list instead of an empty screen. Theme, settings and profile stay purely
// local; they are device preferences, not account data.
import { Paths, File } from 'expo-file-system';
import { api } from './api';

let cache = null;
function file() { return new File(Paths.document, 'ozira-store.json'); }

async function load() {
  if (cache) return cache;
  try {
    const f = file();
    if (f.exists) { const t = await f.text(); cache = t ? JSON.parse(t) : null; }
  } catch (_) {}
  if (!cache) cache = { conversations: {}, order: [], folders: [] };
  if (!cache.conversations) cache.conversations = {};
  if (!cache.order) cache.order = [];
  if (!cache.folders) cache.folders = [];
  if (!cache.idMap) cache.idMap = {};
  return cache;
}

async function persist() {
  try {
    const f = file();
    if (!f.exists) { try { f.create(); } catch (_) {} }
    await Promise.resolve(f.write(JSON.stringify(cache)));
  } catch (_) {}
}

export function newId() { return 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

// A chat gets a local id the moment it is opened, before the server has ever
// seen it. The first save returns the server's id; this map ties the two
// together so screens can keep using the id they already hold.
async function serverId(localId) {
  const s = await load();
  return s.idMap[localId] || localId;
}
async function linkId(localId, remoteId) {
  if (!localId || !remoteId || localId === remoteId) return;
  const s = await load();
  s.idMap[localId] = remoteId;
  await persist();
}

// Mirror a server conversation into the cache so it survives going offline.
async function cacheConv(c) {
  if (!c || !c.id) return c;
  const s = await load();
  s.conversations[c.id] = { ...(s.conversations[c.id] || {}), ...c };
  s.order = [c.id, ...s.order.filter(x => x !== c.id)];
  await persist();
  return c;
}

// Chats that already existed on this phone were never on the account. Reading
// the list from the server would make them look deleted, so they are uploaded
// once, the first time a signed-in list succeeds. The flag is only set after
// the upload works, so a failure here retries rather than losing anything.
async function ensureMigrated() {
  const s = await load();
  if (s.migratedToAccount) return;
  const local = Object.values(s.conversations)
    .filter(c => c && c.id && Array.isArray(c.messages) && c.messages.length && !s.idMap[c.id]);
  for (const c of local) {
    try {
      const d = await api.saveConversation({ title: c.title, messages: c.messages });
      if (d && d.id) {
        s.idMap[c.id] = d.id;
        if (c.pinned || c.archived) { try { await api.conversationMeta(d.id, { pinned: !!c.pinned, archived: !!c.archived }); } catch (_) {} }
      }
    } catch (e) { return; }   // network trouble: leave the flag unset and retry later
  }
  s.migratedToAccount = true;
  await persist();
}
let migrationInFlight = null;
function migrateInBackground() {
  if (!migrationInFlight) {
    migrationInFlight = ensureMigrated().finally(() => { migrationInFlight = null; });
  }
  return migrationInFlight;
}

export async function listConversations(folderId, opts = {}) {
  try {
    // Migration can involve many old local chats and used to block the entire
    // history screen. It is safe to let it finish in the background.
    migrateInBackground().catch(() => {});
    const d = await api.conversations(opts.archived ? '__archived' : folderId);
    const list = (d.conversations || []).map(c => ({
      id: c.id, title: c.title, folderId: c.folderId || null,
      pinned: !!c.pinned, archived: !!c.archived, count: c.count,
    }));
    const s = await load();
    list.forEach(c => { s.conversations[c.id] = { ...(s.conversations[c.id] || {}), ...c }; });
    s.order = [...list.map(c => c.id), ...s.order.filter(id => !list.some(c => c.id === id))];
    await persist();
    return list;
  } catch (_) {
    // Offline: fall back to whatever was last seen.
    const s = await load();
    let ids = s.order;
    if (folderId) ids = ids.filter(id => s.conversations[id] && s.conversations[id].folderId === folderId);
    let list = ids.map(id => s.conversations[id]).filter(Boolean);
    list = opts.archived ? list.filter(c => c.archived) : list.filter(c => !c.archived);
    return [...list.filter(c => c.pinned), ...list.filter(c => !c.pinned)];
  }
}

// Update flags on a conversation (pinned, archived, ...).
export async function setConversationMeta(id, patch) {
  const s = await load();
  const rid = await serverId(id);
  if (s.conversations[id]) Object.assign(s.conversations[id], patch);
  if (s.conversations[rid]) Object.assign(s.conversations[rid], patch);
  await persist();
  try { await api.conversationMeta(rid, patch); } catch (_) {}
}

// Read the on-device copy without touching the network. Chat screens use this
// first so a conversation opens immediately, then refresh from the account.
export async function getCachedConversation(id) {
  const rid = await serverId(id);
  const s = await load();
  return s.conversations[rid] || s.conversations[id] || null;
}

export async function getConversation(id) {
  const rid = await serverId(id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const d = await api.getConversation(rid, undefined, controller.signal);
    const c = d.conversation;
    if (c) { await cacheConv({ id: c.id, title: c.title, messages: c.messages || [], folderId: c.folderId || null, pinned: !!c.pinned, archived: !!c.archived }); }
    return c ? { ...c, id: c.id } : null;
  } catch (_) {
    return getCachedConversation(id);
  } finally {
    clearTimeout(timer);
  }
}

export async function saveConversation(conv) {
  const s = await load();
  if (s.settings && s.settings.saveHistory === false) return; // history saving turned off
  const now = Date.now();
  const existing = s.conversations[conv.id];
  s.conversations[conv.id] = {
    folderId: null,
    ...(existing || {}),
    ...conv,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  s.order = [conv.id, ...s.order.filter(x => x !== conv.id)];
  await persist();
  try {
    const rid = await serverId(conv.id);
    const d = await api.saveConversation({
      id: rid === conv.id && !s.idMap[conv.id] ? undefined : rid,
      title: conv.title,
      messages: conv.messages || [],
    });
    if (d && d.id) await linkId(conv.id, d.id);
  } catch (_) { /* stays in the cache; the next save retries */ }
}

export async function deleteConversation(id) {
  const s = await load();
  const rid = await serverId(id);
  delete s.conversations[id];
  delete s.conversations[rid];
  delete s.idMap[id];
  s.order = s.order.filter(x => x !== id && x !== rid);
  await persist();
  try { await api.deleteConversation(rid); } catch (_) {}
}

export async function listFolders() {
  try {
    const d = await api.folders();
    const s = await load();
    s.folders = (d.folders || []).map(f => ({ id: f.id, name: f.name }));
    await persist();
    return s.folders.slice();
  } catch (_) {
    const s = await load();
    return s.folders.slice();
  }
}

export async function createFolder(name) {
  const d = await api.createFolder(String(name).slice(0, 40));
  const f = d.folder;
  const s = await load();
  s.folders.push(f);
  await persist();
  return f;
}

export async function deleteFolder(id) {
  const s = await load();
  s.folders = s.folders.filter(f => f.id !== id);
  Object.values(s.conversations).forEach(c => { if (c.folderId === id) c.folderId = null; });
  await persist();
  try { await api.deleteFolder(id); } catch (_) {}
}

export async function setConversationFolder(id, folderId) {
  return setConversationMeta(id, { folderId: folderId || null });
}

// --- app preferences (device-local on purpose) ---
export async function getTheme() {
  const s = await load();
  return s.theme || 'dark';
}
export async function setTheme(mode) {
  const s = await load();
  s.theme = mode;
  await persist();
}

// --- app settings ---
export async function getSettings() {
  const s = await load();
  return s.settings || {};
}
export async function setSettings(patch) {
  const s = await load();
  s.settings = { ...(s.settings || {}), ...patch };
  await persist();
  return s.settings;
}
export async function purgeAllHistory() {
  const s = await load();
  const ids = Object.keys(s.conversations);
  s.conversations = {};
  s.order = [];
  s.idMap = {};
  await persist();
  // Clear the account copy too, or they would reappear on the next refresh.
  for (const cid of ids) { try { await api.deleteConversation(cid); } catch (_) {} }
}

// --- profile / personalization ---
export async function getProfile() {
  const s = await load();
  return s.profile || {};
}
export async function setProfile(patch) {
  const s = await load();
  s.profile = { ...(s.profile || {}), ...patch };
  await persist();
  return s.profile;
}
