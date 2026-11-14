/**
 * Extra nutrients tracked beyond the macros. Values are copied from the source tables
 * (USDA FoodData Central, FAO/INFOODS WAFCT, Open Food Facts); missing stays null.
 * Daily values: US FDA reference daily values for adults (21 CFR 101.9), used only to show
 * "% of daily value" — they are general references, not personal targets.
 */
export const EXTRA_KEYS = [
  'sugar', 'satFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron',
  'magnesium', 'zinc', 'vitA', 'vitC', 'vitD', 'vitB12', 'folate',
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
};
