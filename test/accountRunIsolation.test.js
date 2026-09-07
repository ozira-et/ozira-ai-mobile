describe('account-scoped run hints', () => {
  let session, runs, values, api, storage;
  beforeEach(() => {
    jest.resetModules(); values = new Map();
    session = require('../src/accountSession');
    storage = { getItem: jest.fn(async key => values.get(key) || null), setItem: jest.fn(async (key, value) => values.set(key, value)), removeItem: jest.fn(async key => values.delete(key)) };
    api = { discoverRun: jest.fn(async (_id, token) => ({ run: { runId: 'run-' + token, stateVersion: 0 } })) };
    jest.doMock('../src/api', () => ({ api }));
    jest.doMock('../src/config', () => ({ config: { SUPABASE_URL: 'https://staging.invalid' } }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: storage }));
    runs = require('../src/persistentRun');
  });
  it('stores different owners independently and preserves the first account', async () => {
    session.setAccountSession('a', 'A'); await runs.getPersistentRun({ ownerId: 'A', conversationId: 'same', token: 'a' });
    session.setAccountSession('b', 'B'); await runs.getPersistentRun({ ownerId: 'B', conversationId: 'same', token: 'b' });
    const states = [...values.values()].map(JSON.parse);
    expect(states.find(s => s.ownerId === 'A').runs.same.runId).toBe('run-a');
    expect(states.find(s => s.ownerId === 'B').runs.same.runId).toBe('run-b');
    await runs.clearPersistentRunCache();
    expect([...values.values()].map(JSON.parse).map(s => s.ownerId)).toEqual(['A']);
  });
  it('rejects attempts to use a different owner or a logged-out session', async () => {
    session.setAccountSession('b', 'B');
    await expect(runs.getPersistentRun({ ownerId: 'A', conversationId: 'same', token: 'b' })).rejects.toMatchObject({ code: 'ACCOUNT_SESSION_CHANGED' });
    session.setAccountSession(null, null);
    await expect(runs.getPersistentRun({ ownerId: 'A', conversationId: 'same', token: 'a' })).rejects.toMatchObject({ code: 'ACCOUNT_SESSION_CHANGED' });
    expect(api.discoverRun).not.toHaveBeenCalled();
  });
  it('an A persistence completing after B initialization never writes A links inside B', async () => {
    let release, started;
    const ready = new Promise(resolve => { started = resolve; });
    storage.setItem.mockImplementation(async (key, value) => {
      if (JSON.parse(value).ownerId === 'A') { started(); await new Promise(resolve => { release = resolve; }); }
      values.set(key, value);
    });
    session.setAccountSession('a', 'A');
    const pending = runs.getPersistentRun({ ownerId: 'A', conversationId: 'same', token: 'a' });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'ACCOUNT_SESSION_CHANGED' });
    await ready;
    session.setAccountSession('b', 'B'); await runs.getPersistentRun({ ownerId: 'B', conversationId: 'same', token: 'b' });
    release(); await rejected;
    expect([...values.values()].map(JSON.parse).find(s => s.ownerId === 'B').runs.same.runId).toBe('run-b');
  });
});
