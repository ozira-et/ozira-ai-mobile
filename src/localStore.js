// On-device storage for chat history and folders (survives until the app is
// uninstalled). Designed so an account-sync adapter can drop in later.
import { Paths, File } from 'expo-file-system';

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

export async function listConversations(folderId, opts = {}) {
  const s = await load();
  let ids = s.order;
  if (folderId) ids = ids.filter(id => s.conversations[id] && s.conversations[id].folderId === folderId);
  let list = ids.map(id => s.conversations[id]).filter(Boolean);
  list = opts.archived ? list.filter(c => c.archived) : list.filter(c => !c.archived);
  // Pinned chats float to the top.
  return [...list.filter(c => c.pinned), ...list.filter(c => !c.pinned)];
}

// Update flags on a conversation (pinned, archived, ...).
export async function setConversationMeta(id, patch) {
  const s = await load();
  if (s.conversations[id]) { Object.assign(s.conversations[id], patch); await persist(); }
}

export async function getConversation(id) {
  const s = await load();
  return s.conversations[id] || null;
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
}

export async function deleteConversation(id) {
  const s = await load();
  delete s.conversations[id];
  s.order = s.order.filter(x => x !== id);
  await persist();
}

export async function listFolders() {
  const s = await load();
  return s.folders.slice();
}

export async function createFolder(name) {
  const s = await load();
  const f = { id: 'f_' + Date.now(), name: String(name).slice(0, 40), createdAt: Date.now() };
  s.folders.push(f);
  await persist();
  return f;
}

export async function deleteFolder(id) {
  const s = await load();
  s.folders = s.folders.filter(f => f.id !== id);
  Object.values(s.conversations).forEach(c => { if (c.folderId === id) c.folderId = null; });
  await persist();
}

export async function setConversationFolder(id, folderId) {
  const s = await load();
  if (s.conversations[id]) { s.conversations[id].folderId = folderId; await persist(); }
}

// --- app preferences ---
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
  s.conversations = {};
  s.order = [];
  await persist();
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
