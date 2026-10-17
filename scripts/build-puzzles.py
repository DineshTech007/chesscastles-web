"""Builds Knight24's puzzle bank from the Lichess puzzle database (CC0).

  python scripts/build-puzzles.py F:/dev/gamesdb_work/puzzles/lichess_db_puzzle.csv.zst static/data

Writes:
  puzzles/<theme>.json  well-liked puzzles of one theme, spread over ratings 400-3000
  vision.json           small positions with short solutions, for blindfold solving

Each puzzle is [id, fen, moves, rating]: as on Lichess, the FEN is the
position before the opponent's move, the first move is the opponent's and
the rest is the solution.
"""
import csv
import io
import json
import os
import random
import sys

import zstandard

THEMES = [
    'fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'doubleCheck', 'mateIn1', 'mateIn2', 'mateIn3',
    'backRankMate', 'smotheredMate', 'sacrifice', 'deflection', 'attraction', 'trappedPiece', 'intermezzo',
    'xRayAttack', 'clearance', 'interference', 'quietMove', 'defensiveMove', 'zugzwang', 'advancedPawn', 'promotion',
    'kingsideAttack', 'exposedKing', 'opening', 'middlegame', 'endgame', 'rookEndgame', 'pawnEndgame', 'queenEndgame',
    'bishopEndgame', 'knightEndgame', 'crushing', 'short', 'long', 'equality', 'advantage',
]
PER_BUCKET = 60          # per theme and 100-point rating band
VISION_PER_BUCKET = 160  # per 100-point band, 400-2400
VISION_THEMES = {'mateIn1', 'mateIn2', 'short', 'oneMove', 'hangingPiece', 'fork', 'pin', 'skewer', 'backRankMate'}

src, out = sys.argv[1], sys.argv[2]
random.seed(24)
theme_res = {t: {} for t in THEMES}   # theme -> bucket -> (seen, list)
vision_res = {}


def reservoir(store, key, item, k):
    seen, items = store.get(key, (0, []))
    seen += 1
    if len(items) < k:
        items.append(item)
    else:
        j = random.randrange(seen)
        if j < k:
            items[j] = item
    store[key] = (seen, items)


def pieces(fen):
    return sum(1 for c in fen.split(' ')[0] if c.isalpha())


n = 0
with open(src, 'rb') as fh:
    reader = csv.reader(io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(fh), encoding='utf-8'))
    header = next(reader)
    col = {h: i for i, h in enumerate(header)}
    for row in reader:
        n += 1
        try:
            rating = int(row[col['Rating']])
            dev = int(row[col['RatingDeviation']])
            pop = int(row[col['Popularity']])
            plays = int(row[col['NbPlays']])
        except ValueError:
            continue
        if pop < 85 or plays < 400 or dev > 85:
            continue
        themes = set(row[col['Themes']].split())
        item = [row[col['PuzzleId']], row[col['FEN']], row[col['Moves']], rating]
        bucket = max(4, min(29, rating // 100))
        for t in themes:
            if t in theme_res:
                reservoir(theme_res[t], bucket, item, PER_BUCKET)
        moves = len(item[2].split())
        if 400 <= rating < 2500 and moves in (2, 4) and pieces(item[1]) <= 10 and themes & VISION_THEMES:
            reservoir(vision_res, rating // 100, item, VISION_PER_BUCKET)
        if n % 1000000 == 0:
            print(n, 'puzzles read', flush=True)

os.makedirs(os.path.join(out, 'puzzles'), exist_ok=True)
total = 0
for t, buckets in theme_res.items():
    items = sorted((i for _, (_, l) in buckets.items() for i in l), key=lambda x: x[3])
    total += len(items)
    with open(os.path.join(out, 'puzzles', f'{t}.json'), 'w', encoding='utf-8') as f:
        json.dump(items, f, separators=(',', ':'))
vision = sorted((i for _, (_, l) in vision_res.items() for i in l), key=lambda x: x[3])
with open(os.path.join(out, 'vision.json'), 'w', encoding='utf-8') as f:
    json.dump(vision, f, separators=(',', ':'))
print(n, 'read;', total, 'theme puzzles in', len(THEMES), 'files;', len(vision), 'vision puzzles')
