# One subscription, website and iPhone

Goal: someone pays once — on the website (Paystack) or in the iPhone app (Apple) — and Plus works everywhere
they sign in.

## How it fits together

| Where they pay | Who takes the money | What the backend stores |
| --- | --- | --- |
| Website (nutivili.com) | Paystack | Paystack customer + subscription code, renewal date |
| iPhone app | Apple (In-App Purchase) | Apple original transaction id, expiry date |

- The account (Supabase user) is the single source of truth. Plus is "on" when **any** active entitlement
  exists for that user, from any source. The app already asks the server for the tier (`/api/usage` → `tier`),
  so an iPhone purchase only needs to add one more source on the server.
- Apple's rules: inside the iPhone app, digital subscriptions must be sold through Apple. People who already
  pay on the website can simply log in on the iPhone and their Plus works (this is allowed). Don't show
  "cheaper on our website" links inside the iOS app unless you've applied for Apple's link entitlement.
- Cancelling: website subscribers cancel in Profile (one tap, done in-app). Apple subscribers cancel in
  iPhone Settings → Apple ID → Subscriptions; the app shows that instruction for them.

## What to build when the iPhone app exists

1. A table `entitlements (user_id, source 'paystack'|'apple', external_id, expires_at, updated_at)`.
2. An endpoint that receives Apple **App Store Server Notifications v2** (renewals, cancellations, refunds) and
   updates that table, verified with Apple's signed JWS.
3. The existing tier check reads the latest non-expired row from either source.
4. Health data: the same app build adds Apple HealthKit (and Health Connect on Android) through the
   `HealthAdapter` interface already in `src/lib/activity.ts`, with the person's permission. Imported workouts
   carry the source's id, so the same workout is never saved twice.

No change is needed for the 3 December web launch.
