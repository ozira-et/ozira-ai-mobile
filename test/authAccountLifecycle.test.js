describe('auth ownership lifecycle', () => {
  let React, renderer, AuthProvider, useAuth, authEvent, current, api, local, restore, mounts;
  const user = id => ({ access_token: 'synthetic-' + id, user: { id, email: id + '@example.invalid' } });
  const flush = async callback => renderer.act(async () => { if (callback) callback(); await Promise.resolve(); });
  beforeEach(() => {
    jest.resetModules(); global.IS_REACT_ACT_ENVIRONMENT = true; mounts = 0;
    React = require('react'); renderer = require('react-test-renderer');
    const sessions = require('../src/accountSession');
    restore = jest.fn(async () => ({ data: { session: null } }));
    api = { setToken: (token, owner) => sessions.setAccountSession(token, owner), absUrl: value => value,
      api: { profile: jest.fn(async token => ({ profile: { name: token } })), saveProfile: jest.fn(async patch => ({ profile: patch })) } };
    local = { getProfile: jest.fn(async () => ({})), replaceProfile: jest.fn(async (_p, _owner, scope) => sessions.assertCurrentAccount(scope)) };
    jest.doMock('../src/api', () => api);
    jest.doMock('../src/localStore', () => local);
    jest.doMock('../src/supabase', () => ({ supabase: {
      auth: { getSession: () => restore(), onAuthStateChange: fn => { authEvent = fn; return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => {} },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: {} }) }) }) }),
    } }));
    ({ AuthProvider, useAuth } = require('../src/context/AuthContext'));
  });
  let tree;
  async function mount() {
    function Probe() { current = useAuth(); React.useEffect(() => { mounts++; }, []); return null; }
    await flush(() => { tree = renderer.create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  }
  afterEach(async () => { if (tree) await flush(() => tree.unmount()); tree = null; });
  it('a late A profile cannot replace B, and account switch remounts children', async () => {
    let release;
    api.api.profile.mockImplementation(token => token.endsWith('A') ? new Promise(resolve => { release = resolve; }) : Promise.resolve({ profile: { name: 'B' } }));
    await mount(); await flush(() => authEvent('SIGNED_IN', user('A')));
    const aMounts = mounts; await flush(() => authEvent('SIGNED_IN', user('B')));
    await flush(() => release({ profile: { name: 'A' } }));
    expect(current.user.id).toBe('B'); expect(current.user.name).toBe('B'); expect(mounts).toBeGreaterThan(aMounts);
    expect(local.replaceProfile.mock.calls.every(call => call[1] === 'B')).toBe(true);
  });
  it('same-owner token refresh does not reset the workspace', async () => {
    await mount(); await flush(() => authEvent('SIGNED_IN', user('A'))); const count = mounts;
    await flush(() => current.updateProfile({ name: 'loaded profile' }));
    api.api.profile.mockImplementation(() => new Promise(() => {}));
    await flush(() => authEvent('TOKEN_REFRESHED', { ...user('A'), access_token: 'synthetic-A-refreshed' }));
    expect(mounts).toBe(count); expect(current.user.id).toBe('A'); expect(current.user.name).toBe('loaded profile');
  });
  it('late startup restoration cannot undo a newer signout event', async () => {
    let release; restore.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    await mount(); await flush(() => authEvent('SIGNED_OUT', null));
    await flush(() => release({ data: { session: user('A') } }));
    expect(current.user).toBe(null); expect(current.token).toBe(null);
  });
  it('late profile mutation cannot merge into a replacement user', async () => {
    await mount(); await flush(() => authEvent('SIGNED_IN', user('A')));
    let release; api.api.saveProfile.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const pending = current.updateProfile({ name: 'A edit' });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'ACCOUNT_SESSION_CHANGED' });
    await flush(() => authEvent('SIGNED_IN', user('B')));
    await flush(() => release({ profile: { name: 'A edit' } })); await rejected;
    expect(current.user.id).toBe('B'); expect(current.user.name).not.toBe('A edit');
  });
});
