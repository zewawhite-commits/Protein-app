# Launch steps (do these once, in this order)

About 20 minutes in total. Nothing here needs any code.

## 1. Run two SQL files in Supabase (5 min)

These create the tables for AI credits, the AI cost dashboard, saved answers, and the indexes that keep the app fast.

1. Open **supabase.com** → sign in → open your Nutivili project.
2. In the left sidebar click **SQL Editor** (the `>_` icon) → **New query**.
3. On GitHub, open the repo → branch `claude/protein-app-audit-jwq2vx` → `supabase/ai-usage.sql` → click **Raw** → select all → copy.
4. Paste into the Supabase query box → click **Run** (bottom right). You should see "Success. No rows returned".
5. Click **New query** again and do the same with `supabase/scale.sql`.

Both files are safe to run again if you're not sure they worked.

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

## After launch: watch the first month

Profile → Owner dashboard → **AI costs**: real cost per feature, per subscriber, and your margin.
Change credits, costs and limits there; they apply within a minute, no new release.
