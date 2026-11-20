/**
 * Extra nutrients tracked beyond the macros. Values are copied from the source tables
 * (USDA FoodData Central, FAO/INFOODS WAFCT, Open Food Facts); missing stays null.
 * Daily values: US FDA reference daily values for adults (21 CFR 101.9), used only to show
 * "% of daily value" — they are general references, not personal targets.
 */
export const EXTRA_KEYS = [
  'sugar', 'satFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron',
  'magnesium', 'zinc', 'vitA', 'vitC', 'vitD', 'vitB12', 'folate', 'addedSugar',
  'vitE', 'vitK', 'thiamin', 'riboflavin', 'niacin', 'vitB6', 'phosphorus', 'monoFat', 'polyFat',
] as const;
export type ExtraKey = (typeof EXTRA_KEYS)[number];

export interface NutrientInfo {
  label: string;
  unit: 'g' | 'mg' | 'µg';
  /** FDA daily value (null = no DV, e.g. total sugars). */
  dv: number | null;
  /** For these, less is better (shown as a limit). */
  limit?: boolean;
  group: 'carbs' | 'fat' | 'minerals' | 'vitamins';
}

export const NUTRIENTS: Record<ExtraKey, NutrientInfo> = {
  sugar: { label: 'Sugars', unit: 'g', dv: null, group: 'carbs' },
  satFat: { label: 'Saturated fat', unit: 'g', dv: 20, limit: true, group: 'fat' },
  cholesterol: { label: 'Cholesterol', unit: 'mg', dv: 300, limit: true, group: 'fat' },
  sodium: { label: 'Sodium', unit: 'mg', dv: 2300, limit: true, group: 'minerals' },
  potassium: { label: 'Potassium', unit: 'mg', dv: 4700, group: 'minerals' },
  calcium: { label: 'Calcium', unit: 'mg', dv: 1300, group: 'minerals' },
  iron: { label: 'Iron', unit: 'mg', dv: 18, group: 'minerals' },
  magnesium: { label: 'Magnesium', unit: 'mg', dv: 420, group: 'minerals' },
  zinc: { label: 'Zinc', unit: 'mg', dv: 11, group: 'minerals' },
  vitA: { label: 'Vitamin A', unit: 'µg', dv: 900, group: 'vitamins' },
  vitC: { label: 'Vitamin C', unit: 'mg', dv: 90, group: 'vitamins' },
  vitD: { label: 'Vitamin D', unit: 'µg', dv: 20, group: 'vitamins' },
  vitB12: { label: 'Vitamin B12', unit: 'µg', dv: 2.4, group: 'vitamins' },
  folate: { label: 'Folate', unit: 'µg', dv: 400, group: 'vitamins' },
  // FDA daily value for added sugars is 50 g. Only known for plain foods (none added), pack labels and your own foods.
  addedSugar: { label: 'Added sugar', unit: 'g', dv: 50, limit: true, group: 'carbs' },
  monoFat: { label: 'Monounsaturated fat', unit: 'g', dv: null, group: 'fat' },
  polyFat: { label: 'Polyunsaturated fat', unit: 'g', dv: null, group: 'fat' },
  phosphorus: { label: 'Phosphorus', unit: 'mg', dv: 1250, group: 'minerals' },
  vitE: { label: 'Vitamin E', unit: 'mg', dv: 15, group: 'vitamins' },
  vitK: { label: 'Vitamin K', unit: 'µg', dv: 120, group: 'vitamins' },
  thiamin: { label: 'Thiamin (B1)', unit: 'mg', dv: 1.2, group: 'vitamins' },
  riboflavin: { label: 'Riboflavin (B2)', unit: 'mg', dv: 1.3, group: 'vitamins' },
  niacin: { label: 'Niacin (B3)', unit: 'mg', dv: 16, group: 'vitamins' },
  vitB6: { label: 'Vitamin B6', unit: 'mg', dv: 1.7, group: 'vitamins' },
};

/**
 * Added sugar, when it can honestly be known without a label: plain, single-ingredient foods
 * (fresh fruit, vegetables, plain meat, fish, eggs, beans, grains, milk, oils) have none added,
 * and a food with no sugar at all has no added sugar. Anything else stays unknown (null).
 */
const PLAIN = /^(fruits and fruit juices|fruit \(uk\)|fruits and their products|apples|bananas|grapes|melons|pears|pineapple|strawberries|blueberries|citrus fruits|mango and papaya|peaches|other fruits|vegetables|other dark green|other red and orange|other starchy|onions|tomatoes|spinach|string beans|broccoli|cabbage|carrots|corn$|lettuce|white potatoes, baked or boiled|starchy roots|poultry products|chicken, whole pieces|turkey, duck|beef products|beef, excludes|ground beef|pork$|pork products|lamb|liver and organ|meat, poultry and their products|finfish|fish$|fish and its products|shellfish$|eggs and omelets|eggs and their products|legumes|beans, peas, legumes$|nut and seed|nuts and seeds|nuts, seeds|cereal grains|cereals and their products|rice$|pasta, noodles, cooked grains|oatmeal|fats and oils|salad dressings and vegetable oils|butter and animal fats|spices|herbs and spices|milk, (whole|reduced fat|lowfat|nonfat)$|milk and its products|yogurt, (regular|greek)$|cheese$|tap water|bottled water|coffee$|tea$)/i;
const SWEETENED = /sweeten|sugar|syrup|candied|honey|glaze|\bjam\b|jelly|chocolate|flavou?red|vanilla|with fruit|juice drink|nectar|cocktail|cured|cereal|dessert|\bpie\b|cake|cookie|sauce|ketchup|marinade|breaded|condensed|dried fruit|\bcanned\b.*\bin (heavy|light)\b|pickle|\bsweet\b(?!\s*(potato|corn|pepper))/i;
export function knownAddedSugar(name: string, category: string | undefined, sugar: number | null | undefined, given?: number | null): number | null {
  if (given != null) return given;
  if (sugar === 0) return 0;
  if (category && PLAIN.test(category) && !SWEETENED.test(name)) return 0;
  return null;
}
