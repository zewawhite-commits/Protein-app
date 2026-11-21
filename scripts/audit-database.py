#!/usr/bin/env python3
"""
Full database audit: every food record in public/data/foods.json, checked against its original
source row and for plausibility. Read-only: it never changes the database.

  python3 scripts/audit-database.py <src dir> > docs/database-audit.json

<src dir> must hold the original source files (see scripts/build-foods.mjs, build-national.py):
  sr/*/food_nutrient.csv            USDA SR Legacy 2018-04
  fndds/*/food_nutrient.csv         USDA FNDDS 2024-10-31
  wafct.json                        FAO/INFOODS West Africa 2019 (scripts/convert-wafct.py)
  cofid.xlsx                        UK CoFID 2021
  afcd-Nutrient profiles.xlsx, afcd-groups.xlsx   Australia AFCD Release 3

Each record ends up as one of:
  verified          every value the app shows equals the source row (after the build's rounding)
  differs           at least one value differs from the source row (listed)
  unable to verify  no source row could be found for it
and separately gets plausibility flags (missing values, impossible values, energy, state, servings).
"""
import csv, glob, importlib.util, json, math, os, re, sys
from collections import Counter, defaultdict

SRC = sys.argv[1]
db = json.load(open('public/data/foods.json'))
F = db['fields']; ix = {k: i for i, k in enumerate(F)}
EXTRA = db['extraFields']
SOURCE = {'s': 'USDA SR Legacy (US)', 'f': 'USDA FNDDS (US)', 'w': 'FAO West Africa', 'u': 'UK CoFID', 'a': 'Australia AFCD', 'r': 'Standard recipe (world dishes)'}
CORE = ['protein', 'kcal', 'fat', 'carbs', 'fiber']

# ---------------------------------------------------------------- source rows
def usda(kind, ids, extra_ids):
    path = glob.glob(os.path.join(SRC, kind, '*', 'food_nutrient.csv'))[0]
    want = dict(zip(ids, CORE)); want.update({n: EXTRA[i] for i, n in enumerate(extra_ids)})
    out = defaultdict(dict)
    with open(path, newline='') as f:
        for row in csv.DictReader(f):
            k = want.get(row['nutrient_id'])
            if k: out[row['fdc_id']][k] = float(row['amount'])
    return out

sr = usda('sr', ['1003', '1008', '1004', '1005', '1079'], ['2000', '1258', '1253', '1093', '1092', '1087', '1089', '1090', '1095', '1106', '1162', '1114', '1178', '1190'])
fn = usda('fndds', ['203', '208', '204', '205', '291'], ['269', '606', '601', '307', '306', '301', '303', '304', '309', '320', '401', '328', '418', '435'])
waf = {f['code']: f for f in json.load(open(os.path.join(SRC, 'wafct.json')))['foods']}
spec = importlib.util.spec_from_file_location('national', 'scripts/build-national.py'); nat = importlib.util.module_from_spec(spec); spec.loader.exec_module(nat)
cof = {f['key']: f for f in nat.cofid(os.path.join(SRC, 'cofid.xlsx'))}
afc = {f['key']: f for f in nat.afcd(os.path.join(SRC, 'afcd-Nutrient profiles.xlsx'), os.path.join(SRC, 'afcd-groups.xlsx'))}
by_name = {}
for r in db['foods']: by_name.setdefault(r[ix['name']], r)

def source_values(r):
    src, key = r[ix['source']], str(r[ix['fdcId']])
    if src in ('s', 'f'):
        v = (sr if src == 's' else fn).get(key)
        return v
    if src == 'w':
        w = waf.get(key)
        if not w: return None
        out = {k: w.get(k) for k in CORE}
        out.update({k: w.get(k) for k in EXTRA if k in w})
        return out
    if src in ('u', 'a'):
        n = (cof if src == 'u' else afc).get(key)
        if not n: return None
        out = dict(zip(CORE, n['base'])); out.update(dict(zip(EXTRA, n['extra'])))
        return out
    if src == 'r':  # recompute the dish from its standard recipe
        note = r[12] if len(r) > 12 else ''
        m = re.search(r'per (\d+(?:\.\d+)?) g cooked:', note or '')
        if not m: return None
        y = float(m.group(1)); tot = defaultdict(float); miss = defaultdict(float); total = 0
        for g, name in re.findall(r'(\d+(?:\.\d+)?) g (.+?) \[(?:FAO|USDA)[^\]]*\]', note[m.end():]):
            ing = by_name.get(name.strip()); g = float(g); total += g
            if not ing: return None
            for k in CORE:
                v = ing[ix[k]]
                if v is None: miss[k] += g
                else: tot[k] += v * g / 100
        return {k: (None if miss[k] / total > 0.1 else tot[k] * 100 / y) for k in CORE}
    return None

def close(a, b, k):
    if a is None or b is None: return a is None and b is None
    tol = 0.6 if k == 'kcal' else max(0.011, abs(b) * 0.005)
    return abs(a - b) <= tol

# ---------------------------------------------------------------- plausibility
COOKED = re.compile(r'\b(cooked|roasted|boiled|baked|grilled|broiled|fried|braised|stewed|steamed|simmered|microwaved|poached|scrambled|toasted|casseroled|barbecued)\b', re.I)
RAWW = re.compile(r'\b(raw|uncooked|unprepared)\b', re.I)
ALCOHOL = re.compile(r'\b(beer|lager|stout|ale|cider|wine|vodka|gin|rum|whisk(e)?y|brandy|liqueurs?|spirits?|alcoholic|cocktail|sake|mirin|extract|liquor)\b', re.I)
DRINK_CATS = re.compile(r'^(Beer|Wine|Liquor and cocktails|Alcoholic beverages)')
PORTION_RANGES = [(re.compile(r'^[\d.]+ (tsp|teaspoons?)\b', re.I), 0.3, 15), (re.compile(r'^[\d.]+ (tbsp|tablespoons?)\b', re.I), 1.5, 35), (re.compile(r'^[\d.]+ cups?\b(?!.*yield)', re.I), 5, 600),
                  (re.compile(r'^[\d.]+ (\w+ )?slices?\b', re.I), 1, 250), (re.compile(r'^1 (large|medium|small) egg|^1 egg', re.I), 25, 80), (re.compile(r'\bfl oz\b', re.I), 20, 40)]

checked = 0
status = Counter(); by_src = defaultdict(Counter); flags = Counter(); examples = defaultdict(list)
diff_fields = Counter(); cat_flags = defaultdict(Counter); cat_count = Counter()
def flag(kind, r, detail=''):
    flags[kind] += 1
    cat_flags[db['categories'].get(str(r[ix['categoryId']]), '?')][kind] += 1
    if len(examples[kind]) < 12: examples[kind].append(f"{r[ix['name']][:70]} [{SOURCE[r[ix['source']]]}] {detail}".strip())

for r in db['foods']:
    checked += 1
    src = r[ix['source']]; name = r[ix['name']]; cat = db['categories'].get(str(r[ix['categoryId']]), '?')
    cat_count[cat] += 1
    extra = dict(zip(EXTRA, r[ix['extra']] or [None] * len(EXTRA)))
    vals = {k: r[ix[k]] for k in CORE}; vals.update(extra)
    # 1. Against the source row.
    s = source_values(r)
    if s is None:
        st = 'unable to verify'
    else:
        bad = [k for k in CORE + EXTRA if k in s and not close(vals.get(k), s.get(k), k)]
        if src == 'r': bad = [k for k in bad if k in CORE]
        st = 'differs' if bad else 'verified'
        for k in bad: diff_fields[k] += 1
        if bad and len(examples['differs from source']) < 15:
            examples['differs from source'].append(f"{name[:60]} [{SOURCE[src]}]: " + ', '.join(f"{k} {vals.get(k)} vs source {round(s.get(k), 2) if isinstance(s.get(k), float) else s.get(k)}" for k in bad[:3]))
    status[st] += 1; by_src[SOURCE[src]][st] += 1
    # 2. Plausibility.
    p, k, fat, c, fib = (vals[x] for x in CORE)
    if None in (k, p, fat, c): flag('missing calories or a macro', r, f"kcal {k}, protein {p}, carbs {c}, fat {fat}")
    for x in ('sugar', 'satFat', 'sodium'):
        if extra.get(x) is None: flags[f'missing {x}'] += 1
    if fib is None: flags['missing fibre'] += 1
    nums = [v for v in vals.values() if isinstance(v, (int, float))]
    if any(v < 0 for v in nums): flag('negative value', r)
    # UK carbohydrate is in monosaccharide equivalents, so pure sugar is 105 g per 100 g by convention.
    if any((vals[x] or 0) > (106 if src == 'u' and x == 'carbs' else 100) for x in ('protein', 'fat', 'carbs', 'fiber')): flag('a macro above 100 g per 100 g', r)
    # US carbohydrate already includes fibre; the other tables list available carbohydrate and fibre separately.
    total = None if None in (p, fat, c) else p + fat + c + (0 if src in ('s', 'f') else (fib or 0)) - (5 if src == 'u' and c > 50 else 0)
    if total is not None and total > 105: flag('macros add up to more than 100 g', r, f"{round(total, 1)} g")
    if k is not None and k > 902: flag('more than 900 kcal per 100 g', r, f"{k} kcal")
    if extra.get('satFat') is not None and fat is not None and extra['satFat'] > fat + 0.5: flag('saturated fat above total fat', r, f"{extra['satFat']} > {fat}")
    if extra.get('sugar') is not None and c is not None and extra['sugar'] > c + 1 and src in ('s', 'f'): flag('sugar above carbohydrate', r, f"{extra['sugar']} > {c}")
    if extra.get('sodium') is not None and extra['sodium'] > 40000: flag('sodium above 40 g per 100 g', r)
    if None not in (k, p, fat, c) and k >= 40:
        simple = 4 * p + 4 * c + 9 * fat
        if abs(k - simple) / k > 0.25:
            alc = ALCOHOL.search(name) or DRINK_CATS.match(cat)
            fibre_adj = simple + 2 * (fib or 0) if src in ('u', 'a', 'w', 'r') else simple - 2 * (fib or 0)
            special = re.search(r'\b(sugar[- ]free|sugarless|low calorie|diet|reduced calorie|cocoa|carob|bran|baking chocolate|psyllium|gelatin|baking powder|leavening)\b', name, re.I)
            if alc: flags['energy explained: alcohol'] += 1
            elif abs(k - fibre_adj) / k <= 0.25: flags['energy explained: fibre counted at 2 kcal/g'] += 1
            elif special: flags['energy explained: sugar alcohols or food-specific factors (cocoa, bran, sweeteners)'] += 1
            elif abs(k - simple) < 25: flags['energy explained: small difference on a low-energy food'] += 1
            else: flag('energy not explained by protein, carbs, fat, fibre or alcohol', r, f"{k} kcal vs {round(simple)}")
    # 3. Preparation state vs name.
    stt = r[ix['state']]
    if stt == 'raw' and COOKED.search(name) and not re.search(r'\bnot cooked\b', name, re.I) and not RAWW.search(name.split(',')[-1]): flag('marked raw but named as cooked', r)
    if stt == 'cooked' and RAWW.search(name) and not COOKED.search(name): flag('marked cooked but named raw', r)
    # 4. Servings.
    for lab, g in (r[ix['portions']] or []):
        if g is None or g <= 0: flag('serving with no weight', r, lab); continue
        if re.search(r'guideline|per fl oz of', lab, re.I): continue
        floz = re.search(r'(\d+(?:\.\d+)?)\s*fl\.? oz\b()', lab)
        if floz and float(floz.group(1) or floz.group(2)) > 1 and not re.search(r'prepared|reconstituted|to make|yield', lab, re.I):
            per = g / float(floz.group(1) or floz.group(2))
            if not 20 <= per <= 40: flag('serving weight out of the usual range', r, f"{lab} = {g} g")
            continue
        for re_, lo, hi in PORTION_RANGES:
            if re_.search(lab):
                n = float(re.match(r'^([\d.]+)', lab).group(1)) if re.match(r'^[\d.]+', lab) else 1
                per = g / n
                if not lo <= per <= hi: flag('serving weight out of the usual range', r, f"{lab} = {g} g")
                break

dups = Counter(r[ix['name']].strip().lower() for r in db['foods'])
groups = [n for n, c in dups.items() if c > 1]
ident = 0
for n in groups:
    rows = [r for r in db['foods'] if r[ix['name']].strip().lower() == n]
    if len({tuple(r[ix[k]] for k in CORE) for r in rows}) == 1: ident += 1

out = {
    'records': checked,
    'sources': {SOURCE[k]: sum(1 for r in db['foods'] if r[ix['source']] == k) for k in SOURCE},
    'status': dict(status), 'status_by_source': {k: dict(v) for k, v in by_src.items()},
    'fields_that_differ': dict(diff_fields),
    'flags': dict(flags), 'examples': dict(examples),
    'same_name_groups': len(groups), 'same_name_identical_values': ident,
    'categories_most_flagged': sorted(((c, sum(v.values()), cat_count[c]) for c, v in cat_flags.items()), key=lambda x: -x[1])[:20],
}
json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
