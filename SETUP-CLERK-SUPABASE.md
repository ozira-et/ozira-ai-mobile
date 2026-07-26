# OZIRA — Clerk + Supabase setup (do these, then send me the keys)

You do Parts 1–3 (accounts + config). Then I wire Parts 4–6 (app + backend code).
We can stay in **Expo Go** for email/password; native Apple/Google needs a dev
build later. *Not legal advice — pick a Supabase region and disclose it in your
privacy policy.*

---

## Part 1 — Clerk (authentication)

1. Go to **clerk.com** → sign up → **Create application**. Name it **OZIRA AI**.
2. Under **sign-in options**, enable **Email** + **Password**. (Google/Apple can be added later — they need a dev build.)
3. Go to **API Keys** (or the app's Home). Copy:
   - **Publishable key** — starts `pk_test_...` (or `pk_live_...`)
   - **Secret key** — starts `sk_test_...`
4. Note your **Clerk Frontend API URL / domain** — looks like `https://your-app-name.clerk.accounts.dev` (Configure → Domains, or the "Frontend API" value). Supabase needs this.

Send me: the **publishable key** and the **domain**. Keep the **secret key** private (it goes in Railway as an env var; don't paste it publicly if you can avoid it).

---

## Part 2 — Supabase (database)

1. Go to **supabase.com** → sign up → **New project**. Name it **ozira**.
2. **Region:** pick the one closest to your users. For Ethiopia + EU users, **EU (Frankfurt)** is a good, compliance-friendly choice. Set a strong database password (save it).
3. Once it's ready: **Project Settings → API**. Copy:
   - **Project URL** — `https://xxxx.supabase.co`
   - **anon public key**
   - **service_role key** (secret — keep private)

### 2b. Connect Clerk to Supabase (native third-party auth)
4. In Supabase → **Authentication → Sign In / Providers → Third-Party Auth** → **Add provider → Clerk**.
5. Paste your **Clerk domain** (from Part 1, step 4). Save. (This lets Supabase trust Clerk's login tokens — no shared secrets.)

### 2c. Create the tables
6. In Supabase → **SQL Editor** → **New query** → paste **all** of the SQL below → **Run**.

```sql
-- Core tables. id = Clerk user id (text) via auth.jwt()->>'sub'.
create table if not exists users (
  id text primary key,
  name text,
  email text,
  plan text default 'free',
  credits_used int default 0,
  created_at timestamptz default now()
);
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text,
  source text,
  folder text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id text not null,
  role text,
  content text,
  model text,
  created_at timestamptz default now()
);
create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  prompt text,
  storage_path text,
  model text,
  created_at timestamptz default now()
);
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  value text,
  model text,
  excerpt text,
  created_at timestamptz default now()
);
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_id text,
  status text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Row Level Security: each user sees only their own rows.
alter table users         enable row level security;
alter table conversations enable row level security;
alter table messages      enable row level security;
alter table images        enable row level security;
alter table feedback      enable row level security;
alter table subscriptions enable row level security;

create policy "own_users"    on users         for all using (id = auth.jwt()->>'sub') with check (id = auth.jwt()->>'sub');
create policy "own_convs"    on conversations for all using (user_id = auth.jwt()->>'sub') with check (user_id = auth.jwt()->>'sub');
create policy "own_msgs"     on messages      for all using (user_id = auth.jwt()->>'sub') with check (user_id = auth.jwt()->>'sub');
create policy "own_images"   on images        for all using (user_id = auth.jwt()->>'sub') with check (user_id = auth.jwt()->>'sub');
create policy "own_feedback" on feedback      for all using (user_id = auth.jwt()->>'sub') with check (user_id = auth.jwt()->>'sub');
create policy "own_subs"     on subscriptions for all using (user_id = auth.jwt()->>'sub') with check (user_id = auth.jwt()->>'sub');
```

7. (Optional now) **Storage → New bucket** named **images** for generated images. We'll wire this later.

---

## Part 3 — Send me the keys / set env vars

**Send me (safe to share):** Clerk publishable key, Clerk domain, Supabase Project URL, Supabase anon key.

**Keep private → put in Railway Variables (backend):**
- `CLERK_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**App config (`src/config.js`) — public keys only:** `CLERK_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

---

## Part 4–6 — What I'll build once you send the keys

- **Part 4 (app auth):** install `@clerk/clerk-expo`, wrap the app in `ClerkProvider` (SecureStore token cache), rebuild the login/signup screen on Clerk, and switch `AuthContext` to Clerk (`getToken()`), sending the Clerk token to the backend.
- **Part 5 (backend auth):** change `authUser()` to verify **Clerk** tokens via Clerk's JWKS, and connect the backend to Supabase (service role).
- **Part 6 (data):** move reads/writes to Supabase — starting with users + conversations + images, then the rest — keeping the app working the whole way.

---

## Sequence + honest notes
- Do **Part 1 → Part 2 → Part 3**, then ping me with the four public values.
- We stay in **Expo Go** for email/password. When you want native Apple/Google sign-in (and for the App Store), we move to an **EAS dev build** — I'll guide that.
- The migration is incremental: the app keeps working at every step; nothing goes dark.
