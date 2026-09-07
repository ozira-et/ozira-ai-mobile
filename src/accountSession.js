// In-memory authority only. Never persist tokens with cached application data.
let current = Object.freeze({ ownerId: null, token: null, generation: 0 });
const tokens = new Set();
const snapshots = new WeakSet();
export function setAccountSession(token, ownerId) {
  const owner = token && typeof ownerId === 'string' && ownerId ? ownerId : null;
  const changed = owner !== current.ownerId || (!token && !!current.token);
  if (changed) tokens.clear();
  if (token) tokens.add(token);
  current = Object.freeze({ ownerId: owner, token: token || null, generation: current.generation + (changed ? 1 : 0) });
  snapshots.add(current);
  return current;
}
export function captureAccountSession() { snapshots.add(current); return current; }
export function isAccountSnapshot(value) { return !!value && typeof value === 'object' && snapshots.has(value); }
export function isCurrentAccount(scope) {
  return scope?.generation === current.generation && scope?.ownerId === current.ownerId;
}
export function assertCurrentAccount(scope, requireOwner = true) {
  if (!isCurrentAccount(scope) || (requireOwner && (!scope.ownerId || !scope.token))) {
    throw Object.assign(new Error('Account session changed. Reopen the workspace.'), { code: 'ACCOUNT_SESSION_CHANGED', status: 401 });
  }
}
export function captureRequestToken(explicit) {
  const scope = captureAccountSession();
  const token = explicit === undefined ? scope.token : explicit;
  if ((scope.ownerId || scope.generation > 0) && token && !tokens.has(token)) {
    throw Object.assign(new Error('Account session changed.'), { code: 'ACCOUNT_SESSION_CHANGED', status: 401 });
  }
  return { scope, token };
}
