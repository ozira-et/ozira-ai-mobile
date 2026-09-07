describe('mobile Persistent Run adapter', () => {
  let api;
  let AsyncStorage;
  let runs;

  beforeEach(() => {
    jest.resetModules();
    runs = {};
    AsyncStorage = {
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    api = {
      createRun: jest.fn(async ({ conversationId }) => ({ run: {
        runId: 'run_' + conversationId, conversationId, stateVersion: 0, fileReferences: [],
      } })),
      discoverRun: jest.fn(async () => ({ run: null })),
      getRun: jest.fn(async runId => ({ run: { runId, conversationId: 'c_12345678', stateVersion: 2, fileReferences: [] } })),
      resumeRun: jest.fn(async runId => ({ run: { runId, conversationId: 'c_12345678', stateVersion: 2, fileReferences: [] } })),
      updateRun: jest.fn(async (runId, payload) => ({ run: { runId, conversationId: 'c_12345678', ...payload } })),
    };
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
    jest.doMock('../src/api', () => ({ api }));
  });

  it('creates once with a stable idempotency key and metadata-only file reference', async () => {
    const { createOrResolveRun, metadataReference } = require('../src/persistentRun');
    const attachment = { kind: 'file', name: 'notes.txt', mimeType: 'text/plain', text: 'private content' };
    const run = await createOrResolveRun({ ownerId: 'user-a', conversationId: 'c_12345678', objective: 'Review notes', fileReference: attachment, token: 'tok' });
    expect(run.runId).toBe('run_c_12345678');
    expect(api.createRun).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'c_12345678',
      idempotencyKey: 'mobile:c_12345678',
      fileReferences: [metadataReference(attachment)],
    }), 'tok');
    expect(JSON.stringify(api.createRun.mock.calls[0][0])).not.toContain('private content');
  });

  it('refetches after a conflict without replaying the stale patch', async () => {
    const { createOrResolveRun, updatePersistentRun } = require('../src/persistentRun');
    await createOrResolveRun({ ownerId: 'user-a', conversationId: 'c_12345678', objective: 'Task', token: 'tok' });
    const conflict = Object.assign(new Error('stale'), { code: 'VERSION_CONFLICT', status: 409 });
    const authoritative = { runId: 'run_c_12345678', stateVersion: 2, checkpoint: { kind: 'client-b' } };
    api.getRun.mockResolvedValue({ run: authoritative });
    api.updateRun.mockRejectedValueOnce(conflict);
    await expect(updatePersistentRun({ ownerId: 'user-a', conversationId: 'c_12345678', token: 'tok', patch: { stateVersion: 1, checkpoint: { kind: 'mobile' } }, retryConflict: true })).rejects.toBe(conflict);
    expect(api.getRun).toHaveBeenCalledWith('run_c_12345678', 'tok');
    expect(api.updateRun).toHaveBeenCalledTimes(1);
    expect(api.updateRun).toHaveBeenCalledWith('run_c_12345678', expect.objectContaining({ stateVersion: 1 }), 'tok');
    expect(conflict.currentRun).toEqual(authoritative);
    expect(authoritative.checkpoint).toEqual({ kind: 'client-b' });
  });

  it('preserves the original 409 when reconciliation fetch fails', async () => {
    const { createOrResolveRun, updatePersistentRun } = require('../src/persistentRun');
    await createOrResolveRun({ ownerId: 'user-a', conversationId: 'c_12345678', token: 'tok' });
    const conflict = Object.assign(new Error('stale'), { code: 'VERSION_CONFLICT', status: 409 });
    api.updateRun.mockRejectedValue(conflict);
    api.getRun.mockRejectedValue(new Error('offline'));
    await expect(updatePersistentRun({ ownerId: 'user-a', conversationId: 'c_12345678', token: 'tok', patch: { stateVersion: 1 } })).rejects.toBe(conflict);
    expect(api.updateRun).toHaveBeenCalledTimes(1);
  });

  it('discovers an existing server run on a fresh device before creating', async () => {
    const { createOrResolveRun } = require('../src/persistentRun');
    api.discoverRun.mockResolvedValueOnce({ run: {
      runId: 'run_server', conversationId: 'c_12345678', stateVersion: 4, fileReferences: [],
    } });
    const run = await createOrResolveRun({ ownerId: 'user-a', conversationId: 'c_12345678', objective: 'Task', token: 'tok' });
    expect(run.runId).toBe('run_server');
    expect(api.createRun).not.toHaveBeenCalled();
    expect(api.getRun).not.toHaveBeenCalled();
  });

  it('refreshes a stale local mapping from the server discovery result', async () => {
    const { createOrResolveRun, getPersistentRun } = require('../src/persistentRun');
    await createOrResolveRun({ ownerId: 'user-a', conversationId: 'c_12345678', objective: 'Task', token: 'tok' });
    api.discoverRun.mockResolvedValueOnce({ run: {
      runId: 'run_reconciled', conversationId: 'c_12345678', stateVersion: 7, fileReferences: [],
    } });
    const run = await getPersistentRun({ ownerId: 'user-a', conversationId: 'c_12345678', token: 'tok' });
    expect(run.runId).toBe('run_reconciled');
    expect(api.getRun).not.toHaveBeenCalledWith('run_' + 'c_12345678', 'tok');
  });

  it('does not reuse another user\'s local run mapping', async () => {
    const { createOrResolveRun } = require('../src/persistentRun');
    await createOrResolveRun({ ownerId: 'user-a', conversationId: 'c_12345678', objective: 'A', token: 'tok-a' });
    await createOrResolveRun({ ownerId: 'user-b', conversationId: 'c_12345678', objective: 'B', token: 'tok-b' });
    expect(api.createRun).toHaveBeenCalledTimes(2);
    expect(api.createRun.mock.calls[1][1]).toBe('tok-b');
  });
});
