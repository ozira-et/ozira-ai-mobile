// Owner-scoped read caches; unknown legacy data remains quarantined in place.
import { Paths, File } from 'expo-file-system';
import { api as transport } from './api';
import { config } from './config';
import { captureAccountSession, assertCurrentAccount, isAccountSnapshot } from './accountSession';
const environment = config.SUPABASE_URL || config.API_BASE;
const stores = new Map();
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
async function readFile(name) {
  try { const f = new File(Paths.document, name); return f.exists ? JSON.parse(await f.text()) : null; } catch (_) { return null; }
}
async function writeFile(name, value) {
  const f = new File(Paths.document, name);
  if (!f.exists) f.create();
  await Promise.resolve(f.write(JSON.stringify(value)));
}
const preferenceFile = 'ozira-device-preferences-v2.json';
let preferences;
async function devicePreferences() {
  if (!preferences) {
    const saved = await readFile(preferenceFile);
    const legacy = saved ? null : await readFile('ozira-store.json');
    preferences = saved || { theme: legacy?.theme || 'dark' };
  }
  return preferences;
}
export async function getTheme() { return (await devicePreferences()).theme || 'dark'; }
export async function setTheme(theme) { const p = await devicePreferences(); p.theme = theme; await writeFile(preferenceFile, p); }
export function newId() { return 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

function createStore(scope) {
  let cache = null;
  let loading = null;
  const filename = 'ozira-account-v2-' + encodeURIComponent(environment) + '-' + encodeURIComponent(scope.ownerId) + '.json';
  const tokenPositions = { conversations: 1, searchConversations: 1, getConversation: 1, saveConversation: 1,
    deleteConversation: 1, conversationMeta: 2, folders: 0, createFolder: 1, deleteFolder: 1,
    saveBookmark: 2, unsaveBookmark: 2, listBookmarks: 1 };
  const api = Object.fromEntries(Object.entries(tokenPositions).map(([name, position]) => [name, async (...args) => {
    assertCurrentAccount(scope);
    args[position] = captureAccountSession().token; // same owner/generation, including normal token refresh
    const result = await transport[name](...args);
    assertCurrentAccount(scope);
    return result;
  }]));
  async function load() {
    assertCurrentAccount(scope);
    if (!loading) loading = (async () => {
      let saved = await readFile(filename);
      assertCurrentAccount(scope);
      if (new File(Paths.document, filename).exists && (!saved || saved.ownerId !== scope.ownerId || saved.environment !== environment)) {
        throw Object.assign(new Error('Cached account ownership cannot be verified.'), { code: 'CACHE_OWNERSHIP_MISMATCH' });
      }
      if (!saved || saved.ownerId !== scope.ownerId || saved.environment !== environment) {
        const legacy = await readFile('ozira-store.json');
        assertCurrentAccount(scope);
        // A profile marker or migration flag does not prove ownership of chats.
        saved = legacy?.ownerId === scope.ownerId && legacy?.environment === environment ? clone(legacy) : {};
      }
      cache = { ...saved, schemaVersion: 2, ownerId: scope.ownerId, environment,
        conversations: saved.conversations || {}, order: saved.order || [], folders: saved.folders || [], idMap: saved.idMap || {} };
      for (const [id, conversation] of Object.entries(cache.conversations)) {
        if (conversation?.ownerId && conversation.ownerId !== scope.ownerId) {
          cache.quarantinedConversations = { ...(cache.quarantinedConversations || {}), [id]: conversation };
          delete cache.conversations[id];
        }
      }
      return cache;
    })();
    const result = await loading;
    assertCurrentAccount(scope);
    return result;
  }
  async function persist() {
    assertCurrentAccount(scope);
    try { await writeFile(filename, cache); } catch (_) { /* best-effort offline persistence */ }
    assertCurrentAccount(scope);
  }
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

async function listConversations(folderId, opts = {}) {
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

// Full-text search across a user's own conversations (title + message
// content, server-side, cross-tenant isolated — see lib/conversationSearch.js
// in ozira-ai). Always hits the network: a stale/offline result list here
// would be actively misleading for a search action.
async function searchConversations(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const d = await api.searchConversations(q);
  return (d.conversations || []).map(c => ({
    id: c.id, title: c.title, folderId: c.folderId || null,
    pinned: !!c.pinned, archived: !!c.archived, count: c.count,
  }));
}

// Response Save = bookmark ONLY (a conversationId+messageIndex reference),
// never OZIRA memory. Server-authoritative; nothing is cached on-device.
async function saveBookmark(conversationId, messageIndex) {
  const rid = await serverId(conversationId);
  return api.saveBookmark(rid, messageIndex);
}
async function unsaveBookmark(conversationId, messageIndex) {
  const rid = await serverId(conversationId);
  return api.unsaveBookmark(rid, messageIndex);
}
async function listBookmarkedIndexes(conversationId) {
  try {
    const rid = await serverId(conversationId);
    const d = await api.listBookmarks(rid);
    return d.messageIndexes || [];
  } catch (_) {
    return [];
  }
}

// Update flags on a conversation (pinned, archived, ...).
async function setConversationMeta(id, patch) {
  const s = await load();
  const rid = await serverId(id);
  if (s.conversations[id]) Object.assign(s.conversations[id], patch);
  if (s.conversations[rid]) Object.assign(s.conversations[rid], patch);
  await persist();
  try { await api.conversationMeta(rid, patch); } catch (_) {}
}

// Read the on-device copy without touching the network. Chat screens use this
// first so a conversation opens immediately, then refresh from the account.
async function getCachedConversation(id) {
  const rid = await serverId(id);
  const s = await load();
  return s.conversations[rid] || s.conversations[id] || null;
}

async function getConversation(id) {
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

async function saveConversation(conv) {
  const s = await load();
  if (s.settings && s.settings.saveHistory === false) return null; // history saving turned off
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
    if (d && d.id) {
      await linkId(conv.id, d.id);
      return { id: d.id, title: d.title || conv.title };
    }
  } catch (_) { /* stays in the cache; the next save retries */ }
  return null;
}

async function deleteConversation(id) {
  const s = await load();
  const rid = await serverId(id);
  delete s.conversations[id];
  delete s.conversations[rid];
  delete s.idMap[id];
  s.order = s.order.filter(x => x !== id && x !== rid);
  await persist();
  try { await api.deleteConversation(rid); } catch (_) {}
}

async function listFolders() {
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

async function createFolder(name) {
  const d = await api.createFolder(String(name).slice(0, 40));
  const f = d.folder;
  const s = await load();
  s.folders.push(f);
  await persist();
  return f;
}

async function deleteFolder(id) {
  const s = await load();
  s.folders = s.folders.filter(f => f.id !== id);
  Object.values(s.conversations).forEach(c => { if (c.folderId === id) c.folderId = null; });
  await persist();
  try { await api.deleteFolder(id); } catch (_) {}
}

async function setConversationFolder(id, folderId) {
  return setConversationMeta(id, { folderId: folderId || null });
}

// --- app settings ---
async function getSettings() {
  const s = await load();
  return s.settings || {};
}
async function setSettings(patch) {
  const s = await load();
  s.settings = { ...(s.settings || {}), ...patch };
  await persist();
  return s.settings;
}
async function purgeAllHistory() {
  const s = await load();
  const ids = [...new Set(Object.keys(s.conversations).map(id => s.idMap[id] || id))];
  s.conversations = {};
  s.order = [];
  s.idMap = {};
  await persist();
  // Clear the account copy too, or they would reappear on the next refresh.
  for (const cid of ids) { try { await api.deleteConversation(cid); } catch (_) {} }
}

// --- profile / personalization ---
async function getProfile() {
  const s = await load();
  return s.profile || {};
}
async function getProfileOwnerId() {
  const s = await load();
  return s.profileOwnerId || '';
}
async function replaceProfile(profile, ownerId) {
  const s = await load();
  if (ownerId !== scope.ownerId) throw new Error('Profile owner mismatch.');
  s.profile = { ...(profile || {}) };
  s.profileOwnerId = ownerId || '';
  await persist();
  return s.profile;
}
async function setProfile(patch) {
  const s = await load();
  s.profile = { ...(s.profile || {}), ...patch };
  await persist();
  return s.profile;
}
  return { listConversations, searchConversations, saveBookmark, unsaveBookmark, listBookmarkedIndexes, setConversationMeta, getCachedConversation, getConversation, saveConversation, deleteConversation, listFolders, createFolder, deleteFolder, setConversationFolder, getSettings, setSettings, purgeAllHistory, getProfile, getProfileOwnerId, replaceProfile, setProfile };
}
function accountMethod(name) {
  return async (...args) => {
    const scope = isAccountSnapshot(args[args.length - 1]) ? args.pop() : captureAccountSession();
    assertCurrentAccount(scope);
    for (const generation of stores.keys()) if (generation !== scope.generation) stores.delete(generation);
    if (!stores.has(scope.generation)) stores.set(scope.generation, createStore(scope));
    const result = await stores.get(scope.generation)[name](...args);
    assertCurrentAccount(scope);
    return clone(result);
  };
}
export const listConversations = accountMethod('listConversations');
export const searchConversations = accountMethod('searchConversations');
export const saveBookmark = accountMethod('saveBookmark');
export const unsaveBookmark = accountMethod('unsaveBookmark');
export const listBookmarkedIndexes = accountMethod('listBookmarkedIndexes');
export const setConversationMeta = accountMethod('setConversationMeta');
export const getCachedConversation = accountMethod('getCachedConversation');
export const getConversation = accountMethod('getConversation');
export const saveConversation = accountMethod('saveConversation');
export const deleteConversation = accountMethod('deleteConversation');
export const listFolders = accountMethod('listFolders');
export const createFolder = accountMethod('createFolder');
export const deleteFolder = accountMethod('deleteFolder');
export const setConversationFolder = accountMethod('setConversationFolder');
export async function getSettings(...args) {
  const scope = isAccountSnapshot(args[args.length - 1]) ? args[args.length - 1] : captureAccountSession();
  if (!scope.ownerId) {
    assertCurrentAccount(scope, false);
    const lang = (await devicePreferences()).lang || 'en';
    assertCurrentAccount(scope, false);
    return { lang };
  }
  return accountMethod('getSettings')(...args);
}
export async function setSettings(patch, scope = captureAccountSession()) {
  if (!scope.ownerId) {
    assertCurrentAccount(scope, false);
    const p = await devicePreferences();
    assertCurrentAccount(scope, false);
    if (typeof patch.lang === 'string') p.lang = patch.lang;
    await writeFile(preferenceFile, p);
    return { lang: p.lang || 'en' };
  }
  return accountMethod('setSettings')(patch, scope);
}
export const purgeAllHistory = accountMethod('purgeAllHistory');
export const getProfile = accountMethod('getProfile');
export const getProfileOwnerId = accountMethod('getProfileOwnerId');
export const replaceProfile = accountMethod('replaceProfile');
export const setProfile = accountMethod('setProfile');
