# West African serving sizes

How Nutivili measures and asks about West African dishes, and where each number comes from.
The grams are estimates of typical servings, not exact weights. The app always shows the
grams, and people can change them.

## How these foods are really served

| Food | How people say it | What the app asks |
|---|---|---|
| Soups (egusi, ogbono, efo riro, okra, banga, afang, oha, bitterleaf…) | Eaten with a swallow, served by the **ladle** or as a small/normal/big portion | "How much egusi soup did you have: a small, medium or large portion? Or say how many ladles." |
| Swallows (eba, pounded yam, amala, fufu, semo, tuwo…) | By the **wrap** | "How many wraps of eba? You can add small, medium or large." |
| Rice dishes and porridges (jollof, fried rice, waakye, beans/yam porridge, abacha) | By the **plate**, or **cooking spoons** | "How much jollof rice: a small, medium or large plate? Or say how many cooking spoons." |
| Pepper soup, light soup | By the **bowl** (eaten on its own) | "How much pepper soup: a small, medium or large bowl?" |
| Moi moi | Counted (leaf, nylon or milk-tin wraps) | "How many moi moi?" |
| Akara, puff puff | Counted | "How many akara?" |
| Suya | By the stick | "How many sticks of suya?" |

Soups are never asked about in bowls or "balls". A bare number in an answer ("two") counts in
the unit asked about: ladles for soup, wraps for swallow, plates for rice. "Medium", "a big one"
and "small plate" are understood. If the answer has no amount, the app asks again; it never
guesses.

## Numbers and sources

| Measure | Grams | Source |
|---|---|---|
| Soup ladle | 150 | 150 ml soup ladle used to standardise soup servings (Kumasi, Ghana soup study); soups are served in 1–4 ladles in the Accra photographic food atlas (IFPRI, 2022) |
| Soup portion: small, medium, large | 150, 250, 350 | 1, about 1⅔ and about 2⅓ ladles |
| Stew or soup cooking spoon | 75 | Weight steps between 1, 2, 3 and 4 stew spoons in the Accra atlas (about 70–95 g each) |
| Rice cooking spoon | 100 | Weight steps between 1–4 ladles of plain rice in the Accra atlas (148 → 242 → 340 → 424 g) |
| Plate of rice or porridge: small, medium, large | 200, 300, 400 | 2, 3 and 4 cooking spoons |
| Swallow wrap: small, medium, large | 150, 250, 350 | Common Nigerian estimates for a wrap of eba (about 250–280 g). No published study weighs a wrap, so medium is the usual figure. |
| Moi moi (milk-tin size) | 196 | Fadupin (2009), Univ. of Ibadan: ½ milk tin of moinmoin = 98 g |
| Akara or puff puff piece | 30 | Typical piece size. Fadupin lists akara by weight only, not by piece. |
| Suya stick | 80 | Sticks aren't standardised. FatSecret's per-skewer and per-100 g figures imply about 80 g. |
| Bowl of pepper soup: small, medium, large | 250, 350, 450 | Includes the meat or fish in it |

- G T Fadupin, *Food exchange lists of local foods in Nigeria*, African Journal of Diabetes Medicine, Nov 2009.
- *A photographic food atlas with portion sizes of commonly consumed foods in Accra, Ghana*, IFPRI / Noguchi Memorial Institute, 2022.
- Sanusi & Olurin, *Portion and serving sizes of commonly consumed foods in Ibadan*, Afr. J. Biomed. Res. 2014 (household measures for Nigerian soups and swallows).

Fadupin notes that Nigerian homes rarely have kitchen scales. That is why the app asks in
household measures and shows the grams it used.

## Every other food

Questions follow the kind of food: cake and bread by the slice; drinks by the glass, cup or ml;
spreads, oil and sugar by the teaspoon or tablespoon; yogurt, crisps, chocolate and noodles by the
pot, bag, bar or pack; fruit and eggs counted, with small, medium or large; anything else with
examples from that food's own servings. A cake is never asked about like jollof.

Foods that list no natural serving (for example a UK "Cake, chocolate fudge") get the typical
serving of their kind. That's the median weight of that serving across the similar foods that
do list one, mostly USDA FNDDS, which records what people actually eat. The serving is labelled
"(typical)". Current values: cake slice 57 g, muffin 130 g, pie 150 g, bread slice 23 g,
biscuit 13 g, glass of drink 248 g, yogurt pot 170 g, small bag of crisps 28 g. Indomie uses
the pack sizes printed on the packet (70 g and 120 g). Rebuild with:

    node scripts/build-recipes.mjs && node scripts/build-typical-portions.mjs

Every voice item can be corrected before it's added. Tap a serving button in that food's own
units, use − / + for how many, type the grams, or tap "Wrong food? Change it" to search for the
right one. Photo scans already offer other matches and a search.
