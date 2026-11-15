#!/usr/bin/env python3
"""
Adds two more official national food composition tables to public/data/foods.json.
Safe to re-run (removes rows it added before). Run scripts/build-recipes.mjs afterwards.

  UK  — McCance and Widdowson's Composition of Foods Integrated Dataset (CoFID) 2021,
        Public Health England / OHID. Open Government Licence v3.0.
        https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
  AU  — Australian Food Composition Database (AFCD) Release 3, Food Standards Australia
        New Zealand. Creative Commons Attribution 4.0.
        https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd

  python3 scripts/build-national.py <CoFID.xlsx> <AFCD Nutrient profiles.xlsx> <AFCD Food group information.xlsx>

Values are copied from the tables per 100 g. "Tr" (trace) becomes 0; "N" / blank (not
measured) stays null. Vitamin A is retinol + beta-carotene equivalents / 12 (µg RAE),
matching USDA's units.
"""
import json, re, sys
import openpyxl

COOKED = re.compile(r'\b(cooked|roasted|boiled|baked|grilled|broiled|fried|pan-fried|stir-fried|braised|stewed|steamed|simmered|microwaved|poached|scrambled|toasted|heated|casseroled|blanched|barbecued|microwave|dry heat|moist heat)\b', re.I)
RAW = re.compile(r'\b(raw|uncooked|unprepared)\b', re.I)
DRY = re.compile(r'\b(dried|dry)\b', re.I)
GRAINY = re.compile(r'\b(rice|pasta|spaghetti|noodles|lentils|beans|peas|chickpeas|oats|couscous|quinoa|barley|bulgur|macaroni)\b', re.I)


def state_of(name):
    if COOKED.search(name) and not re.search(r'\bnot cooked\b', name, re.I):
        return 'cooked'
    if RAW.search(name):
        return 'raw'
    if DRY.search(name) and GRAINY.search(name):
        return 'dry'
    return 'na'


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s.lower() in ('tr', 'trace'):
        return 0.0
    try:
        return float(s.replace(',', ''))
    except ValueError:
        return None  # 'N', '' = not measured


def r(v, d=2):
    return None if v is None else round(v, d)


def rae(retinol, beta_eq):
    if retinol is None and beta_eq is None:
        return None
    return (retinol or 0) + (beta_eq or 0) / 12


EXTRA = ['sugar', 'satFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'zinc', 'vitA', 'vitC', 'vitD', 'vitB12', 'folate']

# CoFID food group letters → readable categories
COFID_GROUPS = {
    'A': 'Cereals and cereal products (UK)', 'B': 'Milk and milk products (UK)', 'C': 'Eggs and egg dishes (UK)',
    'D': 'Vegetables and vegetable dishes (UK)', 'F': 'Fruit (UK)', 'G': 'Nuts and seeds (UK)', 'H': 'Herbs and spices (UK)',
    'J': 'Fish and fish dishes (UK)', 'M': 'Meat and meat dishes (UK)', 'O': 'Fats and oils (UK)', 'P': 'Beverages (UK)',
    'Q': 'Alcoholic beverages (UK)', 'S': 'Sugars, preserves and snacks (UK)', 'W': 'Soups, sauces and miscellaneous (UK)',
}


def cofid(path):
    wb = openpyxl.load_workbook(path, read_only=True)

    def sheet(name):
        ws = wb[name]
        rows = list(ws.iter_rows(values_only=True))
        codes = rows[1]
        idx = {c: i for i, c in enumerate(codes) if c}
        data = {}
        for row in rows[3:]:
            if row[0] and row[1]:
                data[str(row[0]).strip()] = row
        return idx, data

    pi, prox = sheet('1.3 Proximates')
    ii, inorg = sheet('1.4 Inorganics')
    vi, vit = sheet('1.5 Vitamins')
    out = []
    for code, row in prox.items():
        name = str(row[1]).strip()
        g = lambda key, rowd=row, idx=pi: num(rowd[idx[key]]) if key in idx else None
        protein = g('PROT')
        kcal = g('KCALS')
        if protein is None or kcal is None:
            continue
        inr = inorg.get(code)
        vr = vit.get(code)
        gi = lambda key: num(inr[ii[key]]) if inr is not None and key in ii else None
        gv = lambda key: num(vr[vi[key]]) if vr is not None and key in vi else None
        fibre = g('AOACFIB')
        if fibre is None:
            fibre = g('ENGFIB')  # older UK fibre method (NSP)
        extra = [g('TOTSUG'), g('SATFOD'), g('CHOL'), gi('NA'), gi('K'), gi('CA'), gi('FE'), gi('MG'), gi('ZN'),
                 rae(gv('RET'), gv('CAREQU')), gv('VITC'), gv('VITD'), gv('VITB12'), gv('FOLT')]
        group = str(row[3] or '').strip()[:1]
        out.append({
            'key': code, 'name': name, 'cat': COFID_GROUPS.get(group, 'UK foods (CoFID)'), 'state': state_of(name),
            'base': [protein, kcal, g('FAT'), g('CHO'), fibre], 'extra': extra,
        })
    return out


def afcd(path, groups_path):
    gwb = openpyxl.load_workbook(groups_path, read_only=True)
    groups = {}
    for row in gwb['Food group information'].iter_rows(values_only=True):
        if isinstance(row[0], (int, float)) and row[1]:
            groups[int(row[0])] = f"{str(row[1]).strip()} (Australia)"
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb['All solids & liquids per 100 g']
    rows = list(ws.iter_rows(values_only=True))
    head = [str(h or '').replace('\n', ' ') for h in rows[2]]

    def col(prefix):
        for i, h in enumerate(head):
            if re.sub(r'\s+', ' ', h).lower().startswith(prefix.lower()):
                return i
        raise KeyError(prefix)

    C = {k: col(p) for k, p in {
        'kj': 'Energy with dietary fibre', 'protein': 'Protein', 'fat': 'Fat, total', 'carbs': 'Available carbohydrate, with sugar alcohols',
        'fibre': 'Total dietary fibre', 'sugar': 'Total sugars', 'sat': 'Total saturated fatty acids, equated (g)', 'chol': 'Cholesterol',
        'na': 'Sodium', 'k': 'Potassium', 'ca': 'Calcium', 'fe': 'Iron', 'mg': 'Magnesium', 'zn': 'Zinc',
        'ret': 'Retinol', 'beq': 'Beta-carotene equivalents', 'vitc': 'Vitamin C', 'vitd': 'Vitamin D3 equivalents',
        'b12': 'Cobalamin (B12)', 'folate': 'Dietary folate equivalents',
    }.items()}
    out = []
    for row in rows[3:]:
        if not row[0] or not row[3]:
            continue
        g = lambda k: num(row[C[k]])
        protein, kj = g('protein'), g('kj')
        if protein is None or kj is None:
            continue
        name = re.sub(r'\s+', ' ', str(row[3])).strip()
        cls = str(row[1] or '')
        cat = groups.get(int(cls[:2]), 'Australian foods (AFCD)') if cls[:2].isdigit() else 'Australian foods (AFCD)'
        extra = [g('sugar'), g('sat'), g('chol'), g('na'), g('k'), g('ca'), g('fe'), g('mg'), g('zn'),
                 rae(g('ret'), g('beq')), g('vitc'), g('vitd'), g('b12'), g('folate')]
        out.append({
            'key': str(row[0]).strip(), 'name': name, 'cat': cat, 'state': state_of(name),
            'base': [protein, kj / 4.184, g('fat'), g('carbs'), g('fibre')], 'extra': extra,
        })
    return out


def main(cofid_path, afcd_path, groups_path):
    dest = 'public/data/foods.json'
    file = json.load(open(dest))
    assert file['extraFields'] == EXTRA, file['extraFields']
    file['foods'] = [f for f in file['foods'] if f[10] not in ('u', 'a')]
    file['sources']['u'] = {
        'name': "McCance and Widdowson's Composition of Foods Integrated Dataset (UK)", 'release': '2021',
        'citation': "Office for Health Improvement and Disparities. McCance and Widdowson's Composition of Foods Integrated Dataset 2021. Contains public sector information licensed under the Open Government Licence v3.0.",
    }
    file['sources']['a'] = {
        'name': 'Australian Food Composition Database (Food Standards Australia New Zealand)', 'release': 'Release 3',
        'citation': 'Food Standards Australia New Zealand. Australian Food Composition Database – Release 3. Licensed under CC BY 4.0.',
    }
    cat_ids = {v: k for k, v in file['categories'].items()}
    next_id = max(int(k) for k in file['categories']) + 1

    def cat_id(name):
        nonlocal next_id
        if name not in cat_ids:
            cat_ids[name] = str(next_id)
            file['categories'][str(next_id)] = name
            next_id += 1
        return int(cat_ids[name])

    added = {}
    for src, foods in (('u', cofid(cofid_path)), ('a', afcd(afcd_path, groups_path))):
        for f in foods:
            p, k, fat, carbs, fib = f['base']
            file['foods'].append([f['key'], f['name'], cat_id(f['cat']), f['state'], r(p), r(k, 0), r(fat), r(carbs), r(fib), [], src, [r(v) for v in f['extra']]])
        added[src] = len(foods)
    json.dump(file, open(dest, 'w'), separators=(',', ':'), ensure_ascii=False)
    print(f"Added {added['u']} UK (CoFID) and {added['a']} Australian (AFCD) foods. Total now {len(file['foods'])}.")


if __name__ == '__main__':
    main(*sys.argv[1:4])
