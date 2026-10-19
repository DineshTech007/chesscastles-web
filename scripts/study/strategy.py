"""What happens after the opening in each chapter: middlegame facts counted from the chapter's games.

For a sample of each opening's games (scan.py), put in their chapter (the
deepest chapter position reached in 30 plies), and from the student's side's
point of view:
  castling      which side each player castled on by move 20
  pawns         the pawn moves each side made by move 25 that weren't in the
                chapter's own moves (breaks and storms: ...c5, g4, h4...), in
                how many games, and the student's score with and without them
  pieces        where the student's knights and bishops stood at move 15
  queens        how often the queens were traded by move 25
  endgames      which endgame the games reached (rook, minor piece...)
Only facts with enough games are kept. Written to <work>/<opening>.strategy.json
(chapter id -> facts); puzzles.mjs build puts them in the site data.

Run: python scripts/study/strategy.py F:/dev/gamesdb_work/study2 src/lib/study/chapters.json
"""

import json
import os
import random
import sys
from collections import Counter, defaultdict

import chess

sys.path.insert(0, os.environ.get("CAISSA_TOOL", "F:/dev/knight24/tool/gamesdb"))
from caissa import position_key  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from openings_cfg import SIDE  # noqa: E402
SAMPLE = 12000
MIN_GAMES = 40
VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def endgame_kind(b):
    w = sorted(p.piece_type for p in b.piece_map().values() if p.color and p.piece_type not in (chess.PAWN, chess.KING))
    k = sorted(p.piece_type for p in b.piece_map().values() if not p.color and p.piece_type not in (chess.PAWN, chess.KING))
    if not w and not k:
        return "pawn"
    if chess.QUEEN in w + k:
        return "queen" if w == k == [chess.QUEEN] else None
    if w == k == [chess.ROOK] or w == k == [chess.ROOK, chess.ROOK]:
        return "rook"
    minor = {chess.KNIGHT, chess.BISHOP}
    if len(w) == 1 and len(k) == 1 and w[0] in minor and k[0] in minor:
        return "minor"
    if len(w) == 2 and len(k) == 2 and chess.ROOK in w and chess.ROOK in k:
        return "rook-minor"
    return None


def is_endgame(b):
    w = sum(VALUE[p.piece_type] for p in b.piece_map().values() if p.color and p.piece_type not in (chess.PAWN, chess.KING))
    k = sum(VALUE[p.piece_type] for p in b.piece_map().values() if not p.color and p.piece_type not in (chess.PAWN, chess.KING))
    queens = bool(b.pieces(chess.QUEEN, chess.WHITE) or b.pieces(chess.QUEEN, chess.BLACK))
    return (not queens and w <= 8 and k <= 8) or w + k <= 13


def main():
    work, chapters_path = sys.argv[1], sys.argv[2]
    chapters = json.load(open(chapters_path, encoding="utf-8"))
    random.seed(5)
    for oid, d in chapters.items():
        me = chess.WHITE if SIDE[oid] == "white" else chess.BLACK
        keys = {c["key"]: c for c in d["chapters"]}
        depth = {c["key"]: len(c["sans"].split()) for c in d["chapters"]}
        games = [json.loads(line) for line in open(os.path.join(work, f"{oid}.jsonl"), encoding="utf-8")]
        random.shuffle(games)
        games = games[:SAMPLE]
        acc = defaultdict(lambda: {"n": 0, "score": 0.0, "castle": {True: Counter(), False: Counter()}, "pawns": {True: Counter(), False: Counter()},
                                   "pawn_score": {True: Counter(), False: Counter()}, "squares": Counter(), "queens": 0, "endgames": Counter()})
        for g in games:
            ms = g["m"].split()
            b = chess.Board()
            hit = None
            boards = []
            for i, u in enumerate(ms[:60]):
                m = chess.Move.from_uci(u)
                boards.append((b.copy(stack=False), m))
                b.push(m)
                if i < 30:
                    k = format(position_key(b), "016x")
                    if k in keys and (hit is None or depth[k] > depth[hit]):
                        hit = k
            if hit is None:
                continue
            c = keys[hit]
            a = acc[c["id"]]
            a["n"] += 1
            r = g["r"]
            mine = 0.5 if r == "1/2-1/2" else 1.0 if (r == "1-0") == (me == chess.WHITE) else 0.0
            a["score"] += mine
            start = len(c["sans"].split())
            castled = {True: None, False: None}
            pawns_seen = {True: set(), False: set()}
            for i, (pos, m) in enumerate(boards):
                side = pos.turn
                mover_is_me = side == me
                if i < 40 and pos.is_castling(m) and castled[mover_is_me] is None:
                    castled[mover_is_me] = "O-O" if chess.square_file(m.to_square) > chess.square_file(m.from_square) else "O-O-O"
                if start <= i < 50 and pos.piece_type_at(m.from_square) == chess.PAWN:
                    # The move as written (c5, cxd4, h5): pushes are plans, captures are what follows them.
                    pawns_seen[mover_is_me].add(pos.san(m).rstrip("+#"))
                if i == 30:
                    for sq, p in pos.piece_map().items():
                        if p.color == me and p.piece_type in (chess.KNIGHT, chess.BISHOP):
                            a["squares"][("N" if p.piece_type == chess.KNIGHT else "B") + chess.square_name(sq)] += 1
            for who in (True, False):
                a["castle"][who][castled[who] or "none"] += 1
                for sq in pawns_seen[who]:
                    a["pawns"][who][sq] += 1
                    a["pawn_score"][who][sq] += mine
            # Queens off by move 25.
            if len(boards) > 50:
                b50 = boards[50][0]
                if not b50.pieces(chess.QUEEN, chess.WHITE) and not b50.pieces(chess.QUEEN, chess.BLACK):
                    a["queens"] += 1
            # The endgame the game reached.
            b = chess.Board()
            for u in ms:
                b.push(chess.Move.from_uci(u))
                if b.ply() >= 30 and is_endgame(b):
                    kind = endgame_kind(b)
                    if kind:
                        a["endgames"][kind] += 1
                    break
        out = {}
        for cid, a in acc.items():
            n = a["n"]
            if n < MIN_GAMES:
                continue
            facts = {"games": n, "score": round(a["score"] / n, 3)}
            facts["castle"] = {("me" if who else "them"): {k: round(v / n, 3) for k, v in a["castle"][who].items()} for who in (True, False)}
            pawns = {}
            for who in (True, False):
                rows = []
                for sq, cnt in a["pawns"][who].most_common(8):
                    if cnt / n < 0.2:
                        continue
                    with_score = a["pawn_score"][who][sq] / cnt
                    without = (a["score"] - a["pawn_score"][who][sq]) / max(1, n - cnt)
                    rows.append({"sq": sq, "share": round(cnt / n, 3), "with": round(with_score, 3), "without": round(without, 3) if n - cnt >= 15 else None, "push": "x" not in sq})
                pawns["me" if who else "them"] = rows[:4]
            facts["pawns"] = pawns
            facts["pieces"] = [{"p": k, "share": round(v / n, 3)} for k, v in a["squares"].most_common(6) if v / n >= 0.25][:4]
            facts["queens"] = round(a["queens"] / n, 3)
            total_eg = sum(a["endgames"].values())
            facts["endgames"] = {k: round(v / n, 3) for k, v in a["endgames"].most_common(3) if v / n >= 0.08}
            facts["endgameGames"] = total_eg
            out[cid] = facts
        with open(os.path.join(work, f"{oid}.strategy.json"), "w", encoding="utf-8") as f:
            json.dump(out, f)
        print(oid, len(out), "chapters with middlegame facts")


if __name__ == "__main__":
    main()
