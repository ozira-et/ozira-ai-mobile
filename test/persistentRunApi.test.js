describe('mobile Persistent Run API contract', () => {
  let api;
  let seen;

  beforeEach(() => {
    jest.resetModules();
    seen = null;
    global.fetch = jest.fn(async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => ({ run: { runId: 'run_1', stateVersion: 0 } }) };
    });
    api = require('../src/api').api;
  });

  it.each([
    ['createRun', '/api/runs', { objective: 'Task' }],
    ['getRun', '/api/runs/get', { runId: 'run_1' }],
    ['discoverRun', '/api/runs/discover', { conversationId: 'c_12345678' }],
    ['updateRun', '/api/runs/update', { runId: 'run_1', stateVersion: 0 }],
    ['resumeRun', '/api/runs/resume', { runId: 'run_1' }],
  ])('%s uses the canonical endpoint and bearer session', async (method, path, body) => {
    if (method === 'createRun') await api[method](body, 'session-token');
    else if (method === 'discoverRun') await api[method](body.conversationId, 'session-token');
    else if (method === 'updateRun') await api[method](body.runId, { stateVersion: body.stateVersion }, 'session-token');
    else await api[method](body.runId, 'session-token');
    expect(seen.url).toContain(path);
    expect(seen.init.headers.authorization).toBe('Bearer session-token');
    expect(JSON.parse(seen.init.body)).toEqual(expect.objectContaining(body));
  });
});
