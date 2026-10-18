"""Opening study puzzles from the Lichess puzzle database (CC0), by the opening tags Lichess gives each puzzle.

Each study opening and line maps to Lichess opening tags (the tag of the line
when Lichess has one; the opening's family tag otherwise, filed as "other").
Only well-tested, well-liked puzzles: popularity 60+, 300+ plays, rating
deviation 90 or less. Levels by puzzle rating: beginner under 1400,
intermediate 1400-1899, advanced 1900+. The endgame themes make an endgame
puzzle, anything else counts as middlegame (early tactics included). At most
PER puzzles per opening, line, part and level, spread over the ratings.

Run: python scripts/study/lichess_puzzles.py F:/dev/gamesdb_work/puzzles/lichess_db_puzzle.csv.zst F:/dev/gamesdb_work/study/lichess.json
"""

import csv
import io
import json
import random
import sys

import zstandard

PER = 40
# opening -> [(line, tag)], most specific first; the last entry is the family tag ("other").
MAP = {
    "caro-kann": [
        ("advance", "Caro-Kann_Defense_Advance_Variation"),
        ("classical", "Caro-Kann_Defense_Classical_Variation"),
        ("karpov", "Caro-Kann_Defense_Karpov_Variation"),
        ("exchange", "Caro-Kann_Defense_Exchange_Variation"),
        ("panov", "Caro-Kann_Defense_Panov_Attack"),
        ("fantasy", "Caro-Kann_Defense_Maroczy_Variation"),
        ("other", "Caro-Kann_Defense"),
    ],
    "jobava-london": [
        ("e6", "Rapport-Jobava_System_with_e6"),
        ("other", "Rapport-Jobava_System"),
    ],
    "chebanenko": [
        ("other", "Slav_Defense_Chebanenko_Variation"),
    ],
}
ENDGAME = {"endgame", "rookEndgame", "pawnEndgame", "queenEndgame", "bishopEndgame", "knightEndgame", "queenRookEndgame"}


def level(rating):
    return 1 if rating < 1400 else 2 if rating < 1900 else 3


def main():
    src, out = sys.argv[1], sys.argv[2]
    random.seed(7)
    buckets = {}  # (opening, line, phase, level) -> (seen, list)
    with open(src, "rb") as f:
        r = csv.reader(io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8"))
        head = next(r)
        col = {k: i for i, k in enumerate(head)}
        for row in r:
            tags = row[col["OpeningTags"]].split()
            if not tags:
                continue
            if int(row[col["Popularity"]]) < 60 or int(row[col["NbPlays"]]) < 300 or int(row[col["RatingDeviation"]]) > 90:
                continue
            for oid, lines in MAP.items():
                line = next((ln for ln, tag in lines if tag in tags), None)
                if not line:
                    continue
                rating = int(row[col["Rating"]])
                themes = row[col["Themes"]].split()
                fen = row[col["FEN"]]
                moves = row[col["Moves"]].split()
                # The solver is the side to move after the opponent's first move.
                side = "black" if fen.split()[1] == "w" else "white"
                mate = next((int(t[6:]) for t in themes if t.startswith("mateIn") and t[6:].isdigit()), None)
                p = {"src": "lichess", "pid": row[col["PuzzleId"]], "line": line, "fen": fen, "moves": moves, "side": side,
                     "phase": "endgame" if ENDGAME & set(themes) else "middlegame", "level": level(rating), "rating": rating}
                if mate:
                    p["mate"] = mate
                k = (oid, line, p["phase"], p["level"])
                seen, items = buckets.get(k, (0, []))
                seen += 1
                # Reservoir sampling: an even spread over the whole database.
                if len(items) < PER:
                    items.append(p)
                else:
                    j = random.randrange(seen)
                    if j < PER:
                        items[j] = p
                buckets[k] = (seen, items)
                break
    result = {}
    for (oid, line, phase, lv), (seen, items) in sorted(buckets.items()):
        result.setdefault(oid, []).extend(sorted(items, key=lambda x: x["rating"]))
        print(f"{oid:14s} {line:10s} {phase:10s} level {lv}: {len(items)} of {seen}")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f)


if __name__ == "__main__":
    main()
