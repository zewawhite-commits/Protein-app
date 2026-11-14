import {
  Apple, Bean, Beef, Candy, Carrot, Coffee, Cookie, Croissant, CupSoda, Drumstick, Egg, Fish, Ham, Leaf, Milk, Nut, Package, Pizza, Salad, Shell, Soup, Utensils, Wheat, Wine,
  type LucideIcon,
} from 'lucide-react';
import { usePhotoUrl } from '@/lib/hooks';
import { cx } from './ui';

/** USDA category (or name keyword) → icon, so every food has a visual even without a photo. */
const BY_CATEGORY: Record<string, LucideIcon> = {
  'Dairy and Egg Products': Milk,
  'Spices and Herbs': Leaf,
  'Fats and Oils': Nut,
  'Poultry Products': Drumstick,
  'Soups, Sauces, and Gravies': Soup,
  'Sausages and Luncheon Meats': Ham,
  'Breakfast Cereals': Wheat,
  'Fruits and Fruit Juices': Apple,
  'Pork Products': Ham,
  'Vegetables and Vegetable Products': Carrot,
  'Nut and Seed Products': Nut,
  'Beef Products': Beef,
  Beverages: CupSoda,
  'Finfish and Shellfish Products': Fish,
  'Legumes and Legume Products': Bean,
  'Lamb, Veal, and Game Products': Beef,
  'Baked Products': Croissant,
  Sweets: Candy,
  'Cereal Grains and Pasta': Wheat,
  'Fast Foods': Pizza,
  'Meals, Entrees, and Side Dishes': Salad,
  Snacks: Cookie,
  'Restaurant Foods': Utensils,
  'Alcoholic Beverages': Wine,
  'Packaged product': Package,
};

/** Keyword fallback for FNDDS (WWEIA) and FAO category names. */
const BY_CATEGORY_WORD: [RegExp, LucideIcon][] = [
  [/poultry|chicken|turkey/i, Drumstick],
  [/fish|seafood|shellfish/i, Fish],
  [/beef|meat|pork|lamb|sausage|frankfurter/i, Beef],
  [/egg/i, Egg],
  [/milk|yogurt|cheese|dairy/i, Milk],
  [/soup|broth/i, Soup],
  [/rice|pasta|cereal|grain|bread|tortilla|noodle|wheat/i, Wheat],
  [/bean|legume|pulse|pea/i, Bean],
  [/nut|seed/i, Nut],
  [/fruit/i, Apple],
  [/vegetable|starchy|root|tuber|potato/i, Carrot],
  [/pizza|burger|sandwich|taco|burrito/i, Pizza],
  [/cake|cookie|pastry|sweet|candy|dessert|ice cream/i, Cookie],
  [/coffee|tea/i, Coffee],
  [/beverage|drink|juice|soda/i, CupSoda],
  [/alcohol|beer|wine/i, Wine],
  [/salad/i, Salad],
];

const BY_WORD: [RegExp, LucideIcon][] = [
  [/^egg\b/i, Egg],
  [/\b(shrimp|crab|lobster|crustaceans|mollusks|clam|mussel|oyster|scallop)\b/i, Shell],
  [/^(fish|salmon|tuna)\b/i, Fish],
  [/^(chicken|turkey|duck)\b/i, Drumstick],
  [/^(beef|lamb|veal)\b/i, Beef],
  [/^(yogurt|milk|cheese|cream)\b/i, Milk],
  [/^(coffee|tea)\b/i, Coffee],
];

export function iconFor(name: string, category?: string): LucideIcon {
  for (const [re, icon] of BY_WORD) if (re.test(name)) return icon;
  if (category && BY_CATEGORY[category]) return BY_CATEGORY[category];
  for (const [re, icon] of BY_CATEGORY_WORD) if (category && re.test(category)) return icon;
  return Utensils;
}

/** Rounded-square visual: the entry's photo if there is one, otherwise a category icon. */
export function FoodVisual({ name, category, photoId, size = 52, className }: { name: string; category?: string; photoId?: string; size?: number; className?: string }) {
  const url = usePhotoUrl(photoId);
  const Icon = iconFor(name, category);
  return (
    <div
      className={cx('grid shrink-0 place-items-center overflow-hidden bg-raised text-ink', className)}
      style={{ width: size, height: size, borderRadius: size * 0.32 }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Icon size={size * 0.42} strokeWidth={1.9} />}
    </div>
  );
}
