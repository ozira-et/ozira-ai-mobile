import { config } from './config';

let authToken = null;
export function setToken(t) { authToken = t; }

async function req(path, { method, body, token } = {}) {
  const res = await fetch(config.API_BASE + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...((token || authToken) ? { authorization: 'Bearer ' + (token || authToken) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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
  plans: () => req('/api/plans'),
  chat: (payload, token) => req('/api/chat', { body: payload, token }),
  image: (payload, token) => req('/api/image', { body: payload, token }),
  conversations: (token) => req('/api/conversations', { token }),
  getConversation: (id, token) => req('/api/conversations/get', { body: { id }, token }),
  images: (token) => req('/api/images', { token }),
};
