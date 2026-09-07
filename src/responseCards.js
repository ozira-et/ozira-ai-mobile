// Mobile adapter for the shared OZIRA response-card envelope. The server is
// authoritative; this validator prevents malformed/provider data from
// crashing the renderer and always leaves a plain-text fallback available.
const TYPES = new Set(['general_text', 'search', 'place', 'map', 'route', 'current_weather', 'forecast', 'nearby', 'fact', 'code', 'table', 'action', 'error']);
const LIFECYCLES = new Set(['loading', 'success', 'partial', 'empty', 'error']);
const ACTIONS = new Set(['open_url', 'open_map', 'copy', 'retry', 'confirm']);
const SECRET_KEYS = new Set(['token', 'accesstoken', 'refreshtoken', 'apikey', 'password', 'secret', 'authorization', 'privatekey']);

function safeText(value, max = 4000) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '';
}

function safePayload(value, depth = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 6) return null;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEYS.has(String(key).replace(/[^a-z]/gi, '').toLowerCase())) return null;
    if (typeof item === 'string') out[key] = safeText(item);
    else if (typeof item === 'number' && Number.isFinite(item)) out[key] = item;
    else if (typeof item === 'boolean') out[key] = item;
    else if (item && typeof item === 'object') {
      const nested = Array.isArray(item) ? item.slice(0, 24).map(x => typeof x === 'object' ? safePayload(x, depth + 1) : x) : safePayload(item, depth + 1);
      if (nested === null) return null;
      out[key] = nested;
    }
  }
  return out;
}

function publicUrl(value) {
  const href = safeText(value, 2000);
  try { const parsed = new URL(href); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.toString() : null; } catch (_) { return null; }
}

export function validateResponseCard(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cardId = safeText(raw.cardId, 200);
  const type = safeText(raw.type, 40);
  const lifecycle = safeText(raw.lifecycle, 20);
  const title = safeText(raw.title, 240);
  const payload = safePayload(raw.payload);
  if (!cardId || !type || !TYPES.has(type) || !lifecycle || !LIFECYCLES.has(lifecycle) || !title || !payload) return null;
  const sources = Array.isArray(raw.sources) ? raw.sources.slice(0, 8).map(source => {
    const label = safeText(source?.label, 160);
    const href = publicUrl(source?.href);
    return label ? { label, ...(href ? { href } : {}) } : null;
  }).filter(Boolean) : [];
  const actions = Array.isArray(raw.actions) ? raw.actions.slice(0, 8).map(action => {
    const id = safeText(action?.id, 80);
    const actionType = safeText(action?.type, 30);
    const label = safeText(action?.label, 120);
    const href = publicUrl(action?.href);
    return id && label && ACTIONS.has(actionType) ? { id, type: actionType, label, ...(href ? { href } : {}) } : null;
  }).filter(Boolean) : [];
  const fallbackText = safeText(raw.fallbackText);
  return {
    schemaVersion: 1, cardId, type, lifecycle, title, payload,
    ...(fallbackText ? { fallbackText } : {}),
    ...(sources.length ? { sources } : {}),
    ...(safeText(raw.provider, 120) ? { provider: safeText(raw.provider, 120) } : {}),
    ...(actions.length ? { actions } : {}),
  };
}

export function responseCardsForMessage(message) {
  const cards = Array.isArray(message?.metadata?.responseCards)
    ? message.metadata.responseCards.map(validateResponseCard).filter(Boolean)
    : [];
  if (cards.length) return cards;
  // Backward compatibility for older saved conversations that predate the
  // responseCards projection but already contain sanitized weather/place data.
  const legacy = message?.metadata || {};
  const weather = safePayload(legacy.weather);
  if (weather && typeof weather.location === 'string') return [{
    schemaVersion: 1, cardId: 'legacy_current_weather_0', type: 'current_weather', lifecycle: 'success',
    title: `Weather for ${weather.location}`, payload: weather, fallbackText: weather.summary || `Weather for ${weather.location}`,
  }];
  const place = safePayload(legacy.place);
  if (place && typeof place.name === 'string') return [{
    schemaVersion: 1, cardId: 'legacy_place_0', type: 'place', lifecycle: 'success',
    title: place.name, payload: place, fallbackText: place.summary || place.name,
  }];
  return [];
}
