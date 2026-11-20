#!/usr/bin/env python3
"""
Adds more nutrients to every record in public/data/foods.json, copied from the same official
tables the records came from (nothing estimated: missing stays null).

  added sugar (AFCD only), vitamin E, vitamin K, thiamin (B1), riboflavin (B2), niacin (B3),
  vitamin B6, phosphorus, monounsaturated fat, polyunsaturated fat

  python3 scripts/add-nutrients.py <SR Legacy folder> <FNDDS folder> <CoFID.xlsx> <AFCD Nutrient profiles.xlsx> <WAFCT_2019.xlsx>
  node scripts/build-recipes.mjs   # recompute standard recipes with the new values

Safe to re-run: the new values are rebuilt from the sources each time.
"""
import csv, json, re, sys
import openpyxl

NEW = ['addedSugar', 'vitE', 'vitK', 'thiamin', 'riboflavin', 'niacin', 'vitB6', 'phosphorus', 'monoFat', 'polyFat']
BASE = ['sugar', 'satFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'zinc', 'vitA', 'vitC', 'vitD', 'vitB12', 'folate']
USDA = [None, '1109', '1185', '1165', '1166', '1167', '1175', '1091', '1292', '1293']
# FNDDS uses the older USDA nutrient numbers for the same nutrients.
FNDDS = [None, '323', '430', '404', '405', '406', '415', '305', '645', '646']


def num(v):
    if v is None:
        return None
    s = str(v).strip().strip('[]').replace(',', '.')
    if s.lower() in ('tr', 'trace'):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def r2(v):
    return None if v is None else round(v, 3)


def usda(folder, ids=USDA):
    want = {i for i in ids if i}
    out = {}
    with open(f'{folder}/food_nutrient.csv', newline='') as f:
        for row in csv.DictReader(f):
            if row['nutrient_id'] in want:
                out.setdefault(row['fdc_id'], {})[row['nutrient_id']] = num(row['amount'])
    return {k: [None if i is None else v.get(i) for i in ids] for k, v in out.items()}


def cofid(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    sheets = {}
    for name in ('1.3 Proximates', '1.4 Inorganics', '1.5 Vitamins'):
        rows = list(wb[name].iter_rows(values_only=True))
        idx = {c: i for i, c in enumerate(rows[1]) if c}
        sheets[name] = (idx, {str(r[0]).strip(): r for r in rows[3:] if r[0]})
    def get(sheet, code, key):
        idx, data = sheets[sheet]
        r = data.get(code)
        return num(r[idx[key]]) if r is not None and key in idx else None
    codes = sheets['1.3 Proximates'][1].keys()
    v, p, i = '1.5 Vitamins', '1.3 Proximates', '1.4 Inorganics'
    return {c: [None, get(v, c, 'VITE'), get(v, c, 'VITK1'), get(v, c, 'THIA'), get(v, c, 'RIBO'), get(v, c, 'NIAC'),
                get(v, c, 'VITB6'), get(i, c, 'P'), get(p, c, 'MONOFOD'), get(p, c, 'POLYFOD')] for c in codes}


def afcd(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    rows = list(wb['All solids & liquids per 100 g'].iter_rows(values_only=True))
    head = [re.sub(r'\s+', ' ', str(h or '').replace('\n', ' ')).strip().lower() for h in rows[2]]
    def col(prefix):
        for n, h in enumerate(head):
            if h.startswith(prefix.lower()):
                return n
        return None
    C = [col('Added sugars (g)'), col('Vitamin E'), None, col('Thiamin (B1)'), col('Riboflavin (B2)'), col('Niacin (B3)'),
         col('Pyridoxine (B6)'), col('Phosphorus (P)'), col('Total monounsaturated fatty acids, equated (g)'), col('Total polyunsaturated fatty acids, equated (g)')]
    return {str(r[0]).strip(): [None if c is None else num(r[c]) for c in C] for r in rows[3:] if r[0]}


def wafct(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb['03 NV_sum_39 (per 100g EP)'].iter_rows(values_only=True))
    tags = [str(c or '').strip() for c in rows[2]]
    def col(tag):
        return tags.index(tag) if tag in tags else None
    C = [None, col('VITE'), None, col('THIA'), col('RIBF'), col('NIA'), col('VITB6C'), col('P'), col('FAMS'), col('FAPU')]
    return {str(r[0]).strip(): [None if c is None else num(r[c]) for c in C] for r in rows[3:] if r[0] and r[1]}


def main(sr, fndds, cofid_path, afcd_path, wafct_path):
    dest = 'public/data/foods.json'
    file = json.load(open(dest))
    assert file['extraFields'][:len(BASE)] == BASE, file['extraFields']
    src = {'s': usda(sr), 'f': usda(fndds, FNDDS), 'u': cofid(cofid_path), 'a': afcd(afcd_path), 'w': wafct(wafct_path)}
    found = {k: 0 for k in src}
    for row in file['foods']:
        kind = row[10]
        extra = (row[11] or [None] * len(BASE))[:len(BASE)]
        vals = src.get(kind, {}).get(str(row[0]))
        if vals:
            found[kind] += 1
        row[11] = extra + [r2(v) for v in (vals or [None] * len(NEW))]
    file['extraFields'] = BASE + NEW
    json.dump(file, open(dest, 'w'), separators=(',', ':'))
    print('matched records:', found)


if __name__ == '__main__':
    main(*sys.argv[1:6])
