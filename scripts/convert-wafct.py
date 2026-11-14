#!/usr/bin/env python3
"""
Convert the FAO/INFOODS West African Food Composition Table (WAFCT 2019) to JSON
for scripts/build-foods.mjs.

  Download: https://www.fao.org/fileadmin/user_upload/faoweb/2020/WAFCT_2019.xlsx
  python3 scripts/convert-wafct.py WAFCT_2019.xlsx wafct.json

Values are copied from sheet "03 NV_sum_39 (per 100g EP)". Square brackets in the
table mark values of lower quality (e.g. derived or borrowed); the number itself is
kept unchanged and the flag is recorded. Empty cells stay null.
"""
import json, re, sys
import openpyxl

src, dest = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
ws = wb['03 NV_sum_39 (per 100g EP)']
rows = list(ws.iter_rows(values_only=True))
header = [str(c or '') for c in rows[0]]
tags = [str(c or '').strip() for c in rows[2]]

def col(tag, label_start=None):
    for i, t in enumerate(tags):
        if t == tag and (label_start is None or header[i].startswith(label_start)):
            return i
    raise KeyError(tag)

C = {
    'code': 0, 'name': 1, 'source': 4,
    'kcal': next(i for i, h in enumerate(header) if h.startswith('Energy') and 'kcal' in h),
    'protein': col('PROTCNT'), 'fat': col('FAT'), 'carbs': col('CHOAVLDF'), 'fiber': col('FIBTG'),
    'satFat': col('FASAT'), 'cholesterol': col('CHOLE'), 'sodium': col('NA'), 'potassium': col('K'),
    'calcium': col('CA'), 'iron': col('FE'), 'magnesium': col('MG'), 'zinc': col('ZN'),
    'vitA': col('VITA_RAE'), 'vitC': col('VITC'), 'vitD': col('VITD'), 'vitB12': col('VITB12'), 'folate': col('FOLDFE'),
}
EXTRA = ['satFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'zinc', 'vitA', 'vitC', 'vitD', 'vitB12', 'folate']

def num(v):
    if v is None or str(v).strip() in ('', '-', 'tr'):
        return None, False
    s = str(v).strip()
    flagged = s.startswith('[')
    s = s.strip('[]').replace(',', '.')
    try:
        return float(s), flagged
    except ValueError:
        return None, False

foods, group = [], None
for r in rows[3:]:
    code, name = r[C['code']], r[C['name']]
    if code and not name:
        group = str(code).split('/')[0].strip()
        continue
    if not code or not name:
        continue
    protein, pflag = num(r[C['protein']])
    if protein is None:
        continue
    vals = {k: num(r[C[k]])[0] for k in ('kcal', 'fat', 'carbs', 'fiber', *EXTRA)}
    foods.append({
        'code': str(code), 'name': re.sub(r'\s+', ' ', str(name)).strip(), 'group': group,
        'protein': protein, 'proteinFlagged': pflag, **vals,
        'origin': str(r[C['source']] or '').strip()[:80],
    })

json.dump({'source': 'FAO/INFOODS West African Food Composition Table 2019', 'foods': foods}, open(dest, 'w'))
print(f'{len(foods)} foods written to {dest}')
