# Protein

A premium, mobile-first protein tracker. Weigh your food, pick it from the USDA database, and the protein is calculated for you. Installable as a PWA and works offline.

## Features

- **Food database** — 7,283 foods from USDA FoodData Central (SR Legacy, April 2018), searched locally and offline.
- **Raw / cooked / dry kept separate** — every record is tagged, filterable, and the add sheet tells you when to weigh. It offers the cooked (or raw) version of the same food in one tap.
- **Weight entry in grams** — keypad, ±5 g steppers, quick weights and USDA household portions.
- **Automatic calculation** — protein, energy, carbs and fat, scaled from per-100 g source values.
- **Daily goal** — fixed grams or g/kg body weight (kg or lb). When you change the goal, past days keep the goal they had.
- **Daily log** — grouped by meal, with a week strip of progress rings and a streak counter.
- **History** — by day with search, plus a photo gallery.
- **Insights** — 7/30/90-day charts against the goal, averages, days the goal was hit, best day, breakdown by meal, top protein sources.
- **Food photos** — camera or gallery, downscaled and stored in IndexedDB.
- **Profile** — dark, light or auto theme, JSON backup export and restore, delete all data.
- **Admin** — browse USDA records (read-only, linked to FDC), and create, edit or archive custom records. Custom records require a cited source and pass sanity checks.

## Nutritional accuracy

- All USDA values are copied verbatim by `scripts/build-foods.mjs` from the official CSV. Missing values stay `null` and are shown as "—". Totals that include a missing value are marked with `*`.
- Each log entry stores a snapshot of the values it was logged with, so later edits never rewrite history.
- `src/lib/nutrition.ts` holds all the calculations. It is pure and deterministic, with no AI involved. Any future AI suggestions must live in a separate module and never write nutrient values.

### Rebuilding the food data

```bash
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
unzip FoodData_Central_sr_legacy_food_csv_2018-04.zip -d /tmp/usda
npm run build:foods -- /tmp/usda/FoodData_Central_sr_legacy_food_csv_2018-04
```

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check + production build with service worker
```

## Stack

React 18 + TypeScript, Vite 5, Tailwind CSS 3 (design tokens in `src/index.css`), Zustand (persisted to localStorage), idb-keyval (photos), vite-plugin-pwa (Workbox), lucide-react icons, Inter Variable.

```
scripts/build-foods.mjs   USDA CSV → public/data/foods.json
src/lib/                  types, nutrition maths, food search, dates, photos, hooks
src/store/useStore.ts     single data layer (swap for a backend later)
src/components/           UI primitives, layout/nav, food sheet, entry rows, profile form
src/pages/                Today, AddFood, History, Insights, Profile, Admin, Onboarding
```

## Data source

U.S. Department of Agriculture, Agricultural Research Service. FoodData Central: SR Legacy, 2018. https://fdc.nal.usda.gov/
