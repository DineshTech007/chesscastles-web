"""Game segments for the engine's puzzle scan (puzzles.mjs scan), from each chapter's own games.

The endgames come from repertoire.py (<opening>.endgames.json). The middlegames
are the same chapter games (and the model games) from move 8 to move 30: the
engine follows them move by move and every blunder or missed win becomes a
puzzle.

Run: python scripts/study/segments.py F:/dev/gamesdb_work/study2
"""

import json
import os
import sys

import chess

START, END = 14, 60


def main():
    work = sys.argv[1]
    only = sys.argv[2] if len(sys.argv) > 2 else None
    out = []
    for oid in ("caro-kann", "jobava-london", "chebanenko"):
        if only and oid != only:
            continue
        games = {}
        for line in open(os.path.join(work, f"{oid}.jsonl"), encoding="utf-8"):
            g = json.loads(line)
            games[g["id"]] = g
        endgames = json.load(open(os.path.join(work, f"{oid}.endgames.json"), encoding="utf-8"))
        out += endgames
        models = json.load(open(os.path.join(work, f"{oid}.models.json"), encoding="utf-8"))
        picked = {}
        for e in endgames:
            picked.setdefault(e["line"], []).append(e["game"])
        for chapter, ms in models.items():
            for m in ms:
                picked.setdefault(chapter, []).append(m["id"])
        n = 0
        for chapter, ids in picked.items():
            for gid in dict.fromkeys(ids):
                g = games.get(gid)
                if not g:
                    continue
                ms = g["m"].split()
                if len(ms) < START + 12:
                    continue
                b = chess.Board()
                for u in ms[:START]:
                    b.push(chess.Move.from_uci(u))
                out.append({"opening": oid, "line": chapter, "game": gid, "white": g["w"], "black": g["b"], "we": g["we"], "be": g["be"],
                            "year": g["y"], "event": g["ev"], "fen": b.fen(), "moves": ms[START:END]})
                n += 1
        print(oid, len(endgames), "endgames,", n, "middlegames")
    with open(os.path.join(work, f"segments{'-' + only if only else ''}.json"), "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(len(out), "segments")


if __name__ == "__main__":
    main()
