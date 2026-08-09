import { config } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {FileSystemUploadType, uploadAsync} from 'expo-file-system/legacy';

let authToken = null;
export function setToken(t) { authToken = t; }
export function getToken() { return authToken; }
function base64Url(value) {
  const binary = unescape(encodeURIComponent(String(value || '')));
  return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function liveSocketConfig(token) {
  const accessToken = token || authToken;
  if (!accessToken) throw new Error('Sign in before starting Live voice.');
  return {
    url: config.API_BASE.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/api/ai/live',
    protocols: ['ozira-live', 'ozira-token.' + base64Url(accessToken)],
  };
}
let deviceId = null;
async function getDeviceId() {
  if (deviceId) return deviceId;
  deviceId = await AsyncStorage.getItem('ozira_device_id');
  if (!deviceId) {
    deviceId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 18);
    await AsyncStorage.setItem('ozira_device_id', deviceId);
  }
  return deviceId;
}

// The app language, mirrored here so voice calls can carry it without every
// caller threading it through. Amharic/Afaan Oromo route to the native Addis AI
// voice on the backend; the value comes from LanguageContext.
let currentLang = 'en';
export function setApiLang(l) { if (l) currentLang = l; }

async function req(path, { method, body, token, signal } = {}) {
  const sessionDeviceId = await getDeviceId();
  const res = await fetch(config.API_BASE + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      'x-ozira-device-id': sessionDeviceId,
      'x-ozira-device-label': 'OZIRA Mobile · ' + (Platform.OS === 'ios' ? 'iPhone/iPad' : 'Android'),
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

async function uploadMedia(sourceValue, mimeType, name, token, signal) {
  const sessionDeviceId = await getDeviceId();
  const accessToken = token || authToken;
  if (!accessToken) throw new Error('Sign in before uploading media.');
  const url = config.API_BASE + '/api/ai/upload?name=' + encodeURIComponent(name || 'media');
  const headers = {
    'content-type': mimeType,
    authorization: 'Bearer ' + accessToken,
    'x-ozira-device-id': sessionDeviceId,
    'x-ozira-device-label': 'OZIRA Mobile · ' + (Platform.OS === 'ios' ? 'iPhone/iPad' : Platform.OS === 'web' ? 'Web' : 'Android'),
  };
  let status;
  let raw;
  if (Platform.OS === 'web') {
    // Expo pickers expose the browser File on web. Passing it directly lets the
    // browser stream large videos to fetch without first base64-encoding them or
    // copying the whole payload through JavaScript-managed memory.
    let body = sourceValue;
    if (!(typeof Blob !== 'undefined' && sourceValue instanceof Blob)) {
      const source = await fetch(sourceValue, {signal});
      body = await source.blob();
    }
    const response = await fetch(url, {method: 'POST', headers, body, signal});
    status = response.status; raw = await response.text();
  } else {
    const response = await uploadAsync(url, sourceValue, {httpMethod: 'POST', uploadType: FileSystemUploadType.BINARY_CONTENT, headers});
    status = response.status; raw = response.body;
  }
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
  if (status < 200 || status >= 300) {
    const error = new Error(data.error || `Upload failed (${status})`); error.code = data.code; throw error;
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
  imageEdit: (payload, token, signal) => req('/api/image/edit', { body: payload, token, signal }),
  conversations: (folderId, token) => req('/api/conversations' + (folderId ? '?folder=' + encodeURIComponent(folderId) : ''), { token }),
  getConversation: (id, token, signal) => req('/api/conversations/get', { body: { id }, token, signal }),
  saveConversation: (conv, token) => req('/api/conversations/save', { body: conv, token }),
  deleteConversation: (id, token) => req('/api/conversations/delete', { body: { id }, token }),
  conversationMeta: (id, patch, token) => req('/api/conversations/meta', { body: { id, ...patch }, token }),
  folders: (token) => req('/api/folders', { token }),
  createFolder: (name, token) => req('/api/folders/create', { body: { name }, token }),
  deleteFolder: (id, token) => req('/api/folders/delete', { body: { id }, token }),
  images: (token) => req('/api/images', { token }),
  deleteImage: (payload, token) => req('/api/images/delete', { body: payload, token }),
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
  aiVision: (payload, token, signal) => req('/api/ai/vision', { body: payload, token, signal }),
  aiResearch: (query, token, signal) => req('/api/ai/research', { body: { query }, token, signal }),
  aiTranscribe: (audio, mimeType, token) => req('/api/ai/transcribe', { body: { audio, mimeType, lang: currentLang }, token }),
  aiSpeak: (text, token, voice) => req('/api/ai/speak', { body: { text, voice, lang: currentLang }, token }),
  aiImage: (payload, token, signal) => req('/api/ai/image', {body: payload, token, signal}),
  aiImageEdit: (payload, token, signal) => req('/api/ai/image/edit', {body: payload, token, signal}),
  aiVideo: (payload, token, signal) => req('/api/ai/video', {body: payload, token, signal}),
  aiVideoJob: (jobId, token, signal) => req('/api/ai/video/' + encodeURIComponent(jobId), {token, signal}),
  aiUpload: (uri, mimeType, name, token, signal) => uploadMedia(uri, mimeType, name, token, signal),
  liveSocketConfig,
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
  sessions: (token) => req('/api/sessions', { token }),
  revokeSession: (id, token) => req('/api/sessions/revoke', { body: { id }, token }),
  profile: (token) => req('/api/profile', { token }),
  saveProfile: (profile, token) => req('/api/profile', { body: { profile }, token }),
  // --- language ---
  settingsLang: (lang, token) => req('/api/settings/lang', { body: { lang }, token }),
  settings: (token) => req('/api/settings', { token }),
  saveSettings: (settings, token) => req('/api/settings', { body: { settings }, token }),
};
