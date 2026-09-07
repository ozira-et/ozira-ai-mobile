describe('persistent run discovery failure boundary', () => {
  let api;
  let storage;
  const args = { ownerId: 'user-a', conversationId: 'cnv-existing', objective: 'Existing task', token: 'synthetic-a' };
  beforeEach(() => {
    jest.resetModules();
    storage = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}) };
    api = {
      discoverRun: jest.fn(async () => ({ run: null })),
      getRun: jest.fn(async () => ({ run: { runId: 'run-existing', conversationId: args.conversationId, stateVersion: 3 } })),
      createRun: jest.fn(async () => ({ run: { runId: 'run-new', conversationId: args.conversationId, stateVersion: 0 } })),
    };
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: storage }));
    jest.doMock('../src/api', () => ({ api }));
  });
  function cached() {
    storage.getItem.mockResolvedValue(JSON.stringify({ ownerId: args.ownerId, runs: { [args.conversationId]: { runId: 'run-existing' } } }));
  }
  it.each([401, 403, 404, 503])('fresh client never creates when discovery fails with %s', async status => {
    const error = Object.assign(new Error('discovery unavailable'), { status, code: 'DISCOVERY_FAILED' });
    api.discoverRun.mockRejectedValue(error);
    await expect(require('../src/persistentRun').createOrResolveRun(args)).rejects.toBe(error);
    expect(api.createRun).not.toHaveBeenCalled();
  });
  it('transient discovery error can use an authenticated server read of a cached hint', async () => {
    cached(); api.discoverRun.mockRejectedValue(Object.assign(new Error('offline discovery'), { status: 503 }));
    const run = await require('../src/persistentRun').createOrResolveRun(args);
    expect(run.runId).toBe('run-existing');
    expect(api.getRun).toHaveBeenCalledWith('run-existing', 'synthetic-a');
    expect(api.createRun).not.toHaveBeenCalled();
  });
  it.each([undefined, {}, { run: {} }])('malformed discovery is not an authoritative empty result (%j)', async response => {
    api.discoverRun.mockResolvedValue(response);
    await expect(require('../src/persistentRun').createOrResolveRun(args)).rejects.toMatchObject({ code: 'RUN_DISCOVERY_INVALID', status: 502 });
    expect(api.createRun).not.toHaveBeenCalled();
  });
  it.each([401, 403])('does not mask discovery authorization failure %s using local hints', async status => {
    cached(); const error = Object.assign(new Error('auth'), { status }); api.discoverRun.mockRejectedValue(error);
    await expect(require('../src/persistentRun').getPersistentRun(args)).rejects.toBe(error);
    expect(api.getRun).not.toHaveBeenCalled();
  });
  it('missing cached run plus failed discovery is not proof that creation is safe', async () => {
    cached(); const error = Object.assign(new Error('discovery failed'), { status: 503 }); api.discoverRun.mockRejectedValue(error);
    api.getRun.mockRejectedValue(Object.assign(new Error('missing'), { code: 'NOT_FOUND', status: 404 }));
    await expect(require('../src/persistentRun').createOrResolveRun(args)).rejects.toBe(error);
    expect(api.createRun).not.toHaveBeenCalled();
  });
  it('confirmed absent server run and obsolete local hint allow one idempotent create', async () => {
    cached(); api.getRun.mockRejectedValue(Object.assign(new Error('missing'), { code: 'NOT_FOUND', status: 404 }));
    const run = await require('../src/persistentRun').createOrResolveRun(args);
    expect(run.runId).toBe('run-new');
    expect(api.createRun).toHaveBeenCalledTimes(1);
    expect(api.discoverRun).toHaveBeenCalledTimes(1);
  });
});
