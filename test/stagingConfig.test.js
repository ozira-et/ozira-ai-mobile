describe('explicit staging configuration boundary', () => {
  const names = ['EXPO_PUBLIC_OZIRA_ENV', 'EXPO_PUBLIC_OZIRA_API_BASE', 'EXPO_PUBLIC_OZIRA_SUPABASE_URL', 'EXPO_PUBLIC_OZIRA_SUPABASE_PUBLISHABLE_KEY'];
  const saved = {};
  const api = 'https://ozira-ai-staging-staging.up.railway.app';
  const db = 'https://gdydxlmidnshluvpynml.supabase.co';
  const publicFixture = 'sb_publishable_synthetic_test_fixture_only';
  beforeEach(() => {
    jest.resetModules();
    for (const name of names) { saved[name] = process.env[name]; delete process.env[name]; }
  });
  afterEach(() => {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
    }
  });
  function staging() {
    Object.assign(process.env, { EXPO_PUBLIC_OZIRA_ENV: 'staging', EXPO_PUBLIC_OZIRA_API_BASE: api,
      EXPO_PUBLIC_OZIRA_SUPABASE_URL: db, EXPO_PUBLIC_OZIRA_SUPABASE_PUBLISHABLE_KEY: publicFixture });
  }
  it('preserves production defaults when staging is not selected', () => {
    const c = require('../src/config').config;
    expect(c.IS_STAGING).toBe(false);
    expect(c.API_BASE).toBe('https://ozira-ai-production.up.railway.app');
    expect(c.SUPABASE_URL).toBe('https://gmdsprtbbqnjubbpytfc.supabase.co');
  });
  it('accepts complete staging configuration', () => {
    staging(); const c = require('../src/config').config;
    expect(c.API_BASE).toBe(api); expect(c.SUPABASE_URL).toBe(db); expect(c.IS_STAGING).toBe(true);
  });
  it.each(names.slice(1))('rejects missing %s', name => {
    staging(); delete process.env[name]; expect(() => require('../src/config')).toThrow(/Staging/);
  });
  it.each(['https://ozira-ai-production.up.railway.app', 'http://127.0.0.1:8081', 'http://localhost:3000', api + '.evil.invalid', api + '/api', api + '?target=other', 'https://user:pass@ozira-ai-staging-staging.up.railway.app'])('rejects unsafe staging API %s', value => {
    staging(); process.env.EXPO_PUBLIC_OZIRA_API_BASE = value;
    expect(() => require('../src/config')).toThrow(/Staging/);
  });
  it.each(['https://gmdsprtbbqnjubbpytfc.supabase.co', 'http://gdydxlmidnshluvpynml.supabase.co', db + '/auth/v1'])('rejects wrong staging database %s', value => {
    staging(); process.env.EXPO_PUBLIC_OZIRA_SUPABASE_URL = value;
    expect(() => require('../src/config')).toThrow(/Staging/);
  });
  it.each(['sb_secret_synthetic_not_a_real_key', '<publishable-key>', 'undefined', 'eyJsynthetic.not.a.key'])('rejects non-publishable input without reflecting it (%s)', value => {
    staging(); process.env.EXPO_PUBLIC_OZIRA_SUPABASE_PUBLISHABLE_KEY = value;
    try { require('../src/config'); throw new Error('accepted'); }
    catch (error) { expect(error.message).toMatch(/Staging/); expect(error.message).not.toContain(value); }
  });
  it('normalizes one harmless trailing slash without changing the origin', () => {
    staging(); process.env.EXPO_PUBLIC_OZIRA_API_BASE += '/'; process.env.EXPO_PUBLIC_OZIRA_SUPABASE_URL += '/';
    const c = require('../src/config').config;
    expect(c.API_BASE).toBe(api); expect(c.SUPABASE_URL).toBe(db);
  });
});
