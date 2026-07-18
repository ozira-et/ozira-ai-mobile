// OZIRA AI — runtime configuration.
// Phase 1 talks to your existing Railway backend. Phase 2 keys (Clerk, Supabase,
// Sentry) are placeholders here — see ARCHITECTURE.md for how they slot in.
export const config = {
  // Your deployed OZIRA backend (change to your custom domain when ready)
  API_BASE: 'https://ozira-ai-production.up.railway.app',

  // ---- Phase 2 (not used yet) ----
  CLERK_PUBLISHABLE_KEY: '',   // pk_test_... from clerk.com
  SUPABASE_URL: '',            // https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',       // public anon key
  SENTRY_DSN: '',              // https://...ingest.sentry.io/...
};
