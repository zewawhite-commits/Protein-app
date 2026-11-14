/**
 * Photos for popular foods (public/photos). All are CC0 (public domain) photos from Unsplash,
 * via Wikimedia Commons; photographers credited in Profile → About. Keys are USDA FDC ids.
 */
export interface FoodPhoto { file: string; credit: string; license: string; source: string }

export const FOOD_PHOTOS: Record<number, FoodPhoto> = {
  171477: {"file": "chicken-breast-roasted.webp", "credit": "NeONBRAND neonbrand", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Dinner_is_served_(Unsplash).jpg"},
  171287: {"file": "eggs-raw.webp", "credit": "Cory Seward cseward15", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Bowl_of_Eggs_(Unsplash).jpg"},
  173424: {"file": "eggs-boiled.webp", "credit": "Autumn Mott autumnmott", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Fresh_Eggs_(Unsplash).jpg"},
  170894: {"file": "greek-yogurt.webp", "credit": "Peter Hershey peterhershey", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Lancaster,_United_States_(Unsplash).jpg"},
  172421: {"file": "lentils.webp", "credit": "James Sutton jamessutton_photography", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Healthy_Lentil_Salad_(Unsplash).jpg"},
  170567: {"file": "almonds.webp", "credit": "Juan José Valencia Antía juanantia", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Healthy_Almond_Snack_(Unsplash).jpg"},
  173904: {"file": "oats.webp", "credit": "Federica Diliberto federyka", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Healthy_Breakfast_(Unsplash).jpg"},
};
