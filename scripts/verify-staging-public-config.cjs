// Read-only staging build preflight. Never log credentials or response bodies.
const assert = require('node:assert/strict');
async function main() {
  const api = process.env.EXPO_PUBLIC_OZIRA_API_BASE;
  const url = process.env.EXPO_PUBLIC_OZIRA_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_OZIRA_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(api === 'https://ozira-ai-staging-staging.up.railway.app', 'API target missing or different');
  assert.ok(url === 'https://gdydxlmidnshluvpynml.supabase.co', 'Supabase target missing or different');
  assert.ok(/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key || ''), 'staging publishable key missing or malformed');
  const response = await fetch(url + '/auth/v1/settings', { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
  assert.ok(response.status === 200, 'staging public-key probe HTTP ' + response.status);
  console.log('Staging API/project targets and publishable key: PASS (read-only HTTP 200).');
}
main().catch(error => { console.error('Staging configuration preflight failed:', error.message, '(credentials withheld)'); process.exitCode = 1; });
