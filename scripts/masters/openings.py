"""Builds each master's opening repertoire for the opening trainer, from CaissaBase.

For every teacher in extract.py and each colour: in the first 24 plies of
their classical over-the-board games, the moves they chose (their turns) and
the replies they met (the opponent's turns), with how often and how they
scored. The website reads one small file per teacher and colour, keyed like
the games book (Polyglot key with dartchess's en passant rule).

Run: python scripts/masters/openings.py F:/dev/caissabase_2024.db3 static/data/masters/openings
"""

import base64
import json
import os
import sqlite3
import sys

import chess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import NOT_CLASSICAL, ONLINE_SITE, TEACHERS  # noqa: E402

sys.path.insert(0, os.environ.get("CAISSA_TOOL", "F:/dev/knight24/tool/gamesdb"))
from caissa import DecodeError, decode_game, position_key  # noqa: E402

PLIES = 24
TOP = 4


def main():
    db_path, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    teacher_of = {}
    for t, names in TEACHERS.items():
        for n in names:
            for (pid,) in db.execute("SELECT ID FROM Players WHERE Name = ?", (n,)):
                teacher_of[pid] = t
    events = dict(db.execute("SELECT ID, Name FROM Events"))
    sites = dict(db.execute("SELECT ID, Name FROM Sites"))
    ids = ",".join(str(i) for i in teacher_of)
    # (teacher, colour) -> key -> uci -> [games, wins, draws] for the side that moved
    tables = {}
    counts = {}
    rows = db.execute(
        f"SELECT ID, EventID, SiteID, WhiteID, BlackID, Result, Moves, WhiteMaterial, BlackMaterial "
        f"FROM Games WHERE (WhiteID IN ({ids}) OR BlackID IN ({ids})) AND FEN IS NULL AND PlyCount >= 20"
    )
    for gid, eid, sid, wid, bid, result, moves, wmat, bmat in rows:
        if NOT_CLASSICAL.search(events.get(eid) or "") or ONLINE_SITE.search(sites.get(sid) or ""):
            continue
        if result not in ("1-0", "0-1", "1/2-1/2"):
            continue
        try:
            ms = decode_game({"ID": gid, "FEN": None, "Moves": base64.b64encode(moves or b"").decode(), "WhiteMaterial": wmat, "BlackMaterial": bmat})
        except DecodeError:
            continue
        for tid, colour in ((wid, "white"), (bid, "black")):
            t = teacher_of.get(tid)
            if not t:
                continue
            table = tables.setdefault((t, colour), {})
            counts[(t, colour)] = counts.get((t, colour), 0) + 1
            b = chess.Board()
            for m in ms[:PLIES]:
                key = format(position_key(b), "x")
                mover_white = b.turn == chess.WHITE
                won = (result == "1-0") == mover_white and result != "1/2-1/2"
                s = table.setdefault(key, {}).setdefault(m.uci(), [0, 0, 0])
                s[0] += 1
                s[1] += 1 if won else 0
                s[2] += 1 if result == "1/2-1/2" else 0
                b.push(m)
    for (t, colour), table in tables.items():
        pos = {}
        for key, moves in table.items():
            total = sum(v[0] for v in moves.values())
            if total < 2:
                continue
            pos[key] = sorted(([u, *v] for u, v in moves.items()), key=lambda x: -x[1])[:TOP]
        with open(os.path.join(out_dir, f"{t}-{colour}.json"), "w", encoding="utf-8") as f:
            json.dump({"games": counts[(t, colour)], "pos": pos}, f, separators=(",", ":"))
        print(f"{t}-{colour}: {counts[(t, colour)]} games, {len(pos)} positions")


if __name__ == "__main__":
    main()
