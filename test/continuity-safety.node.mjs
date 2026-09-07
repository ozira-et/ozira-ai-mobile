// Run: node --experimental-vm-modules --test test/continuity-safety.node.mjs
// Executes the real adapter and API modules with in-memory platform/network boundaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function fixture(staging = false) {
  const storage = new Map();
  const calls = [];
  let failRead = false;
  let version = 1;
  let checkpoint = 'client-b';
  const config = { IS_STAGING: staging, API_BASE: 'https://staging.invalid' };
  const context = (await import('node:vm')).createContext({
    console, fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body, headers: init.headers });
      if (failRead && /discover|get$/.test(url)) throw new Error('offline');
      if (url.endsWith('/update')) {
        if (body.stateVersion !== version) return { ok: false, status: 409, json: async () => ({ code: 'VERSION_CONFLICT', error: 'stale' }) };
        version++;
        checkpoint = body.checkpoint;
      }
      return { ok: true, status: 200, json: async () => ({ run: { runId: 'run-a', conversationId: 'conv-a', stateVersion: version, checkpoint } }) };
    },
  });
  const mocks = {
    './config': { config },
    '@react-native-async-storage/async-storage': { default: {
      getItem: async key => storage.get(key) || null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    } },
    'react-native': { Platform: { OS: 'android' } },
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
    const module = exports
      ? new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context })
      : new SourceTextModule(await readFile(new URL(`../src/${name.replace('./', '')}.js`, import.meta.url), 'utf8'), { context });
    modules.set(name, module);
    await module.link(load);
    return module;
  }
  const runs = await load('./persistentRun');
  await runs.evaluate();
  modules.get('./api').namespace.setToken('test-token', 'a');
  return { runs: runs.namespace, api: modules.get('./api').namespace.api, calls, offline: () => { failRead = true; }, state: () => ({ version, checkpoint }) };
}

test('stale update preserves B state, refetches, and exposes 409 without replay', async () => {
  const f = await fixture();
  await f.runs.getPersistentRun({ ownerId: 'a', conversationId: 'conv-a', token: 'test-token' });
  await assert.rejects(f.runs.updatePersistentRun({ ownerId: 'a', conversationId: 'conv-a', token: 'test-token', patch: { stateVersion: 0, checkpoint: 'stale-a' }, retryConflict: true }), error => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'VERSION_CONFLICT');
    assert.equal(error.currentRun.checkpoint, 'client-b');
    return true;
  });
  assert.equal(f.calls.filter(c => c.url.endsWith('/update')).length, 1);
  assert.deepEqual(f.state(), { version: 1, checkpoint: 'client-b' });
});

test('failed refetch retains original conflict and never replays', async () => {
  const f = await fixture();
  await f.runs.getPersistentRun({ ownerId: 'a', conversationId: 'conv-a' });
  f.offline();
  await assert.rejects(f.runs.updatePersistentRun({ ownerId: 'a', conversationId: 'conv-a', patch: { stateVersion: 0 } }), { status: 409, code: 'VERSION_CONFLICT' });
  assert.equal(f.calls.filter(c => c.url.endsWith('/update')).length, 1);
});

test('valid version succeeds once', async () => {
  const f = await fixture();
  await f.runs.getPersistentRun({ ownerId: 'a', conversationId: 'conv-a' });
  const run = await f.runs.updatePersistentRun({ ownerId: 'a', conversationId: 'conv-a', patch: { stateVersion: 1, checkpoint: 'approved' } });
  assert.equal(run.stateVersion, 2);
  assert.equal(f.calls.filter(c => c.url.endsWith('/update')).length, 1);
});

for (const staging of [false, undefined, 'staging', true]) {
  test(`diagnostic guard with staging=${staging}`, async () => {
    const f = await fixture(staging);
    const result = await f.api.runDiagnostic('conv-a', 'test-token');
    assert.equal(f.calls.length, staging === true ? 1 : 0);
    if (staging === true) {
      assert.equal(f.calls[0].headers.authorization, 'Bearer test-token');
      assert.equal(f.calls[0].body.conversationId, 'conv-a');
    } else assert.equal(result, null);
  });
}
