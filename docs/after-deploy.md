# After promoting the new version

1. **Switch on the three checked Wikimedia photos** (akara, efo riro, eba). They were held back because the
   old live version adds Unsplash-only size settings to photo addresses, which Wikimedia rejects. The new
   version only adds them for Unsplash photos and falls back to a plain tile if any photo fails to load.

   ```sql
   update public.food_photos set verified = true where key in ('akara', 'efo_riro', 'eba');
   ```

2. **Run the real photo-scanner test.** Needs an Anthropic API key in the environment (not a network
   secret: Anthropic's hosts can't take those). One AI call per photo.

   ```sh
   ANTHROPIC_API_KEY=… NODE_USE_ENV_PROXY=1 SCAN_EVAL=25 npx vitest run scripts/scan-eval.test.ts
   ```

   It scans 25 weighed Nutrition5k plates (CC BY 4.0, Google Research) plus the checked Nigerian dish photos,
   and writes `docs/scan-eval.md`: weighed vs estimated grams and calories for every plate, and what the
   scanner called each Nigerian dish. The scanner should not be called accurate until this has run.

## Busy-day indexes (run once)

Supabase → SQL editor → paste the contents of `supabase/scale.sql` → Run. It only adds indexes
(safe to re-run) so the feed, profiles and messages stay fast as the tables grow.
