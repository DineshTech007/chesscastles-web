"""More puzzle material: each chapter's games between players rated 1800-2150 (CaissaBase's ratings).

Those games have more tactical mistakes than masters' games, at the level of
the site's students. Each game is put in its chapter (the deepest chapter
position it reaches in 30 plies), and the segment from ply 12 to ply 80 goes to
the engine's scan (puzzles.mjs scan), which turns every clear blunder or
missed win into a puzzle.

Run: python scripts/study/segments2.py F:/dev/gamesdb_work/study2 src/lib/study/chapters.json
"""

import json
import os
import random
import sys

import chess

sys.path.insert(0, os.environ.get("CAISSA_TOOL", "F:/dev/knight24/tool/gamesdb"))
from caissa import position_key  # noqa: E402

PER_CHAPTER = 120
START, END = 12, 80


def main():
    work, chapters_path = sys.argv[1], sys.argv[2]
    chapters = json.load(open(chapters_path, encoding="utf-8"))
    random.seed(11)
    out = []
    for oid, d in chapters.items():
        keys = {c["key"]: c["id"] for c in d["chapters"]}
        depth = {c["key"]: len(c["sans"].split()) for c in d["chapters"]}
        pool = []
        for line in open(os.path.join(work, f"{oid}.jsonl"), encoding="utf-8"):
            g = json.loads(line)
            if g["we"] <= 2150 and g["be"] <= 2150 and g["r"] != "1/2-1/2":
                pool.append(g)
        random.shuffle(pool)
        taken = {}
        for g in pool:
            ms = g["m"].split()
            if len(ms) < START + 16:
                continue
            b = chess.Board()
            hit = None
            for u in ms[:30]:
                b.push(chess.Move.from_uci(u))
                k = format(position_key(b), "016x")
                if k in keys and (hit is None or depth[k] > depth[hit]):
                    hit = k
            if hit is None:
                continue
            cid = keys[hit]
            if taken.get(cid, 0) >= PER_CHAPTER:
                continue
            taken[cid] = taken.get(cid, 0) + 1
            b = chess.Board()
            for u in ms[:START]:
                b.push(chess.Move.from_uci(u))
            out.append({"opening": oid, "line": cid, "game": g["id"], "white": g["w"], "black": g["b"], "we": g["we"], "be": g["be"],
                        "year": g["y"], "event": g["ev"], "fen": b.fen(), "moves": ms[START:END]})
            if all(taken.get(c["id"], 0) >= PER_CHAPTER for c in d["chapters"]):
                break
        print(oid, sum(taken.values()), "games over", len(taken), "chapters")
    with open(os.path.join(work, "segments2.json"), "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(len(out), "segments")


if __name__ == "__main__":
    main()
