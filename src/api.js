import { config } from './config';

let authToken = null;
export function setToken(t) { authToken = t; }

// The app language, mirrored here so voice calls can carry it without every
// caller threading it through. Amharic/Afaan Oromo route to the native Addis AI
// voice on the backend; the value comes from LanguageContext.
let currentLang = 'en';
export function setApiLang(l) { if (l) currentLang = l; }

async function req(path, { method, body, token, signal } = {}) {
  const res = await fetch(config.API_BASE + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...((token || authToken) ? { authorization: 'Bearer ' + (token || authToken) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ('Request failed (' + res.status + ')'));
    err.code = data.code;
    throw err;
  }
  return data;
}

export function absUrl(u) {
  if (!u) return u;
  return /^https?:/.test(u) ? u : config.API_BASE + u;
}

export const api = {
  login: (email, password) => req('/api/login', { body: { email, password } }),
  register: (name, email, password) => req('/api/register', { body: { name, email, password } }),
  me: (token) => req('/api/me', { token }),
  telegramLinkCode: (token) => req('/api/telegram/link-code', { body: {}, token }),
  plans: () => req('/api/plans'),
  chat: (payload, token, signal) => req('/api/chat', { body: payload, token, signal }),
  image: (payload, token, signal) => req('/api/image', { body: payload, token, signal }),
  conversations: (folderId, token) => req('/api/conversations' + (folderId ? '?folder=' + encodeURIComponent(folderId) : ''), { token }),
  getConversation: (id, token) => req('/api/conversations/get', { body: { id }, token }),
  saveConversation: (conv, token) => req('/api/conversations/save', { body: conv, token }),
  deleteConversation: (id, token) => req('/api/conversations/delete', { body: { id }, token }),
  conversationMeta: (id, patch, token) => req('/api/conversations/meta', { body: { id, ...patch }, token }),
  folders: (token) => req('/api/folders', { token }),
  createFolder: (name, token) => req('/api/folders/create', { body: { name }, token }),
  deleteFolder: (id, token) => req('/api/folders/delete', { body: { id }, token }),
  images: (token) => req('/api/images', { token }),
  feedback: (value, model, text, token) => req('/api/feedback', { body: { value, model, text }, token }),
  subscribe: (planId, provider, token) => req('/api/subscribe', { body: { planId, provider }, token }),
  travelListings: (params, token) => {
    const qs = new URLSearchParams(params || {}).toString();
    return req('/api/travel/listings' + (qs ? '?' + qs : ''), { token });
  },
  travelLead: (listingId, message, token) => req('/api/travel/lead', { body: { listingId, message }, token }),
  travelCompare: (question, listingIds, token) => req('/api/travel/compare', { body: { question, listingIds }, token }),
  devKeys: (token) => req('/api/dev/keys', { token }),
  devKeyCreate: (name, token) => req('/api/dev/keys', { body: { name }, token }),
  devKeyRevoke: (id, token) => req('/api/dev/keys/revoke', { body: { id }, token }),
  // --- new AI endpoints (need the backend patch deployed) ---
  aiCapabilities: (token) => req('/api/ai/capabilities', { token }),
  aiChat: (payload, token, signal) => req('/api/ai/chat', { body: payload, token, signal }),
  aiResearch: (query, token, signal) => req('/api/ai/research', { body: { query }, token, signal }),
  aiTranscribe: (audio, mimeType, token) => req('/api/ai/transcribe', { body: { audio, mimeType, lang: currentLang }, token }),
  aiSpeak: (text, token, voice) => req('/api/ai/speak', { body: { text, voice, lang: currentLang }, token }),
  // --- teams ---
  team: (token) => req('/api/team', { token }),
  teamCreate: (name, token) => req('/api/team/create', { body: { name }, token }),
  teamJoin: (code, token) => req('/api/team/join', { body: { code }, token }),
  teamLeave: (token) => req('/api/team/leave', { body: {}, token }),
  teamRemove: (email, token) => req('/api/team/remove', { body: { email }, token }),
  // --- scheduled tasks ---
  schedules: (token) => req('/api/schedules', { token }),
  scheduleCreate: (payload, token) => req('/api/schedules', { body: payload, token }),
  scheduleDelete: (id, token) => req('/api/schedules/delete', { body: { id }, token }),
  // --- import / migrate ---
  importData: (source, data, token) => req('/api/import', { body: { source, data }, token }),
  // --- email verification ---
  verifyEmail: (code, token) => req('/api/verify-email', { body: { code }, token }),
  resendVerification: (token) => req('/api/resend-verification', { body: {}, token }),
  deleteAccount: (email, token) => req('/api/me/delete', { body: { confirm: email }, token }),
  usage: (token) => req('/api/usage', { token }),
  storage: (token) => req('/api/storage', { token }),
  // --- language ---
  settingsLang: (lang, token) => req('/api/settings/lang', { body: { lang }, token }),
  settings: (token) => req('/api/settings', { token }),
  saveSettings: (settings, token) => req('/api/settings', { body: { settings }, token }),
};
