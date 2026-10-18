"""Finds the games of the study openings in CaissaBase: model games and puzzle candidates.

For each opening in src/lib/study/repertoires.json, a game belongs to the
opening when it reaches the opening's position or one of its lines' positions
in the first 30 plies (so transpositions count), and to the deepest line it
reaches. Only classical over-the-board games between rated players count.

Model games: strong players (2450+ when there are enough, else 2300+), the
student's side winning first, recent games first.

Puzzle candidates: in games between 2000+ players, a moment where the side
to move wins material (2+ points within five plies) or mates soon after the
opponent's move; puzzles.mjs then checks each with Stockfish.

Run: python scripts/study/build.py F:/dev/caissabase_2024.db3 F:/dev/gamesdb_work/study
"""

import base64
import json
import os
import sqlite3
import sys

import chess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "masters"))
from extract import NOT_CLASSICAL, ONLINE_SITE  # noqa: E402

sys.path.insert(0, os.environ.get("CAISSA_TOOL", "F:/dev/knight24/tool/gamesdb"))
from caissa import mainline_bytes, ordered_legal_moves, position_key  # noqa: E402

CLASSIFY_PLIES = 30
VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
PUZZLE_GAMES_PER_LINE = 1200
ENDGAME_GAMES_PER_LINE = 300


def is_endgame(b):
    """No queens and at most a rook and a minor piece each, or very little material left."""
    w = sum(VALUE[p.piece_type] for p in b.piece_map().values() if p.color and p.piece_type not in (chess.PAWN, chess.KING))
    k = sum(VALUE[p.piece_type] for p in b.piece_map().values() if not p.color and p.piece_type not in (chess.PAWN, chess.KING))
    queens = bool(b.pieces(chess.QUEEN, chess.WHITE) or b.pieces(chess.QUEEN, chess.BLACK))
    return (not queens and w <= 8 and k <= 8) or w + k <= 13
MODELS_PER_LINE = 10


def key_after(sans):
    b = chess.Board()
    for s in sans.split():
        b.push_san(s)
    return position_key(b)


def decode(raw, limit=None):
    """The game's moves (chess.Move), the first `limit` only when given."""
    b = chess.Board()
    out = []
    for byte in mainline_bytes(raw):
        if limit is not None and len(out) >= limit:
            break
        legal = ordered_legal_moves(b)
        if byte >= len(legal):
            return None
        m = legal[byte]
        b.push(m)
        out.append(m)
    return out


def balance(b, colour):
    s = 0
    for p in b.piece_map().values():
        if p.piece_type == chess.KING:
            continue
        s += VALUE[p.piece_type] if p.color == colour else -VALUE[p.piece_type]
    return s


def puzzle_candidates(moves):
    """Plies where the side to move wins 2+ points within five plies, or mates within seven."""
    b = chess.Board()
    boards = []
    for m in moves:
        boards.append(b.copy(stack=False))
        b.push(m)
    boards.append(b.copy(stack=False))
    mate_at = len(moves) if b.is_checkmate() else None
    out = []
    p = 14
    while p < len(moves) - 1:
        side = boards[p].turn
        gain = balance(boards[min(p + 5, len(moves))], side) - balance(boards[p], side)
        mates = mate_at is not None and mate_at - p <= 7 and (mate_at - p) % 2 == 1
        captured_before = boards[p - 1].piece_at(moves[p - 1].to_square) is not None
        if (gain >= 2 or mates) and not captured_before:
            out.append(p)
            p += 8  # one puzzle per fight
        else:
            p += 1
    return out[:3], boards


def main():
    db_path, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(HERE, "..", "..", "src", "lib", "study", "repertoires.json"), encoding="utf-8") as f:
        reps = json.load(f)
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    players = dict(db.execute("SELECT ID, Name FROM Players"))
    events = dict(db.execute("SELECT ID, Name FROM Events"))
    sites = dict(db.execute("SELECT ID, Name FROM Sites"))

    models, candidates, stats, endgames = {}, [], {}, []
    for oid, rep in reps.items():
        root = key_after(rep["root"])
        lines = sorted(((ln["id"], key_after(ln["sans"]), len(ln["sans"].split())) for ln in rep["lines"]), key=lambda x: -x[2])
        keys = {root} | {k for _, k, _ in lines}
        ecos = ",".join(f"'{e}'" for e in rep["eco"])
        found = []
        rows = db.execute(
            f"SELECT ID, EventID, SiteID, Date, WhiteID, WhiteElo, BlackID, BlackElo, Result, Moves FROM Games "
            f"WHERE substr(ECO, 1, 3) IN ({ecos}) AND FEN IS NULL AND PlyCount >= 30 AND WhiteElo >= 2000 AND BlackElo >= 2000"
        )
        for gid, eid, sid, date, wid, welo, bid, belo, result, raw in rows:
            event = events.get(eid) or ""
            if NOT_CLASSICAL.search(event) or ONLINE_SITE.search(sites.get(sid) or "") or result not in ("1-0", "0-1", "1/2-1/2"):
                continue
            first = decode(raw or b"", CLASSIFY_PLIES)
            if not first:
                continue
            b = chess.Board()
            seen = set()
            for m in first:
                b.push(m)
                k = position_key(b)
                if k in keys:
                    seen.add(k)
            if not seen:
                continue
            line = next((lid for lid, k, _ in lines if k in seen), "other")
            year = int((date or "0")[:4]) if (date or "")[:4].isdigit() else 0
            found.append({"id": gid, "line": line, "white": players.get(wid, "?"), "black": players.get(bid, "?"), "we": welo, "be": belo,
                          "year": year, "event": event, "result": result, "raw": raw})
        side = rep["side"]
        won = "1-0" if side == "white" else "0-1"
        mine = (lambda g: g["we"]) if side == "white" else (lambda g: g["be"])
        theirs = (lambda g: g["be"]) if side == "white" else (lambda g: g["we"])
        models[oid] = {}
        by_line = {}
        for g in found:
            by_line.setdefault(g["line"], []).append(g)
        stats[oid] = {ln: len(gs) for ln, gs in by_line.items()}
        for ln, gs in by_line.items():
            def rank(g):
                return (g["result"] == won) * 400 + (g["result"] == "1/2-1/2") * 100 + mine(g) + theirs(g) / 2 + min(g["year"], 2024) * 2
            strong = [g for g in gs if mine(g) >= 2450 and theirs(g) >= 2350]
            pool = strong if len(strong) >= 4 else [g for g in gs if mine(g) >= 2300 and theirs(g) >= 2200]
            picked = sorted(pool, key=rank, reverse=True)[:MODELS_PER_LINE]
            models[oid][ln] = [{k: v for k, v in g.items() if k != "raw"} for g in picked]
            # Puzzle candidates: the stronger and more recent games first.
            sample = sorted(gs, key=lambda g: (min(g["year"], 2024), g["we"] + g["be"]), reverse=True)[:PUZZLE_GAMES_PER_LINE]
            eg_count = 0
            for g in sample:
                moves = decode(g["raw"] or b"")
                if not moves:
                    continue
                # The game's endgame, for puzzles found by the engine (puzzles.mjs scan).
                if eg_count < ENDGAME_GAMES_PER_LINE:
                    b = chess.Board()
                    for i, m in enumerate(moves):
                        if i >= 20 and is_endgame(b):
                            if len(moves) - i >= 10:
                                endgames.append({"opening": oid, "line": ln, "game": g["id"], "white": g["white"], "black": g["black"], "we": g["we"],
                                                 "be": g["be"], "year": g["year"], "event": g["event"], "fen": b.fen(), "moves": [x.uci() for x in moves[i : i + 70]]})
                                eg_count += 1
                            break
                        b.push(m)
                plies, boards = puzzle_candidates(moves)
                for p in plies:
                    candidates.append({
                        "opening": oid, "line": ln, "game": g["id"], "white": g["white"], "black": g["black"], "we": g["we"], "be": g["be"],
                        "year": g["year"], "event": g["event"],
                        "fen": boards[p - 1].fen(), "first": moves[p - 1].uci(), "played": [m.uci() for m in moves[p : p + 7]],
                    })
        print(oid, "games per line:", stats[oid], flush=True)
    with open(os.path.join(out_dir, "models.json"), "w", encoding="utf-8") as f:
        json.dump(models, f)
    with open(os.path.join(out_dir, "candidates.json"), "w", encoding="utf-8") as f:
        json.dump(candidates, f)
    with open(os.path.join(out_dir, "endgames.json"), "w", encoding="utf-8") as f:
        json.dump(endgames, f)
    print(len(endgames), "endgames for the engine scan")
    with open(os.path.join(out_dir, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f)
    print(len(candidates), "puzzle candidates")


if __name__ == "__main__":
    main()
