"""Builds the Ratings page's FIDE lists from FIDE's monthly combined rating
list (https://ratings.fide.com/download/players_list.zip).

  python scripts/build-fide-list.py F:/dev/gamesdb_work/fide/players_list.zip static/data/fide

Writes, for players with at least one rating:
  fed/<CODE>.json  every rated player of a federation
  world.json       the world's best (open, women, juniors, girls) by classical, rapid and blitz
  meta.json        the list's month and the federations with their player counts

A player is [id, name, title, sex, classical, rapid, blitz, birth year, inactive]
(0 for a rating the player doesn't have).
"""
import json
import os
import sys
import zipfile
from datetime import date

src, out = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
name = z.namelist()[0]
period = date.fromtimestamp(os.path.getmtime(src)).strftime('%Y-%m')
lines = z.open(name).read().decode('latin-1').splitlines()
header = lines[0]
cols = ['ID Number', 'Name', 'Fed', 'Sex', 'Tit', 'WTit', 'OTit', 'FOA', 'SRtng', 'SGm', 'SK', 'RRtng', 'RGm', 'Rk', 'BRtng', 'BGm', 'BK', 'B-day', 'Flag']
starts = [header.index(c) for c in cols]
spans = {c: (starts[i], starts[i + 1] if i + 1 < len(starts) else None) for i, c in enumerate(cols)}


def field(line, c):
    a, b = spans[c]
    return line[a:b].strip()


def num(s):
    try:
        return int(s)
    except ValueError:
        return 0


players = []
for line in lines[1:]:
    if not line.strip():
        continue
    s, r, b = num(field(line, 'SRtng')), num(field(line, 'RRtng')), num(field(line, 'BRtng'))
    if not (s or r or b):
        continue
    title = field(line, 'Tit') or field(line, 'WTit')
    flag = field(line, 'Flag')
    players.append([
        num(field(line, 'ID Number')),
        field(line, 'Name'),
        title,
        field(line, 'Sex'),
        s, r, b,
        num(field(line, 'B-day')),
        1 if 'i' in flag else 0,
        field(line, 'Fed'),
    ])

os.makedirs(os.path.join(out, 'fed'), exist_ok=True)
by_fed = {}
for p in players:
    by_fed.setdefault(p[9], []).append(p[:9])
for fed, ps in by_fed.items():
    ps.sort(key=lambda p: (-p[4], -p[5], -p[6]))
    with open(os.path.join(out, 'fed', f'{fed}.json'), 'w', encoding='utf-8') as f:
        json.dump(ps, f, ensure_ascii=False, separators=(',', ':'))

# The world file: the best players of each list, with their federation.
year = int(period[:4])
keep = {}
for k in (4, 5, 6):
    for group, test, n in (
        ('open', lambda p: True, 1500),
        ('women', lambda p: p[3] == 'F', 800),
        ('juniors', lambda p: p[7] and year - p[7] <= 20, 800),
        ('girls', lambda p: p[3] == 'F' and p[7] and year - p[7] <= 20, 500),
    ):
        for p in sorted((p for p in players if p[k] and test(p)), key=lambda p: -p[k])[:n]:
            keep[p[0]] = p
world = sorted(keep.values(), key=lambda p: -p[4])
with open(os.path.join(out, 'world.json'), 'w', encoding='utf-8') as f:
    json.dump(world, f, ensure_ascii=False, separators=(',', ':'))

meta = {'period': period, 'players': len(players), 'feds': sorted(([k, len(v)] for k, v in by_fed.items()), key=lambda x: -x[1])}
with open(os.path.join(out, 'meta.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, separators=(',', ':'))
print(len(players), 'rated players,', len(by_fed), 'federations,', len(world), 'in the world file; India', len(by_fed.get('IND', [])))
