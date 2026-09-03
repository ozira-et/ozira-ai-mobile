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

export const config = {
  IS_STAGING: isStaging,
  // Your deployed OZIRA backend (change to your custom domain when ready)
  API_BASE: apiBase,

  // ---- Supabase (Auth source of truth + Postgres) ----
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,

  SENTRY_DSN: '',              // https://...ingest.sentry.io/...
};
