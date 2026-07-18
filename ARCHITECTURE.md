# OZIRA AI — Target Architecture & Integration Blueprint

This documents the full stack you asked for and how each service fits. The Expo
app in this folder is **Phase 1** (runs today against your existing Railway
backend). Phases 2–4 add the rest.

## Services and their roles

| Service | Role | Where it lives |
|---|---|---|
| **Expo (React Native)** | The mobile app (iOS + Android) | this repo |
| **Clerk** (clerk.com) | Authentication: email, Apple & Google sign-in, sessions | app + backend |
| **Supabase** (supabase.com) | Postgres database + file Storage (images) | backend / cloud |
| **Node backend** | AI/chat/credits API (your existing server, refactored) | Railway |
| **Inngest** (inngest.com) | Background jobs (scheduled briefs, async image jobs, emails) | backend |
| **Sentry** (sentry.io) | Crash + error monitoring | app + backend |
| **CodeRabbit** (coderabbit.ai) | AI code review on GitHub pull requests | GitHub (no app code) |
| **ngrok** (ngrok.com) | Expose localhost so Clerk/Inngest webhooks reach your dev machine | dev tool |
| **Context7** (context7.com) | Up-to-date library docs for your AI coding assistant | dev tool (MCP) |

## How auth works (Clerk + Supabase, native integration)

The Clerk JWT template for Supabase was **deprecated (April 2025)**. Use the
**native third-party-auth integration** instead:

1. In **Supabase Dashboard → Authentication → Sign In / Providers → Third-Party Auth**, add **Clerk** and paste your **Clerk domain**. Supabase then verifies Clerk-issued JWTs via Clerk's JWKS endpoint — no shared secrets, no per-request token minting.
2. The Expo app authenticates with **Clerk** (`@clerk/clerk-expo`), gets a session token, and sends it to Supabase and to your Node backend as `Authorization: Bearer <clerk_token>`.
3. Supabase **Row Level Security** policies use the Clerk user id (`auth.jwt()->>'sub'`) so each user only sees their own rows.
4. Your Node backend verifies the same Clerk JWT (via Clerk's JWKS) before serving chat/credits.

## Apple App Store requirement (account deletion)

Apple rejects apps that let users create an account but not delete it. Handle
this with **Clerk webhooks → Inngest → Supabase**:

- `user.created`  → insert a row into Supabase `users` (starter plan, credits).
- `user.updated`  → sync name/email changes.
- `user.deleted`  → delete the user's rows (conversations, images, subscription) and remove their Storage files.

Flow: Clerk sends the webhook → your `/api/webhooks/clerk` endpoint (signature-verified with `svix`) → emits an Inngest event → an Inngest function does the Supabase writes. In dev, use **ngrok** to receive these webhooks on localhost.

## Data model (Supabase Postgres)

- `users` (id = Clerk user id, name, email, plan, credits_used, created_at)
- `conversations` (id, user_id, title, source, created_at)
- `messages` (id, conversation_id, role, content, model, created_at)
- `images` (id, user_id, prompt, storage_path, model, created_at)  ← files in Supabase Storage bucket `images`
- `feedback` (id, user_id, value, model, excerpt, created_at)
- `subscriptions` (id, user_id, plan_id, status, expires_at)

Enable RLS on every table; policy: `user_id = auth.jwt()->>'sub'`.

## Scope note

Per your instruction, the app does **not** include image or video generation as
a core feature set beyond the existing single-image tool. (The current Node
backend's `/api/image` can be disabled by setting `imageGen.enabled=false` if you
want it fully off.)

## Build phases

- **Phase 1 (this folder, done):** Runnable Expo app — design system, drawer, Auth + Chat wired to the Railway backend.
- **Phase 2 — Auth:** Add `@clerk/clerk-expo`, wrap `App.js` in `ClerkProvider` with a SecureStore token cache, replace `AuthContext` internals with Clerk hooks, add Apple/Google sign-in. Set up Supabase project + Clerk third-party auth.
- **Phase 3 — Data + background:** Create Supabase tables + RLS + Storage bucket. Refactor the Node backend to verify Clerk JWTs and read/write Supabase. Add Inngest + the Clerk webhook handler (`user.created/updated/deleted`).
- **Phase 4 — Monitoring + polish:** Add Sentry to the app (`@sentry/react-native`) and backend. Build the remaining screens (Travel, Tools, Plans, API, Account, Settings). Set up CodeRabbit on the repo and Context7 for your AI assistant.

## Env vars you'll need (Phase 2+)

App (`src/config.js`): `CLERK_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN`.
Backend: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `SENTRY_DSN`.
