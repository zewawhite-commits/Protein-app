/**
 * Food-specific measurements. A cup of rice and a cup of chicken don't weigh the same, so every
 * household measure comes from the food itself:
 *  - measures in the food's own record (USDA, FAO/INFOODS, UK, Australia…) are "verified":
 *    the agency weighed that measure of that food;
 *  - "(typical)" sizes and standard-recipe portions are "estimated" (a sensible reference size);
 *  - volume units (ml, L, tsp, tbsp, cup, glass, can, bottle) are only offered for liquids,
 *    oils and sauces, converted with that food type's density.
 * Where nothing reliable exists we don't invent a size: people weigh it in grams instead.
 */
import type { Food } from './types';

export interface Measure { label: string; grams: number; verified: boolean; volume?: boolean }

/** Density in g per ml for foods measured by volume. Only these food types get volume units. */
const DENSITY: [RegExp, number, string][] = [
  [/\b(oil|ghee)\b/i, 0.92, 'oil'],
  [/\b(honey|syrup|molasses|treacle)\b/i, 1.4, 'syrup'],
  [/\b(milk|kefir|buttermilk|cream|custard|yogh?urt drink|ayran)\b/i, 1.03, 'milk'],
  [/\b(juice|smoothie|shake|nectar|squash)\b/i, 1.04, 'juice'],
  [/\b(soda|cola|soft drink|lemonade|beer|cider|wine|zobo|kunu|chapman|tea|coffee|latte|water|drink|beverage)\b/i, 1.0, 'drink'],
  [/\b(soup|broth|stock|consomm[eé])\b/i, 1.0, 'soup'],
  [/\b(sauce|ketchup|mayonnaise|mayo|dressing|vinegar|soy sauce|gravy)\b/i, 1.05, 'sauce'],
];
/** Things that sound liquid but aren't (powders, mixes, solids made from milk). */
const NOT_LIQUID = /\b(powder|powdered|dry|dried|mix|bar|chocolate|cheese|butter|bread|cake|biscuit|cookie|candy|ice cream|solids|granules|leaves|bag)\b/i;

export function densityOf(food: Pick<Food, 'name' | 'category'>): { gPerMl: number; kind: string } | null {
  const text = `${food.name} ${food.category ?? ''}`;
  if (NOT_LIQUID.test(food.name)) return null;
  for (const [re, d, kind] of DENSITY) if (re.test(text)) return { gPerMl: d, kind };
  return null;
}

const VOLUMES: [string, number][] = [['1 tsp', 5], ['1 tbsp', 15], ['1 cup (240 ml)', 240], ['1 glass (250 ml)', 250], ['1 can (330 ml)', 330], ['1 bottle (500 ml)', 500], ['1 litre', 1000]];
/** Volume measures that suit each kind (no "bottle of oil" or "glass of ketchup"). */
const FOR_KIND: Record<string, string[]> = {
  oil: ['1 tsp', '1 tbsp', '1 cup (240 ml)'],
  syrup: ['1 tsp', '1 tbsp'],
  sauce: ['1 tsp', '1 tbsp', '1 cup (240 ml)'],
  milk: ['1 tbsp', '1 cup (240 ml)', '1 glass (250 ml)', '1 bottle (500 ml)', '1 litre'],
  juice: ['1 cup (240 ml)', '1 glass (250 ml)', '1 can (330 ml)', '1 bottle (500 ml)', '1 litre'],
  drink: ['1 cup (240 ml)', '1 glass (250 ml)', '1 can (330 ml)', '1 bottle (500 ml)', '1 litre'],
  soup: ['1 cup (240 ml)'],
};

/** Labels from source tables that confuse people; the weight is still available in grams. */
const UNHELPFUL = /cubic inch|surface inch|yield from|excluding refuse|\bNFS\b|^1 oz\b|^1 lb\b|^1 fl oz/i;

/** Shorter, clearer names for source-table measure labels. */
export function tidyLabel(label: string): string {
  return label
    .replace(/\s*\(typical\)/i, '')
    .replace(/^1 oz cooked portion$/i, '1 cooked portion')
    .replace(/,\s*cooked,?\s*/i, ' cooked ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const isEstimated = (food: Pick<Food, 'source'>, label: string) =>
  /\(typical\)/i.test(label) || food.source === 'recipe' || food.source === 'custom';

/**
 * All the useful measures for one food: its own record's measures (verified), its estimated
 * typical sizes, then volume units for liquids, oils and sauces. Duplicates are dropped.
 */
export function measuresFor(food: Food): Measure[] {
  const out: Measure[] = [];
  const seen = new Set<string>();
  for (const p of food.portions ?? []) {
    if (!(p.grams > 0) || UNHELPFUL.test(p.label)) continue;
    const label = tidyLabel(p.label);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, grams: p.grams, verified: !isEstimated(food, p.label) });
    // "0.5 breast" in the record → also offer "1 breast" (double the weighed half, so still verified).
    const half = /^0\.5 (\w+)(.*)$/i.exec(label);
    if (half && !seen.has(`1 ${half[1]}${half[2]}`.toLowerCase())) {
      seen.add(`1 ${half[1]}${half[2]}`.toLowerCase());
      out.push({ label: `1 ${half[1]}${half[2]}`, grams: Math.round(p.grams * 2 * 10) / 10, verified: !isEstimated(food, p.label) });
    }
  }
  const d = densityOf(food);
  if (d) {
    for (const [label, ml] of VOLUMES) {
      if (!FOR_KIND[d.kind].includes(label)) continue;
      const core = label.replace(/\s*\(.*\)/, '').replace(/^1 /, '');
      if ([...seen].some((s) => s.replace(/^1 /, '').startsWith(core))) continue; // the record's own cup/tbsp wins
      seen.add(label.toLowerCase());
      out.push({ label, grams: Math.round(ml * d.gPerMl * 10) / 10, verified: false, volume: true });
    }
  }
  return out;
}

/** Units a person can pick when creating a food, inferred from what kind of food it is. */
export function suggestedUnits(name: string, category = ''): string[] {
  const t = `${name} ${category}`.toLowerCase();
  if (densityOf({ name, category })) return densityOf({ name, category })!.kind === 'oil' || densityOf({ name, category })!.kind === 'sauce' ? ['tbsp', 'tsp', 'ml'] : ['glass', 'cup', 'bottle', 'ml'];
  if (/egg/.test(t)) return ['egg', 'g'];
  if (/rice|grain|oats|quinoa|couscous|pasta|noodle|cereal|porridge/.test(t)) return ['cup', 'plate', 'bowl', 'g'];
  if (/fish|salmon|tilapia|catfish|tuna|cod|mackerel/.test(t)) return ['fillet', 'piece', 'g'];
  if (/chicken|turkey|wing|drumstick|thigh/.test(t)) return ['piece', 'wing', 'drumstick', 'g'];
  if (/beef|goat|lamb|pork|meat|suya|sausage/.test(t)) return ['piece', 'slice', 'g'];
  if (/bread|loaf|toast|roll|bun|cake|pie|pizza/.test(t)) return ['slice', 'piece', 'g'];
  if (/soup|stew|sauce|curry/.test(t)) return ['bowl', 'ladle', 'cup', 'g'];
  if (/fufu|eba|amala|pounded|swallow|ugali|banku|fufu/.test(t)) return ['wrap', 'g'];
  if (/apple|banana|orange|mango|fruit|avocado|plantain/.test(t)) return ['piece', 'slice', 'cup', 'g'];
  if (/nut|seed|groundnut|almond|cashew|snack|chips|crisps/.test(t)) return ['handful', 'packet', 'tbsp', 'g'];
  if (/cheese|yogh?urt|butter/.test(t)) return ['slice', 'tbsp', 'pot', 'g'];
  return ['serving', 'piece', 'g'];
}
