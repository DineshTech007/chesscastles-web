"""Splits the puzzle bank (scripts/build-puzzles.py: puzzles/<theme>.json) by
rating, for rated puzzles: one file per 100 rating points, each puzzle once,
with all its themes, so a player's next puzzle loads with one small file.

  python scripts/build-puzzle-bands.py static/data/puzzles

Writes puzzles/bands/<rating>.json (400, 500, ... 2800): [id, fen, moves, rating, [themes]].
"""
import glob
import json
import os
import sys

src = sys.argv[1]
out = os.path.join(src, 'bands')
os.makedirs(out, exist_ok=True)
puzzles = {}
for path in sorted(glob.glob(os.path.join(src, '*.json'))):
    theme = os.path.splitext(os.path.basename(path))[0]
    for pid, fen, moves, rating in json.load(open(path, encoding='utf-8')):
        p = puzzles.setdefault(pid, [pid, fen, moves, rating, []])
        p[4].append(theme)
bands = {}
for p in puzzles.values():
    bands.setdefault(max(400, min(2800, p[3] // 100 * 100)), []).append(p)
for band, list_ in sorted(bands.items()):
    list_.sort(key=lambda p: p[0])
    with open(os.path.join(out, f'{band}.json'), 'w', encoding='utf-8') as f:
        json.dump(list_, f, separators=(',', ':'))
print(len(puzzles), 'puzzles in', len(bands), 'bands:', ', '.join(f'{b}: {len(l)}' for b, l in sorted(bands.items())))
