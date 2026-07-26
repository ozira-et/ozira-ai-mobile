# OZIRA — Honest Scale, Cost & Security Blueprint

Written bluntly, as asked. Target: launch in ~1 month, expecting large downloads.
*Cost figures are ballpark ranges — verify current pricing with each provider; prices change.
Not legal/financial advice.*

---

## 0. The hard truth first

"Several million downloads in a month" is **very** aggressive — most strong apps
see thousands to tens of thousands early. Plan for it, but understand two things:

1. **Downloads ≠ active users ≠ cost.** Your cost is driven by *active* users making
   AI calls, not installs. 2M downloads with 100k daily active users is a very
   different (and far more expensive) bill than 2M downloads that mostly churn.
2. **Your current backend cannot survive scale — full stop.** It stores everything
   in a single **JSON file** rewritten on every request. Fine for hundreds of users;
   at thousands it slows; at millions it **falls over** (no concurrency, data loss,
   one server). This must be fixed before real traffic, regardless of anything else.

---

## 1. What breaks at scale (fix order)

| # | Problem | Fix | Urgency |
|---|---|---|---|
| 1 | JSON-file "database" | Migrate to **Supabase (Postgres)** | **Mandatory** |
| 2 | Homegrown auth, `authSecret = "CHANGE_ME"` | **Supabase Auth** + rotate all secrets | **Mandatory / security** |
| 3 | Uncapped AI spend | Enforce caps (done) + model unit economics | **Mandatory / cost** |
| 4 | Single Node server | Horizontal scaling + CDN + DB pooling | High (near scale) |
| 5 | No error visibility | **Sentry** | High |

---

## 2. Cost reality (ranges — the AI bill is the one that matters)

- **AI (OpenRouter/Gemini/Claude) — THE big one.** Every chat costs real money
  (≈ cents to dollars). Rough math: if an *active* user costs you ~$1/month in AI,
  then **100k active users = ~$100k/month**; millions = **$1M+/month**. This is what
  bankrupts AI apps — not the plugins. **You must model revenue-per-user vs
  AI-cost-per-user**, and gate free users hard (small daily cap, cheap model only).
- **Supabase:** free tier → Pro ~$25/mo → hundreds-to-low-thousands/mo at real scale.
- **Supabase Auth:** effectively free for auth at your stage; scales far cheaper than Clerk.
- **Clerk (dropped):** would have been tens of thousands/month at millions of MAU — the right call to drop it.
- **Sentry:** free → ~$26/mo → modest at scale.
- **Hosting (Railway):** $5–20/mo small → hundreds/mo mid → at true scale, dedicated infra.
- **Payment fees:** Chapa/Telebirr/Stripe take a % per transaction — factor into pricing.

**Bottom line:** your survival number is **AI cost per active user vs what they pay you.**
Nail that before you spend on anything else.

---

## 3. Security must-fixes before launch

- **Rotate every exposed key** (OpenRouter, Anthropic, Gemini, Telegram — all pasted in chats/repo) and move them to env vars only.
- **Replace `authSecret`** — it's literally `"CHANGE_ME_..."`, a live hole. (Supabase Auth removes this problem entirely.)
- **Enable Supabase Row-Level Security** so users only see their own data.
- **Never store card numbers** — hosted checkout only (Chapa/Stripe handle PCI).
- **Rate limiting + abuse protection** on the AI endpoints (bots can burn your AI budget fast).
- **Privacy policy + data residency** disclosed (Supabase region), account delete/export (you have these).

---

## 4. Auth decision (made): Supabase Auth

Replaces Clerk. Gives email/password + Google/Apple + phone, **works in Expo Go**
(no dev build), far cheaper at millions, one fewer service. Clerk's polish isn't
worth the cost + the dev-build wall for your situation.

---

## 5. Hosting at scale (revisit near launch)

Railway is fine to launch and to a point. For millions of concurrent-ish users:
- Run **multiple backend instances** behind a load balancer (Railway scales, or move to a cloud with autoscaling).
- **Connection-pool** the database (Supabase has PgBouncer).
- **CDN** for images and static assets.
- **Cache** hot reads. Consider a queue (Inngest/others) for heavy async work.

---

## 6. Realistic pre-launch priority order (1 month)

1. **Freeze new features.** You have plenty. Harden what exists.
2. **Rotate keys + fix `authSecret`** (day 1 — security).
3. **Migrate to Supabase** (DB + Auth). This is the big one.
4. **Lock down AI economics** — free-tier caps, cheap models for free users, model the numbers.
5. **Add Sentry.**
6. **Load-test** (simulate concurrent users) and set up scaling + CDN.
7. **Then** submit to stores (needs an EAS build regardless).

Honest note: a *scale-ready, secure* launch in one month is doable **only if you stop
adding features and focus on the list above.** The riskiest items are the DB migration
and the AI cost model — start those now.

---

## 7. What you're NOT losing by dropping Clerk
Email/password, Google/Apple sign-in, phone auth, sessions — all covered by Supabase
Auth. You lose Clerk's prettier prebuilt components and org features. Not worth the
cost or the Expo-Go wall.
