// OZIRA AI — runtime configuration.
// Build-time Expo overrides make local/staging acceptance possible while the
// production defaults remain unchanged. Only public Supabase values belong in
// this client; server credentials must never be added here.
const isStaging = process.env.EXPO_PUBLIC_OZIRA_ENV === 'staging';
const apiBase = process.env.EXPO_PUBLIC_OZIRA_API_BASE || (isStaging ? '' : 'https://ozira-ai-production.up.railway.app');
const supabaseUrl = process.env.EXPO_PUBLIC_OZIRA_SUPABASE_URL || (isStaging ? '' : 'https://gmdsprtbbqnjubbpytfc.supabase.co');
const supabaseAnonKey = process.env.EXPO_PUBLIC_OZIRA_SUPABASE_PUBLISHABLE_KEY || (isStaging ? '' : 'sb_publishable_XB5OLYAkYLz50BknZomVMw_7duvrRRi');

if (isStaging && (!apiBase || !supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Staging mobile builds require explicit API and Supabase publishable configuration.');
}

// This acceptance profile is bound to the approved staging services. Presence
// alone is insufficient: a staging flag must not enable diagnostics against
// production or send authentication to an unintended project.
if (isStaging) {
  const approvedApi = 'https://ozira-ai-staging-staging.up.railway.app';
  const approvedSupabase = 'https://gdydxlmidnshluvpynml.supabase.co';
  const matchesOrigin = (value, origin) => value === origin || value === origin + '/';
  if (!matchesOrigin(apiBase, approvedApi) || !matchesOrigin(supabaseUrl, approvedSupabase)) {
    throw new Error('Staging mobile configuration must use the approved staging API and Supabase project.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(supabaseAnonKey)) {
    throw new Error('Staging mobile configuration requires a publishable client key, never a server credential.');
  }
}

export const config = {
  IS_STAGING: isStaging,
  // Your deployed OZIRA backend (change to your custom domain when ready)
  API_BASE: isStaging ? apiBase.replace(/\/$/, '') : apiBase,

  // ---- Supabase (Auth source of truth + Postgres) ----
  SUPABASE_URL: isStaging ? supabaseUrl.replace(/\/$/, '') : supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,

  SENTRY_DSN: '',              // https://...ingest.sentry.io/...
};
