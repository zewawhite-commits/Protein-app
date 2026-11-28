# Launch steps (do these once, in this order)

About 20 minutes in total. Nothing here needs any code.

## 1. Run two SQL files in Supabase (5 min)

These create the tables for AI credits, the AI cost dashboard, saved answers, and the indexes that keep the app fast.

1. Open **supabase.com** → sign in → open your Nutivili project.
2. In the left sidebar click **SQL Editor** (the `>_` icon) → **New query**.
3. On GitHub, open the repo → branch `claude/protein-app-audit-jwq2vx` → `supabase/ai-usage.sql` → click **Raw** → select all → copy.
4. Paste into the Supabase query box → click **Run** (bottom right). You should see "Success. No rows returned".
5. Click **New query** again and do the same with `supabase/scale.sql`.

6. Do the same with `supabase/privacy-messaging.sql` (new: message requests, privacy settings, blocking,
   reports, replies/reactions/edits, private file sharing, notifications). Run it **after** the others.

All files are safe to run again if you're not sure they worked.

## 1b. Turn on "Continue with Google" (3 min)

1. Supabase → **Authentication** → **Sign In / Providers** → **Google** → Enable.
2. It asks for a Google Client ID and Secret: create them at **console.cloud.google.com** → APIs & Services →
   Credentials → Create credentials → OAuth client ID → Web application. Paste the **Callback URL** Supabase shows
   into "Authorised redirect URIs". Copy the Client ID and Secret back into Supabase → Save.
3. Supabase → Authentication → **URL Configuration** → add your site address (and `https://nutivili.com` once the
   domain is connected) under Redirect URLs.

## 1c. Realtime for messages (1 min)

Supabase → **Database** → **Publications** → `supabase_realtime` → make sure `direct_messages`, `dm_reactions`
and `notifications` are ticked (the SQL file tries to add them; this just confirms it).

## 2. Set ADMIN_EMAILS in Vercel (2 min)

This makes you the owner, so you see the Owner dashboard and aren't limited while testing.

1. Open **vercel.com** → your Nutivili project → **Settings** → **Environment Variables**.
2. Key: `ADMIN_EMAILS`. Value: the email you sign in to Nutivili with (several? separate with commas).
3. Tick **Production** (and Preview if you test there) → **Save**.

## 3. Create the two Plus plans in Paystack (5 min)

1. Open **dashboard.paystack.com** → **Products** (or **Payments**) → **Plans** → **Create plan**.
2. Plan 1: name **Nutivili Plus Monthly**, amount **8.99**, currency **USD**, interval **Monthly** → Create.
3. Plan 2: name **Nutivili Plus Yearly**, amount **44.99**, currency **USD**, interval **Annually** → Create.
4. Open each plan and copy its **plan code** (starts with `PLN_`).
5. Back in Vercel → Settings → Environment Variables, add:
   - `PAYSTACK_PLAN_PRO_MONTHLY` = the monthly plan code
   - `PAYSTACK_PLAN_PRO_YEARLY` = the yearly plan code

   ("PRO" is the internal name of Plus; people never see it. If older `PAYSTACK_PLAN_PLUS_…` codes are already
   set, leave them so anyone already subscribed keeps working.)
6. If USD isn't offered on your Paystack account, create the plans in your currency; the app still shows the
   dollar price and tells people their bank converts it.

## 4. Promote the newest deployment (2 min)

Environment variables only apply to new deployments.

1. Vercel → your project → **Deployments**.
2. Find the newest deployment of branch `claude/protein-app-audit-jwq2vx` (top of the list).
3. Click the **⋯** menu → **Redeploy** (so it picks up the new variables) → when it's Ready, **⋯** → **Promote to Production**.
4. Open your live site, sign in with your ADMIN_EMAILS email → **Profile** → **Owner dashboard** should appear.

## 5. Let Claude test real scans and measure their cost (2 min, optional but recommended)

1. Get a key: **console.anthropic.com** → **API keys** → **Create key** → copy it.
2. In the Claude app, open this coding session → the **cloud environment menu** in the session's title bar → **Edit**.
3. Under **Environment variables**, add `ANTHROPIC_API_KEY` = your key → Save.
   (It can't go under Network secrets: Anthropic's own hosts don't accept those. Anyone who uses this
   environment, and commands in its sessions, can read an environment variable.)
4. Start a **new session** (it picks the key up) and ask Claude to "run the real scanner test".
   Never paste the key into the chat.

The live app's key is separate: Vercel → Settings → Environment Variables → `ANTHROPIC_API_KEY` (probably already set).

## Food photos (you approve each one)

Photos only appear once you pick them, so a photo always shows exactly that food.

1. Get a free key at **unsplash.com/developers** → New application → copy the **Access Key**.
2. Vercel → Settings → Environment Variables → add `UNSPLASH_ACCESS_KEY` = that key → redeploy.
3. Supabase → SQL editor → run `supabase/food-photos.sql` (adds the `verified` column).
4. In the app, sign in with your owner email → Profile → **Owner dashboard** → **Food photos**.
   Tap a food under "Need a photo", tap the picture that shows exactly that food,
   or "None of these fit". It moves to the next food automatically.

## After launch: watch the first month

Profile → Owner dashboard → **AI costs**: real cost per feature, per subscriber, and your margin.
Change credits, costs and limits there; they apply within a minute, no new release.

## Worldwide food search (USDA + Open Food Facts)

1. Get a free USDA FoodData Central key: https://fdc.nal.usda.gov/api-key-signup
2. Vercel → Project → Settings → Environment Variables → add `USDA_API_KEY` (all environments) → redeploy.
   Without it the shared demo key is used and USDA results will often be missing.
3. Recommended: run `supabase/food-cache.sql` in the Supabase SQL editor (7-day result cache + indexed store).
4. Weekly housekeeping: `delete from public.food_search_cache where expires_at < now();`

Details, costs and licensing: `docs/food-database-architecture.md`.
