# Stripe + Supabase Setup

Everything in the code is wired — you just need to set up accounts and paste keys
into Vercel env vars. Do this in **Stripe test mode first**, flip to live when
you've put through one test payment end-to-end.

---

## 1. Supabase (5 min — skip if already done)

You already have `@supabase/supabase-js` installed and the server reads
`SUPABASE_URL` / `SUPABASE_ANON_KEY`. If you haven't created the project yet:

1. [supabase.com](https://supabase.com) → **New project** → pick EU region
   (closest to Belgium).
2. Settings → API → copy **Project URL** and **anon public** key.
3. Add a `profiles` table with this SQL (SQL Editor → New query):

```sql
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text,
  tier                    text default 'free',
  wolf_credits            int  default 100,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

-- Service role (server-side) can do anything — the webhook uses this
-- Nothing needed, service role bypasses RLS automatically.

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

4. Settings → API → also copy the **service_role** key (secret, server-only).

---

## 2. Stripe (10 min)

1. [stripe.com](https://stripe.com) → create account (test mode on by default).
2. Products → **+ Add product**. Create 4 products, each with 2 recurring prices:

| Product  | Monthly      | Annual (billed yearly) |
|----------|--------------|------------------------|
| Starter  | $9 / month   | $108 / year    ($9/mo) |
| Creator  | $29 / month  | $288 / year   ($24/mo) |
| Pro      | $49 / month  | $444 / year   ($37/mo) |
| Elite    | $89 / month  | $708 / year   ($59/mo) |

   After saving each price, copy its **price ID** (starts with `price_...`).

3. Developers → **API keys** → copy the **Secret key** (starts with `sk_test_`).

4. Developers → **Webhooks** → **+ Add endpoint**:
   - URL: `https://lightningwolves.studio/api/stripe-webhook`
     (or your Vercel deployment URL)
   - Events to send: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** (starts with `whsec_`).

---

## 3. Vercel env vars

Project → Settings → Environment Variables. Add all of these
(also add to a local `.env` if you run the server locally):

```
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # server only — never commit

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe price ids (paste from step 2 table)
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_CREATOR_MONTHLY=price_...
STRIPE_PRICE_CREATOR_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_ELITE_MONTHLY=price_...
STRIPE_PRICE_ELITE_ANNUAL=price_...

# Public URL — used for success_url / cancel_url
PUBLIC_APP_URL=https://lightningwolves.studio
```

Re-deploy after adding vars (Vercel doesn't pick them up on the live
deploy automatically).

---

## 4. Test the full loop

1. Open the site → Pricing → pick **Creator / Monthly** → hit **Get Started**.
2. You should bounce to Auth. Sign up with a real email (check inbox for the
   Supabase confirm link). After sign-in, you should auto-redirect to
   Stripe Checkout.
3. Use the Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
4. Checkout success → you land back on the site with
   `⚡ You're on Creator — credits are landing...` banner.
5. Verify in Supabase: `select id, tier, wolf_credits, stripe_customer_id
   from profiles where email = 'you@example.com';` — should show
   `tier = 'creator'` and `wolf_credits = 1295`.

If the tier didn't update: check Stripe → Developers → Webhooks → your
endpoint → latest delivery. If it's red, the `STRIPE_WEBHOOK_SECRET` is
wrong or the endpoint URL is off.

---

## 5. Going live

When you've put through a successful test transaction end-to-end:

1. Stripe dashboard → flip the toggle to **Live mode**.
2. Re-create the 4 products / 8 prices in live mode (test prices don't carry over).
3. Create a new webhook endpoint in live mode → copy the new signing secret.
4. Replace every `sk_test_...`, `whsec_...`, and `price_...` env var with
   the live versions. Keep the test keys in a `.env.test` for local dev.
5. Do one real transaction with your own card, then refund it through the
   Stripe dashboard. This confirms live mode works AND that refund flow is
   clean before any real user pays.

---

## Notes for future-you

- **`TIER_CREDITS` in `server.js`** is the single source of truth for how
  many credits each tier lands with on activation. If you change a tier's
  credit allotment on the pricing page, update it there too.
- **Billing portal** is already wired at `/api/create-portal-session` —
  surface it in the Studio navbar as "Manage billing" when you're ready to
  let subscribers self-serve cancellations.
- **Promoter checkout** (the Golden Board tiers) is still manual invoice-
  based — the code path records intent to localStorage. Once studio subs
  are proven, repeat this same pattern with 3 more Stripe products for the
  promoter tiers and wire them into `PromoterCheckoutPage`.
