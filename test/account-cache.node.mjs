// Real mobile modules; synthetic accounts, in-memory files/network only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

async function fixture(legacy = null, existingFiles = null) {
  const files = existingFiles || new Map(legacy ? [['documents/ozira-store.json', JSON.stringify(legacy)]] : []);
  const requests = [];
  let offline = false;
  let releaseRead;
  let holdRead = false;
  let holdSave = false;
  let holdDevice = false;
  let releaseDevice;
  const filesApi = {
    Paths: { document: 'documents' },
    File: class {
      constructor(...parts) { this.path = parts.join('/'); }
      get exists() { return files.has(this.path); }
      async text() { return files.get(this.path); }
      create() { files.set(this.path, ''); }
      write(value) { files.set(this.path, value); }
    },
  };
  const context = createContext({ console, setTimeout, clearTimeout, AbortController, URL,
    fetch: async (url, init) => {
      requests.push({ url, body: init.body ? JSON.parse(init.body) : null, auth: init.headers.authorization });
      if (offline) throw new Error('offline');
      if (holdRead && url.endsWith('/get')) await new Promise(resolve => { releaseRead = resolve; });
      if (holdSave && url.endsWith('/save')) await new Promise(resolve => { releaseRead = resolve; });
      return { ok: true, status: 200, json: async () => url.endsWith('/get')
        ? { conversation: { id: 'cnv-a', title: 'A private', messages: [{ role: 'user', content: 'synthetic private A' }] } }
        : url.endsWith('/save') ? { id: 'saved' } : url.endsWith('/folders/create') ? { folder: { id: 'folder-a', name: 'A folder' } } : { conversations: [] } };
    },
  });
  const mocks = {
    'expo-file-system': filesApi,
    './config': { config: { IS_STAGING: true, API_BASE: 'https://staging.invalid', SUPABASE_URL: 'https://staging-db.invalid' } },
    'react-native': { Platform: { OS: 'android' } },
    '@react-native-async-storage/async-storage': { default: {
      getItem: async () => { if (holdDevice) await new Promise(resolve => { releaseDevice = resolve; }); return 'synthetic-device'; }, setItem: async () => {}, removeItem: async () => {},
    } },
  };
  const modules = new Map();
  const pending = new Map();
  function load(name) {
    if (!pending.has(name)) pending.set(name, loadOne(name));
    return pending.get(name);
  }
  async function loadOne(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = mocks[name];
    const m = exports ? new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context }) : new SourceTextModule(await readFile(new URL(`../src/${name.replace('./', '')}.js`, import.meta.url), 'utf8'), { context });
    modules.set(name, m);
    await m.link(load);
    return m;
  }
  const store = await load('./localStore'); await store.evaluate();
  const api = modules.get('./api').namespace;
  return { store: store.namespace, api, requests, files,
    scope: () => modules.get('./accountSession').namespace.captureAccountSession(),
    offline: () => { offline = true; },
    hold: () => { holdRead = true; },
    holdSave: () => { holdSave = true; },
    holdDevice: () => { holdDevice = true; },
    releaseDevice: () => releaseDevice?.(),
    deviceReady: async () => { for (let i = 0; i < 100 && !releaseDevice; i++) await new Promise(resolve => setTimeout(resolve, 1)); assert.ok(releaseDevice); },
    release: () => releaseRead?.(),
    ready: async () => { for (let i = 0; i < 40 && !releaseRead; i++) await new Promise(resolve => setTimeout(resolve, 1)); },
  };
}

test('A retains own offline history, but B cannot list or read it', async () => {
  const f = await fixture();
  f.api.setToken('synthetic-a', 'user-a');
  await f.store.getConversation('cnv-a');
  f.offline();
  assert.equal((await f.store.getCachedConversation('cnv-a')).messages.length, 1);
  f.api.setToken(null, null);
  f.api.setToken('synthetic-b', 'user-b');
  assert.equal((await f.store.listConversations()).length, 0);
  assert.equal(await f.store.getCachedConversation('cnv-a'), null);
});

test('A cache survives logout, B, and a fresh runtime without being inherited', async () => {
  const f = await fixture(); f.api.setToken('a', 'user-a');
  await f.store.getConversation('cnv-a');
  await f.store.replaceProfile({ name: 'A private' }, 'user-a');
  await f.store.createFolder('A folder');
  await f.store.setSettings({ voice: 'A-voice', saveHistory: false });
  f.api.setToken(null, null);
  await assert.rejects(f.store.getCachedConversation('cnv-a'), { code: 'ACCOUNT_SESSION_CHANGED' });
  f.api.setToken('b', 'user-b'); f.offline();
  assert.equal(await f.store.getCachedConversation('cnv-a'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(await f.store.getProfile())), {});
  assert.equal((await f.store.listFolders()).length, 0);
  assert.equal((await f.store.getSettings()).voice, undefined);
  const restarted = await fixture(null, f.files); restarted.api.setToken('a2', 'user-a'); restarted.offline();
  assert.equal((await restarted.store.getCachedConversation('cnv-a')).messages.length, 1);
  assert.equal((await restarted.store.getProfile()).name, 'A private');
  assert.equal((await restarted.store.listFolders()).length, 1);
  assert.equal((await restarted.store.getSettings()).saveHistory, false);
});

test('switch during device lookup never sends a save with the replacement token', async () => {
  const f = await fixture(); f.api.setToken('a', 'user-a'); f.holdDevice();
  const write = f.store.saveConversation({ id: 'local-a', title: 'A private', messages: [] }).catch(() => null);
  await f.deviceReady(); f.api.setToken('b', 'user-b'); f.releaseDevice(); await write;
  assert.equal(f.requests.length, 0);
  assert.equal(await f.store.getCachedConversation('local-a'), null);
});

test('A to B to A invalidates the original delayed response', async () => {
  const f = await fixture(); f.api.setToken('a', 'user-a'); f.hold();
  const pending = f.store.getConversation('cnv-a').catch(() => null); await f.ready();
  f.api.setToken('b', 'user-b'); f.api.setToken('a2', 'user-a'); f.release();
  assert.equal(await pending, null);
  assert.equal(await f.store.getCachedConversation('cnv-a'), null);
});

test('same-owner token refresh permits the originating read', async () => {
  const f = await fixture(); f.api.setToken('a', 'user-a'); f.hold();
  const pending = f.store.getConversation('cnv-a'); await f.ready();
  f.api.setToken('a-refreshed', 'user-a'); f.release();
  assert.equal((await pending).id, 'cnv-a');
});

test('a captured UI callback cannot save A content after switching to B', async () => {
  const f = await fixture(); f.api.setToken('a', 'user-a'); const scope = f.scope();
  f.api.setToken('b', 'user-b');
  await assert.rejects(f.store.saveConversation({ id: 'a-draft', messages: [] }, scope), { code: 'ACCOUNT_SESSION_CHANGED' });
  await assert.rejects(f.store.setProfile({ name: 'A' }, scope), { code: 'ACCOUNT_SESSION_CHANGED' });
  assert.equal(f.requests.length, 0);
});

test('owned legacy migrates only for its recorded account/environment and stops on replacement', async () => {
  const legacy = { ownerId: 'user-a', environment: 'https://staging-db.invalid', conversations: {
    one: { id: 'one', messages: [{ content: 'one' }] }, two: { id: 'two', messages: [{ content: 'two' }] }
  }, order: ['one', 'two'] };
  const f = await fixture(legacy); f.api.setToken('b', 'user-b'); await f.store.listConversations();
  assert.equal(f.requests.filter(r => r.url.endsWith('/save')).length, 0);
  f.api.setToken('a', 'user-a'); f.holdSave(); await f.store.listConversations(); await f.ready();
  f.api.setToken('b', 'user-b'); f.release(); await new Promise(resolve => setTimeout(resolve, 10));
  const writes = f.requests.filter(r => r.url.endsWith('/save'));
  assert.equal(writes.length, 1); assert.equal(writes[0].auth, 'Bearer a');
  assert.equal(await f.store.getCachedConversation('one'), null);
  assert.equal(f.files.get('documents/ozira-store.json'), JSON.stringify(legacy));
});

test('profile-only legacy marker does not grant chat ownership', async () => {
  const legacy = { profileOwnerId: 'user-a', profile: { name: 'unknown' }, conversations: { old: { id: 'old', messages: [{}] } } };
  const f = await fixture(legacy); f.api.setToken('a', 'user-a'); await f.store.listConversations();
  assert.equal(await f.store.getCachedConversation('old'), null);
  assert.equal((await f.store.getProfile()).name, undefined);
  assert.equal(f.requests.filter(r => r.url.endsWith('/save')).length, 0);
});

test('disabled history still prevents local and remote writes', async () => {
  const f = await fixture(); f.api.setToken('a', 'user-a'); await f.store.setSettings({ saveHistory: false });
  assert.equal(await f.store.saveConversation({ id: 'a', messages: [] }), null);
  assert.equal(await f.store.getCachedConversation('a'), null); assert.equal(f.requests.length, 0);
});

test('account purge resolves aliases and preserves B cache and unknown legacy bytes', async () => {
  const legacy = { conversations: { unknown: { id: 'unknown' } } };
  const f = await fixture(legacy); f.api.setToken('b', 'user-b'); await f.store.replaceProfile({ name: 'B' }, 'user-b');
  f.api.setToken('a', 'user-a'); await f.store.saveConversation({ id: 'local-a', messages: [] });
  await f.store.purgeAllHistory();
  const deletes = f.requests.filter(r => r.url.endsWith('/delete'));
  assert.deepEqual(deletes.map(r => r.body.id), ['saved']);
  f.api.setToken('b', 'user-b'); assert.equal((await f.store.getProfile()).name, 'B');
  assert.equal(f.files.get('documents/ozira-store.json'), JSON.stringify(legacy));
});

test('theme and language are usable before authentication without adopting account data', async () => {
  const f = await fixture({ theme: 'light', settings: { saveHistory: false }, profile: { name: 'unowned' } });
  assert.equal(await f.store.getTheme(), 'light'); await f.store.setSettings({ lang: 'am', saveHistory: false });
  assert.equal((await f.store.getSettings()).lang, 'am');
  f.api.setToken('a', 'user-a'); assert.equal((await f.store.getSettings()).saveHistory, undefined);
});

test('an A response completing after switch cannot populate B cache', async () => {
  const f = await fixture();
  f.api.setToken('synthetic-a', 'user-a'); f.hold();
  const read = f.store.getConversation('cnv-a').catch(() => null);
  await f.ready();
  f.api.setToken('synthetic-b', 'user-b'); f.release();
  assert.equal(await read, null);
  assert.equal(await f.store.getCachedConversation('cnv-a'), null);
});

test('ownerless legacy data is preserved but neither displayed nor auto-uploaded', async () => {
  const legacy = { conversations: { old: { id: 'old', title: 'old A', messages: [{ role: 'user', content: 'old private' }] } }, order: ['old'], folders: [] };
  const f = await fixture(legacy);
  f.api.setToken('synthetic-b', 'user-b');
  await f.store.listConversations();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(f.requests.filter(r => r.url.endsWith('/save')).length, 0);
  assert.equal(await f.store.getCachedConversation('old'), null);
  assert.equal(f.files.get('documents/ozira-store.json'), JSON.stringify(legacy));
});
