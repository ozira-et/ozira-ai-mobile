# OZIRA — Backend Systems Implementation Plan

The backend-heavy items from the Master UI & Settings Spec, spec'd out *before*
coding so we build them once and correctly. The Trusted-Contact crisis feature is
**deferred pending clinical + legal review** and is not covered here.

*Not legal advice. GDPR/CCPA/PCI wording and flows need a lawyer's review.*

---

## 0. Foundation decision (read first)

Most of these systems (sessions, MFA, memory, billing history, connectors) are
**much cleaner on a real database** than on the current JSON-file store, and
safer at scale. Two honest paths:

- **Path A — build on the current JSON store now.** Faster to ship each feature; fine for the current user count. Migrate later.
- **Path B — move to Supabase (Postgres) first, then build on it.** More upfront work, but every system below becomes simpler, safer, and cross-device. Recommended once you have paying users.

Recommendation: **do the two quick wins (Usage, Sessions) on the JSON store now**,
and **do Supabase before MFA + Memory + Billing + Connectors.**

---

## 1. Usage metrics (daily / weekly bars)  — effort: S

The data already exists (`db.messages` has timestamps + credits; plans have quotas).

- **Endpoint:** `GET /api/usage` → `{ daily:{used,limit}, weekly:{used,limit}, monthly:{used,quota}, resetAt }`
- **Logic:** sum this user's `credits` from `db.messages` where `at` is within the last 24h / 7d / billing period. `limit` = derived caps in `config` (e.g. `dailyCap`, `weeklyCap`) or a share of the monthly quota.
- **App:** two progress bars on the control panel + a help-desk button linking to `support.ozira.ai`.
- **Providers:** none. **Depends on:** nothing. **Good first build.**

---

## 2. Active sessions + remote logout  — effort: M

Current tokens are stateless JWTs (can't be individually revoked). Add a session registry.

- **Data:** `sessions` = `{ id (jti), userId, device, ip, createdAt, lastSeenAt, revoked }`
- **Auth change:** put a `jti` in each JWT at login; `authUser()` rejects tokens whose session is `revoked` or missing.
- **Endpoints:** `GET /api/sessions` (list, mark current), `POST /api/sessions/revoke {id}`, `POST /api/sessions/revoke-others`.
- **App:** device list + "Log out from other sessions".
- **Providers:** none. **Depends on:** small auth refactor. **Second build.**

---

## 3. MFA — effort: M (TOTP) + M/H (SMS)

### 3a. Authenticator app (TOTP) — no provider needed
- **Data:** on user: `mfaSecret` (encrypted), `mfaEnabled`.
- **Flow:** `POST /api/mfa/totp/setup` → returns `otpauth://` URI + QR for the authenticator app; `POST /api/mfa/totp/verify {code}` enables it; login then requires a TOTP code when `mfaEnabled`.
- **Implementation:** RFC-6238 TOTP can be done with Node `crypto` (no dependency) or a tiny lib.

### 3b. SMS OTP — needs an SMS provider
- **Provider:** an **Ethiopian SMS gateway** (e.g. AfroMessage / GeezSMS) for cost + deliverability; Twilio for international. Costs per SMS + an API key.
- **Flow:** user adds phone → send OTP → verify → store verified phone; login sends OTP as second factor.
- **Note:** SMS is the weaker factor (SIM-swap risk); TOTP first is the better default.

**Passkeys / security keys (WebAuthn):** honestly **not practical in Expo Go**, and
hard on React Native generally. Recommend **deferring** or covering the "device
security" need with the **Face ID / biometric app-lock** (the `expo-local-authentication`
install already in flight) instead of full WebAuthn passkeys.

---

## 4. Memory vault  — effort: M (manual) → H (auto)

- **v1 (manual, recommended):** user-managed facts. `memory` = `[{ id, text, createdAt }]` on the profile/account. Master on/off toggle. Each item has a trash icon (per-spec). Facts are injected into the AI system prompt (like custom instructions, but structured + individually deletable).
- **v2 (auto):** after a chat, an AI step extracts durable facts ("user is a teacher in Addis") and adds them to the vault (still user-deletable). Costs an extra AI call per conversation.
- **Storage:** local now (cheap, private) or backend for cross-device (with Supabase). **Endpoints (if backend):** `GET/POST/DELETE /api/memory`.
- **Providers:** none (uses your existing AI). **Depends on:** memory storage choice.

---

## 5. Billing management  — effort: M (receipts/cancel) + H/uncertain (cards/recurring)

- **View + receipts:** `db.payments` per user already exists. `GET /api/billing` → current plan, status, renew date, payment history; generate a **receipt** (PDF/text) per payment. Straightforward.
- **Change / cancel plan:** cancel = mark subscription `autoRenew:false`; change = new checkout. Doable.
- **⚠️ Card management + true recurring:** **Chapa is mostly one-time checkout** — it does not store cards for you like Stripe does. So "edit saved card" and automatic monthly renewal are **provider-limited**. Options: (a) monthly re-checkout reminder, (b) use Chapa's recurring/subscription API *if available in your account*, (c) route recurring international billing through the **UAE entity + Stripe** (from the marketplace blueprint). This needs a decision, not just code.

---

## 6. Connectors (auto / manual sync + marketplace)  — effort: H

Real connectors = **OAuth per service + encrypted token storage + a sync engine**.
This is the Phase-2 platform that ties into **Supabase (storage) + Inngest
(background sync jobs)** from `ARCHITECTURE.md`.

- **v1 already shipped:** the Connectors screen (Telegram live, others "coming soon").
- **Next:** pick the first real OAuth connector (Google Drive or Gmail), build the OAuth flow + token store, then the **auto/manual sync** toggle per connector, then the **marketplace `+`** directory. Each new service is incremental after the first.
- **Depends on:** Supabase + Inngest. **Biggest of the six — do last.**

---

## 7. Storage ledger (bonus, easy)  — effort: S

- **Endpoint:** `GET /api/storage` → bytes used by **images** vs **files** (sum file sizes in the user's volume folder) + a cap from config.
- **App:** the storage progress bar + Library filter (ALL / IMAGES / FILES).
- **Providers:** none.

---

## Recommended build order

1. **Usage metrics** (S) — data already there.
2. **Storage ledger + Library filters** (S).
3. **Active sessions + remote logout** (M) — security, no provider.
4. **TOTP MFA** (M) — no provider; SMS MFA after an SMS gateway is chosen.
5. **→ Supabase migration** (foundation) — do before the next three.
6. **Memory vault** (M) on Supabase.
7. **Billing** — receipts + cancel first; card/recurring after the Chapa-vs-Stripe decision.
8. **Connectors** OAuth platform (H) — last, on Supabase + Inngest.

Deferred: **Trusted-Contact crisis alerts** (clinical + legal review), **WebAuthn
passkeys** (impractical on mobile — use biometric app-lock instead).

---

## Decisions needed from you

1. **Path A vs Path B** (JSON store now, or Supabase first for the security/memory/billing tier).
2. **SMS provider** for SMS MFA (AfroMessage / GeezSMS / Twilio) — or skip SMS, TOTP only.
3. **Billing:** accept Chapa's one-time model (monthly re-checkout) or set up recurring via Stripe on the UAE entity.
4. **Memory storage:** on-device or account-synced.
