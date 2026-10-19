"""Finds every game of the study openings in CaissaBase by the opening's system, not one move order.

  caro-kann      1.e4 c6, whatever White does next.
  jobava-london  White plays d4, Nc3 and Bf4 within the first four moves,
                 before c4, e4 or Nf3, against any Black setup.
  chebanenko     against d4 and c4, Black plays ...d5, ...c6, ...Nf6 and ...a6
                 within the first six moves, ...a6 before any ...e6.

Classical over-the-board games between players rated 1800+ (CaissaBase's
ratings). Each match is written whole to <out>/<opening>.jsonl, so the next
steps (repertoire.py) never need the database again.

Run: python scripts/study/scan.py F:/dev/caissabase_2024.db3 F:/dev/gamesdb_work/study2 [--only jobava-london] [--min-elo 1500]
(--only rescans one opening and replaces only its file; a young opening like
the Jobava London has few games between 1800+ players, so it can take more.)
"""

import json
import multiprocessing as mp
import os
import sqlite3
import sys

import chess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "masters"))
sys.path.insert(0, os.environ.get("CAISSA_TOOL", "F:/dev/knight24/tool/gamesdb"))

MIN_ELO = 1800


def early(raw, n):
    """The first n moves (UCI) of a game, or None when the data is broken."""
    from caissa import mainline_bytes, ordered_legal_moves

    b = chess.Board()
    out = []
    for byte in mainline_bytes(raw):
        if len(out) >= n:
            break
        legal = ordered_legal_moves(b)
        if byte >= len(legal):
            return None
        m = legal[byte]
        b.push(m)
        out.append(m.uci())
    return out


def which(ms):
    """The study opening a game belongs to (by its first moves), or None."""
    if len(ms) < 8:
        return None
    if ms[0] == "e2e4" and ms[1] == "c7c6":
        return "caro-kann"
    white, black = ms[0::2], ms[1::2]
    if ms[0] in ("d2d4", "b1c3", "c1f4"):
        need = {"d2d4", "b1c3", "c1f4"}
        seen = set()
        for m in white[:4]:
            if m in need:
                seen.add(m)
                if seen == need:
                    return "jobava-london"
            elif m in ("c2c4", "e2e4", "g1f3"):
                break
    if "d2d4" in white[:4] and "c2c4" in white[:4]:
        need = {"d7d5", "c7c6", "g8f6", "a7a6"}
        seen = set()
        for m in black[:6]:
            if m == "e7e6" and "a7a6" not in seen:
                break
            if m in need:
                seen.add(m)
        if seen == need:
            return "chebanenko"
    return None


def work(args):
    db_path, lo, hi, min_elo, only = args
    from caissa import mainline_bytes, ordered_legal_moves  # noqa: F401  (imported per process)
    from extract import NOT_CLASSICAL, ONLINE_SITE

    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    events = dict(db.execute("SELECT ID, Name FROM Events"))
    sites = dict(db.execute("SELECT ID, Name FROM Sites"))
    players = None
    out = {}
    rows = db.execute(
        "SELECT ID, EventID, SiteID, Date, WhiteID, WhiteElo, BlackID, BlackElo, Result, Moves FROM Games "
        "WHERE ID >= ? AND ID < ? AND FEN IS NULL AND PlyCount >= 20 AND WhiteElo >= ? AND BlackElo >= ?",
        (lo, hi, min_elo, min_elo),
    )
    for gid, eid, sid, date, wid, welo, bid, belo, result, raw in rows:
        if result not in ("1-0", "0-1", "1/2-1/2"):
            continue
        event = events.get(eid) or ""
        if NOT_CLASSICAL.search(event) or ONLINE_SITE.search(sites.get(sid) or ""):
            continue
        # Only one opening: skip games whose first move can't start it, without decoding further.
        if only == "jobava-london":
            one = early(raw or b"", 1)
            if not one or one[0] not in ("d2d4", "b1c3", "c1f4"):
                continue
        first = early(raw or b"", 12)
        if not first:
            continue
        o = which(first)
        if not o or (only and o != only):
            continue
        full = early(raw or b"", 400)
        if not full:
            continue
        if players is None:
            players = dict(db.execute("SELECT ID, Name FROM Players"))
        year = int((date or "0")[:4]) if (date or "")[:4].isdigit() else 0
        out.setdefault(o, []).append({"id": gid, "w": players.get(wid, "?"), "b": players.get(bid, "?"), "we": welo, "be": belo,
                                      "y": year, "ev": event, "r": result, "m": " ".join(full)})
    return out


def main():
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("db")
    ap.add_argument("out")
    ap.add_argument("--only")
    ap.add_argument("--min-elo", type=int, default=MIN_ELO)
    a = ap.parse_args()
    db_path, out_dir = a.db, a.out
    os.makedirs(out_dir, exist_ok=True)
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    top = db.execute("SELECT MAX(ID) FROM Games").fetchone()[0]
    step = 50_000
    jobs = [(db_path, lo, lo + step, a.min_elo, a.only) for lo in range(0, top + 1, step)]
    openings = [a.only] if a.only else ["caro-kann", "jobava-london", "chebanenko"]
    files = {o: open(os.path.join(out_dir, f"{o}.jsonl"), "w", encoding="utf-8") for o in openings}
    counts = {o: 0 for o in files}
    with mp.Pool(4) as pool:
        for i, res in enumerate(pool.imap_unordered(work, jobs)):
            for o, games in res.items():
                if o not in files:
                    continue
                for g in games:
                    files[o].write(json.dumps(g) + "\n")
                counts[o] += len(games)
            if i % 10 == 0:
                print(f"{i + 1}/{len(jobs)} chunks", counts, flush=True)
    for f in files.values():
        f.close()
    print("done", counts)


if __name__ == "__main__":
    main()
