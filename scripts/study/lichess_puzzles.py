"""Opening study puzzles from the Lichess puzzle database (CC0), by the opening tags Lichess gives each puzzle.

Each study opening and line maps to Lichess opening tags (the tag of the line
when Lichess has one; the opening's family tag otherwise, filed as "other").
Only well-tested, well-liked puzzles: popularity 60+, 300+ plays, rating
deviation 90 or less. Levels by puzzle rating: beginner under 1400,
intermediate 1400-1899, advanced 1900+. The endgame themes make an endgame
puzzle, anything else counts as middlegame (early tactics included). At most
PER puzzles per opening, line, part and level, spread over the ratings.

With src/lib/study/chapters.json (repertoire.py) the puzzles go to the
chapters: a chapter's Lichess opening name gives its tag ("Caro-Kann Defense:
Advance Variation" -> Caro-Kann_Defense_Advance_Variation); a tag shared by
several chapters goes to the one with the most games; the family tag to
"other".

Run: python scripts/study/lichess_puzzles.py F:/dev/gamesdb_work/puzzles/lichess_db_puzzle.csv.zst F:/dev/gamesdb_work/study/lichess.json [src/lib/study/chapters.json]
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


FAMILY = {"caro-kann": "Caro-Kann_Defense", "jobava-london": "Rapport-Jobava_System", "chebanenko": "Slav_Defense_Chebanenko_Variation"}


def tag_of(name):
    """Lichess's puzzle tag for an opening name: the family and its first variation."""
    family, _, rest = name.partition(":")
    variation = rest.split(",")[0].strip()
    t = f"{family.strip()} {variation}".strip() if variation else family.strip()
    return t.replace("'", "").replace(" ", "_")


# Only tags that belong to the opening itself (no London System or general Slav puzzles in it).
ALLOWED = {"caro-kann": ("Caro-Kann_Defense",), "jobava-london": ("Rapport-Jobava_System",), "chebanenko": ("Slav_Defense_Chebanenko_Variation",)}
# Lichess names for the student's own choices inside a chapter: the tag goes to the chapter (by its moves).
EXTRA = {
    "caro-kann": {
        "Caro-Kann_Defense_Classical_Variation": "e4 c6 d4 d5 Nc3",
        "Caro-Kann_Defense_Main_Line": "e4 c6 d4 d5 Nc3",
        "Caro-Kann_Defense_Karpov_Variation": "e4 c6 d4 d5 Nc3",
        "Caro-Kann_Defense_Tartakower_Variation": "e4 c6 d4 d5 Nc3",
        "Caro-Kann_Defense_Bronstein-Larsen_Variation": "e4 c6 d4 d5 Nc3",
        "Caro-Kann_Defense_Two_Knights_Attack": "e4 c6 Nc3",
    },
    "jobava-london": {"Rapport-Jobava_System_with_e6": "d4 Nf6 Bf4 d5 Nc3 e6"},
}


def chapter_map(path):
    """opening -> [(tag, chapter id)], most specific tag first; the family tag goes to "other"."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    out = {}
    for oid, d in data.items():
        best = {}
        for c in d["chapters"]:
            if not c.get("name"):
                continue
            t = tag_of(c["name"])
            if not t.startswith(ALLOWED[oid]):
                continue
            if t not in best or best[t][1] < c["games"]:
                best[t] = (c["id"], c["games"])
        by_sans = {c["sans"]: c["id"] for c in d["chapters"]}
        for t, sans in EXTRA.get(oid, {}).items():
            if sans in by_sans:
                best[t] = (by_sans[sans], 10**9)
        pairs = sorted(((cid, t) for t, (cid, _) in best.items() if t != FAMILY[oid]), key=lambda x: -len(x[1]))
        # (chapter, tag), as MAP: the most specific tags first, the family tag last.
        out[oid] = pairs + [("other", FAMILY[oid])]
    return out


def level(rating):
    return 1 if rating < 1400 else 2 if rating < 1900 else 3


def main():
    src, out = sys.argv[1], sys.argv[2]
    if len(sys.argv) > 3:
        MAP.clear()
        MAP.update(chapter_map(sys.argv[3]))
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
