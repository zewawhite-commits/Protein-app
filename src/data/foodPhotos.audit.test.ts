import { describe, expect, it } from 'vitest';
import { photoKeyFor } from './foodPhotos';

// From the full photo audit: every food was checked against the photo it would show.
describe('photos only show on foods that look like them', () => {
  it.each([
    ['Fried eggplant', 'fried_egg'], ['Almond chicken', 'almonds'], ['Rock Salmon/Dogfish, raw', 'salmon'], ['Salmon, smoked (cold-smoked)', 'salmon'],
    ['Beans, snap, green, raw', 'beans'], ['Baked beans', 'beans'], ['Refried beans', 'beans'], ['Beans, pinto, mature seeds, cooked, boiled, without salt', 'beans'],
    ['Cheese, cottage, plain', 'cheese_wedge'], ['Cheese, mozzarella, whole milk', 'cheese_wedge'], ['Cheese, feta', 'cheese_wedge'], ['Cream cheese, regular, plain', 'cheese_wedge'],
    ['Bread, banana, homemade', 'bread'], ['Bread, garlic, commercial, baked', 'bread'], ['Bread, white, toasted', 'bread'], ['Bread, pitta, white', 'bread'],
    ['Fish, cod, steamed', 'fish'], ['Fish, eel', 'fish'], ['Beef, steak, country fried', 'cut_of_meat'], ['Beef, braising steak, braised, lean only', 'cut_of_meat'],
    ['Chicken breast, stewed, skin eaten', 'chicken_breast'], ['Chicken wing, stewed', 'chicken_wings'], ['Dessert pizza', 'pizza'], ['Chocolate, white', 'chocolate_bar'],
    ['Cherries, maraschino', 'cherries'], ['Tea, hot, hibiscus', 'teacup_without_handle'], ['Wine, red, cooked', 'wine_glass'], ['Doughnut, jelly', 'doughnut'],
    ['Hot dog, beef', 'hot_dog'], ['Mapo tofu', 'tofu'], ['Milk, malted', 'glass_of_milk'], ['Popcorn, caramel coated', 'popcorn'],
  ])('%s does not get the %s photo', (name, key) => expect(photoKeyFor(name)).not.toBe(key));
  it.each([
    ['Egg, whole, cooked, fried', 'fried_egg'], ['Nuts, almonds', 'almonds'], ['Fish, salmon, Atlantic, farmed, raw', 'salmon'], ['Beans, black, mature seeds, raw', 'beans'],
    ['Cheese, Cheddar', 'cheese_wedge'], ['Bread, white', 'bread'], ['Fish, tilapia, fried', 'fish'], ['Beef, sirloin steak, grilled rare, lean', 'cut_of_meat'],
    ['Milk, whole', 'glass_of_milk'], ['Chocolate, dark, 70-85% cacao solids', 'chocolate_bar'], ['Cherries, sweet, raw', 'cherries'],
  ])('%s keeps the %s photo', (name, key) => expect(photoKeyFor(name)).toBe(key));
});
