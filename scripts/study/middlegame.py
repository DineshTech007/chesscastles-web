"""Middlegame lessons for the opening study: continue a model game right after the opening.

For each chapter (repertoire.py), up to LESSONS of its model games won by the
student's side: the lesson starts a few moves after the chapter's position
(at the student's turn, ply 16 at the earliest) and follows the next 24 plies
of the game. middlegame.mjs then checks every move of the strong player with
Stockfish, as the endgame lessons do.

Run: python scripts/study/middlegame.py F:/dev/gamesdb_work/study2 src/lib/study/chapters.json
"""

import json
import os
import sys

import chess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from openings_cfg import SIDE  # noqa: E402
LESSONS = 3
SEGMENT = 24


def main():
    work, chapters_path = sys.argv[1], sys.argv[2]
    only = sys.argv[3] if len(sys.argv) > 3 else None
    chapters = json.load(open(chapters_path, encoding="utf-8"))
    out = []
    for oid, side in SIDE.items():
        if only and oid != only:
            continue
        moves_of = {}
        for line in open(os.path.join(work, f"{oid}.jsonl"), encoding="utf-8"):
            g = json.loads(line)
            moves_of[g["id"]] = g["m"].split()
        models = json.load(open(os.path.join(work, f"{oid}.models.json"), encoding="utf-8"))
        won = "1-0" if side == "white" else "0-1"
        for c in chapters[oid]["chapters"]:
            ply0 = len(c["sans"].split())
            n = 0
            for g in models.get(c["id"], []):
                if n >= LESSONS or g["result"] != won:
                    continue
                ms = moves_of.get(g["id"])
                if not ms:
                    continue
                start = max(ply0 + 2, 16)
                # The student's turn.
                if (start % 2 == 0) != (side == "white"):
                    start += 1
                if len(ms) < start + 12:
                    continue
                b = chess.Board()
                for u in ms[:start]:
                    b.push(chess.Move.from_uci(u))
                out.append({
                    "opening": oid, "chapter": c["id"], "game": g["id"], "white": g["white"], "black": g["black"], "whiteElo": g["we"], "blackElo": g["be"],
                    "event": g["event"], "year": g["year"], "result": g["result"], "color": side, "fen": b.fen(), "ply": start,
                    "moves": ms[start : start + SEGMENT], "toEnd": len(ms) - start,
                })
                n += 1
    with open(os.path.join(work, f"middlegame{'-' + only if only else ''}.json"), "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(len(out), "middlegame lesson candidates")


if __name__ == "__main__":
    main()
