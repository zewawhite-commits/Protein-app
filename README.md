# Protein

A premium, mobile-first protein tracker. Weigh your food, pick it from the USDA database, and the protein is calculated for you. Installable as a PWA and works offline.

## Features

- **International food database** — 13,656 foods searched locally and offline:
  - USDA FoodData Central **SR Legacy** (7,282 ingredients and basic foods)
  - USDA **FNDDS** (5,347 foods and mixed dishes as eaten, including curries, biryani, pad thai, sushi, ramen, falafel, dumplings, enchiladas…)
  - **FAO/INFOODS West African Food Composition Table 2019** (1,027 foods: fufu, jollof dishes, bambara groundnut, plantain dishes…)
- **Packaged products worldwide** — live search of Open Food Facts (3M+ products, label values per 100 g).
- **Snap your food** — in-app camera (or gallery). Claude vision identifies each food in the photo, from any cuisine, and suggests matching database records plus a rough portion estimate. You pick the match and weigh it. The AI never supplies nutrient values.
- **Raw / cooked / dry kept separate** — every record is tagged, filterable, and the add sheet tells you when to weigh. It offers the cooked (or raw) version of the same food in one tap.
- **Weight entry in grams** — keypad, ±5 g steppers, quick weights and USDA household portions.
- **Full nutrition tracking** — calories, protein, carbs, fat and fibre, plus sugars, saturated fat, cholesterol, sodium, potassium, calcium, iron, magnesium, zinc and vitamins A, C, D, B12 and folate, scaled from per-100 g source values and shown with % of the FDA daily value.
- **Calorie and macro targets** — estimated from weight, height, age, sex, activity and goals (Mifflin–St Jeor; ~20% deficit for fat loss, ~10% surplus for muscle gain, 1,200/1,500 kcal floors), or set by hand. Fat 30% of energy, fibre 14 g per 1,000 kcal, carbs the rest.
- **Groups (social)** — private groups joined by invite code: share a meal (with photo and app-calculated totals), react, comment, see members' streaks. Needs Supabase accounts and `supabase/social.sql`.
- **Sign-up interview** — goals, workouts per week, diet, cuisines and allergies, body data, goal weight with pace slider and time-to-goal, obstacles, trainer/dietitian, reminders, then a plan screen with a progress curve and editable daily targets.
- **AI coach** — chat that knows the user's goals, targets and today's food; suggests local foods as tappable cards whose numbers come from the database.
- **Daily goal** — fixed grams or g/kg body weight (kg or lb). When you change the goal, past days keep the goal they had.
- **Daily log** — grouped by meal, with a week strip of progress rings and a streak counter.
- **History** — by day with search, plus a photo gallery.
- **Insights** — 7/30/90-day charts against the goal, averages, days the goal was hit, best day, breakdown by meal, top protein sources.
- **Food photos** — camera or gallery, downscaled and stored in IndexedDB.
- **Profile** — dark, light or auto theme, JSON backup export and restore, delete all data.
- **Onboarding** — goal, activity level and diet questions; suggests a protein target (0.8–2.0 g/kg, with sources) and tailors food suggestions to the diet.
- **Accounts** — optional sign-in with Google or email (Supabase), with cloud sync across phones.
- **Plans** — Free, Plus and Pro (monthly or yearly) via Paystack; Plus/Pro unlock AI photo recognition with monthly scan allowances; prices come live from the Paystack plans.
- **Admin** — browse USDA records (read-only, linked to FDC), and create, edit or archive custom records. Custom records require a cited source and pass sanity checks.

## Nutritional accuracy

- All USDA values are copied verbatim by `scripts/build-foods.mjs` from the official CSV. Missing values stay `null` and are shown as "—". Totals that include a missing value are marked with `*`.
- Each log entry stores a snapshot of the values it was logged with, so later edits never rewrite history.
- `src/lib/nutrition.ts` holds all the calculations. It is pure and deterministic, with no AI involved.
- AI lives only in `src/lib/recognition.ts` (identification) and returns names, search terms, raw/cooked state and a portion *estimate* labelled as such. Every logged number comes from the record the user confirms.
- Some foods are not in any bundled table yet (e.g. jollof rice, attiéké). The app then offers similar records, product search, or a custom record that must cite its source. It never invents values.

### Rebuilding the food data

```bash
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip
curl -LO https://www.fao.org/fileadmin/user_upload/faoweb/2020/WAFCT_2019.xlsx
unzip FoodData_Central_sr_legacy_food_csv_2018-04.zip -d /tmp/usda
unzip FoodData_Central_survey_food_csv_2024-10-31.zip -d /tmp/usda
pip install openpyxl && python3 scripts/convert-wafct.py WAFCT_2019.xlsx /tmp/wafct.json
npm run build:foods -- --sr /tmp/usda/FoodData_Central_sr_legacy_food_csv_2018-04 \
  --fndds /tmp/usda/FoodData_Central_survey_food_csv_2024-10-31 --wafct /tmp/wafct.json
```

## AI features (all server-side)

- **Photo recognition** (`api/recognize.ts`): names each food, its local name and cuisine; for mixed dishes it lists likely ingredients (including hidden ones such as cooking oil) so users can log them one by one. Portion sizes are only offered as a labelled estimate; the weight field is always what the user enters.
- **Coach chat** (`api/chat.ts`, `src/lib/coach.ts`): multi-turn chat with the user's profile, targets and today's totals as context. It is told never to state per-food nutrient values; suggested foods are matched to database records only when every query word matches a record (`confidentMatch`), otherwise the user is sent to search. Plus/Pro only when payments are on.
- **Meal ideas** (`api/recommend.ts`): suggests foods eaten in the user's country to close the day's protein gap — names only; the app looks each one up and calculates protein and grams.
- **Learning from corrections** (`api/feedback.ts`): stores, anonymously, which database record people chose for an AI suggestion (table `recognition_feedback`) for human review. Never treated as verified data.
- No AI key is ever stored in the app or on phones.

## Photo recognition setup

Recognition uses Claude (model `claude-opus-5-5`) and needs an Anthropic API key. Either:

- **Hosted (recommended):** deploy to Vercel and set `ANTHROPIC_API_KEY` in the project's Environment Variables. The app calls `api/recognize.ts`, so the key never reaches phones.

Each photo is one API call. Requests enable server-side refusal fallbacks (`fallbacks: "default"`).

## Accounts and cloud sync (Supabase)

Run `supabase/schema.sql`, then `supabase/social.sql` (groups, posts, reactions, comments, photo storage with row-level security) in the Supabase SQL Editor.


Optional sign-in with Google or an email link. Signed-in users' data (profile, log, custom foods) is saved to their account and synced across phones; photos stay on each phone.

1. Create a free project at https://supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql` (tables, row-level security, scan counter).
3. Authentication → Providers → enable **Google** (needs a Google Cloud OAuth client; Supabase shows the redirect URL to paste there) and keep **Email** on.
4. Authentication → URL Configuration → add your app URL(s) to Redirect URLs.
5. App (public) settings — in Vercel env vars, and as GitHub Actions *variables* for Pages:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
6. Server (secret, Vercel only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

With accounts on, subscribing requires signing in, the plan follows the account, and "Restore" needs no receipt.

## Premium subscriptions (Paystack)

Photo recognition through the server is a paid Premium feature when payments are configured. Everything else stays free.

How it works, without a database:
1. `/api/premium/checkout` starts a Paystack checkout for a plan (card, bank transfer, USSD).
2. Paystack returns the customer to `/premium?reference=…`; `/api/premium/activate` verifies the payment with Paystack and issues a signed **Premium pass** (HMAC) valid until the subscription's next payment date (+3 days grace).
3. The app sends the pass with recognition requests. When it nears expiry the app asks `/api/premium/activate` to renew it, which checks the live subscription status on Paystack (active / non-renewing / attention = paid; cancelled / completed = not).
4. `/api/premium/manage` returns Paystack's page for updating the card or cancelling. Restore on a new device = email + payment reference from the Paystack receipt.

Setup:
1. Create a Paystack account and complete business verification.
2. In Paystack → Plans, create the plans you sell and copy each plan code (`PLN_…`). Tiers: **Plus** (e.g. $5.99/month, 100 photo scans a month) and **Pro** (e.g. $11.99/month, 400 scans), each monthly and yearly. Charging in USD needs Paystack's approval for your business; otherwise use NGN prices.
3. In Vercel → Project → Settings → Environment Variables add:
   - `PAYSTACK_SECRET_KEY` (test key `sk_test_…` first, live key later)
   - `PAYSTACK_PLAN_PLUS_MONTHLY`, `PAYSTACK_PLAN_PLUS_YEARLY`, `PAYSTACK_PLAN_PRO_MONTHLY`, `PAYSTACK_PLAN_PRO_YEARLY`
   - Optional: `SCAN_LIMIT_PLUS` (default 100), `SCAN_LIMIT_PRO` (default 400). Limits are enforced when Supabase is set up.
   - `PREMIUM_TOKEN_SECRET` (any long random string, keep it secret)
   - `ANTHROPIC_API_KEY`
4. Redeploy. Test with Paystack's test cards, then switch to the live secret key.

Without these variables the app runs free, and the Premium page says Premium isn't available. On GitHub Pages (static hosting, no `api/`) Premium is not available.

## Deploy (get a link for your phone)

1. Go to https://vercel.com/new, sign in with GitHub and import **Protein-app**.
2. Optional: add `ANTHROPIC_API_KEY` under Environment Variables for photo recognition.
3. Deploy. Open the URL on your phone and choose Add to Home Screen.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check + production build with service worker
```

## Stack

React 18 + TypeScript, Vite 5, Tailwind CSS 3 (design tokens in `src/index.css`), Zustand (persisted to localStorage), idb-keyval (photos), vite-plugin-pwa (Workbox), lucide-react icons, Plus Jakarta Sans, Anthropic TypeScript SDK (photo recognition), Vercel Functions (`api/`).

```
scripts/build-foods.mjs   USDA + FAO tables → public/data/foods.json
scripts/convert-wafct.py  FAO West Africa xlsx → JSON
api/recognize.ts          serverless photo recognition endpoint
src/lib/                  types, nutrition maths, food search, dates, photos, hooks
src/store/useStore.ts     single data layer (swap for a backend later)
src/components/           UI primitives, layout/nav, food sheet, entry rows, profile form
src/pages/                Today, AddFood, Snap (camera + AI), History, Insights, Profile, Admin, Onboarding
```

## Data sources and licences

- U.S. Department of Agriculture, Agricultural Research Service. FoodData Central: SR Legacy (2018) and FNDDS 2021–2023 (2024). Public domain. https://fdc.nal.usda.gov/
- Vincent A. et al. 2020. FAO/INFOODS Food Composition Table for Western Africa (2019). Rome, FAO. © FAO 2020. Reuse is permitted for non-commercial products with acknowledgement; **commercial use requires permission from FAO** (copyright@fao.org).
- Open Food Facts, https://world.openfoodfacts.org — Open Database License (ODbL); product data contributed by its community.

### Groups journey
Signed out: a preview (how it works + example posts) with sign-in. Invite links (`/groups?join=CODE`) are remembered through sign-in and offer a one-tap join. Signed in: set up a profile (photo, name, @username), then discover public groups, join with a code or link, or create a private/public group. Inside a group: Feed, Chat and Members tabs.
