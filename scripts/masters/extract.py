"""Finds the endgames of great players in CaissaBase, for "Endgames with the masters".

For every teacher (a player with enough classical games), every game that
reaches a clear endgame type (pawn, rook, minor piece, rook and minor piece,
rook against a minor piece, queen) with the teacher to move becomes a
candidate lesson: the position where the endgame starts and the next moves of
the game. Only over-the-board classical games count: events and sites that
look like online, rapid, blitz or exhibition chess are left out. Lost games are
left out; draws only when the teacher was down material (a defence lesson).
The engine then checks every candidate (check.mjs) and the best become lessons.

Run: python scripts/masters/extract.py F:/dev/caissabase_2024.db3 F:/dev/gamesdb_work/masters/candidates.json
(needs python-chess and knight24/tool/gamesdb/caissa.py for the move decoding)
"""

import base64
import json
import os
import re
import sqlite3
import sys

import chess

sys.path.insert(0, os.environ.get("CAISSA_TOOL", "C:/dev/knight24/tool/gamesdb"))
from caissa import DecodeError, decode_game  # noqa: E402

# Teacher id -> the names they appear under in CaissaBase.
TEACHERS = {
    "carlsen": ["Carlsen, M", "Carlsen, Magnus"],
    "caruana": ["Caruana, F", "Caruana, Fabiano"],
    "giri": ["Giri, A", "Giri, A.", "Giri, Anish"],
    "pragg": ["Praggnanandhaa, R"],
    "arjun": ["Erigaisi, Arjun"],
    "gukesh": ["Gukesh, D"],
    "anand": ["Anand, Viswanathan", "Anand, V"],
    "humpy": ["Koneru, Humpy", "Koneru, H"],
    "harika": ["Harika, Dronavalli", "Harika, D", "Dronavalli, Harika"],
    "vaishali": ["Vaishali, R", "Vaishali, Rameshbabu"],
    "houyifan": ["Hou, Yifan"],
    "polgar": ["Polgar, Judit"],
    "kramnik": ["Kramnik, Vladimir", "Kramnik, V"],
    "karpov": ["Karpov, A.", "Karpov, Anatoly"],
    "fischer": ["Fischer, R.", "Fischer, Robert J"],
    "smyslov": ["Smyslov, V.", "Smyslov, Vasily"],
    "capablanca": ["Capablanca, Jose"],
    "rubinstein": ["Rubinstein, Akiba"],
}

NOT_CLASSICAL = re.compile(
    r"titled|\btue\b|blitz|rapid|bullet|armageddon|online|internet|banter|speed|blind|960|freestyle|"
    r"chess\.com|lichess|champions chess tour|meltwater|\bccc\b|\bsim|exhibition|hyper|arena|"
    r"pro chess league|\bpcl\b|airthings|aimchess|opera euro|invitational|skilling|goldmoney|"
    r"ftx|chessable|oslo esports|julius baer|charity|casual|training|tiebreak|tie-break|tie break|"
    r"playoff|play-off|basque|clutch|esports|fide grand swiss.*blitz|world fischer random",
    re.I,
)
ONLINE_SITE = re.compile(r"\bINT$|chess\.com|lichess|internet|playchess|chess24|tornelo|\bICC\b", re.I)

VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
MINOR = {chess.KNIGHT, chess.BISHOP}
SEGMENT = 44  # plies of the game a lesson may use after the endgame starts


def pieces(b, c):
    return sorted(p.piece_type for p in b.piece_map().values() if p.color == c and p.piece_type not in (chess.PAWN, chess.KING))


def category(b):
    """The endgame type of a position, or None while it isn't one of ours."""
    w, k = pieces(b, chess.WHITE), pieces(b, chess.BLACK)
    pawns = len(b.pieces(chess.PAWN, chess.WHITE)) + len(b.pieces(chess.PAWN, chess.BLACK))
    if pawns == 0:
        return None
    if not w and not k:
        return "pawn"
    if chess.QUEEN in w + k:
        return "queen" if w == k == [chess.QUEEN] else None
    if w == k == [chess.ROOK] or w == k == [chess.ROOK, chess.ROOK]:
        return "rook"
    if len(w) == 1 and len(k) == 1 and w[0] in MINOR and k[0] in MINOR:
        return "minor"
    if len(w) == 2 and len(k) == 2 and chess.ROOK in w and chess.ROOK in k and set(w) - {chess.ROOK} <= MINOR and set(k) - {chess.ROOK} <= MINOR:
        return "rook-minor"
    if (w == [chess.ROOK] and len(k) == 1 and k[0] in MINOR) or (k == [chess.ROOK] and len(w) == 1 and w[0] in MINOR):
        return "rook-vs-minor"
    return None


def minor_kind(b):
    """same-bishops, opposite-bishops, knights or knight-bishop (minor piece endgames)."""
    w, k = pieces(b, chess.WHITE), pieces(b, chess.BLACK)
    if w == k == [chess.KNIGHT]:
        return "knights"
    if w == k == [chess.BISHOP]:
        sq = [s for s in b.pieces(chess.BISHOP, chess.WHITE)] + [s for s in b.pieces(chess.BISHOP, chess.BLACK)]
        light = [(chess.square_file(s) + chess.square_rank(s)) % 2 for s in sq]
        return "same-bishops" if light[0] == light[1] else "opposite-bishops"
    return "knight-bishop"


def material(b, c):
    return sum(VALUE[p.piece_type] for p in b.piece_map().values() if p.color == c and p.piece_type != chess.KING)


def main():
    db_path, out_path = sys.argv[1], sys.argv[2]
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    teacher_of = {}
    for t, names in TEACHERS.items():
        for n in names:
            for (pid,) in db.execute("SELECT ID FROM Players WHERE Name = ?", (n,)):
                teacher_of[pid] = t
    players = dict(db.execute("SELECT ID, Name FROM Players"))
    events = dict(db.execute("SELECT ID, Name FROM Events"))
    sites = dict(db.execute("SELECT ID, Name FROM Sites"))
    ids = ",".join(str(i) for i in teacher_of)
    rows = db.execute(
        f"SELECT ID, EventID, SiteID, Date, WhiteID, WhiteElo, BlackID, BlackElo, Result, FEN, Moves, WhiteMaterial, BlackMaterial, PlyCount "
        f"FROM Games WHERE (WhiteID IN ({ids}) OR BlackID IN ({ids})) AND PlyCount >= 40 AND FEN IS NULL"
    )
    out, seen, stats = [], 0, {}
    for gid, eid, sid, date, wid, welo, bid, belo, result, fen, moves, wmat, bmat, plies in rows:
        seen += 1
        event, site = events.get(eid) or "", sites.get(sid) or ""
        if NOT_CLASSICAL.search(event) or ONLINE_SITE.search(site):
            continue
        for tid, color in ((wid, chess.WHITE), (bid, chess.BLACK)):
            t = teacher_of.get(tid)
            if not t or result not in ("1-0", "0-1", "1/2-1/2"):
                continue
            won = (result == "1-0") == (color == chess.WHITE) and result != "1/2-1/2"
            if not won and result != "1/2-1/2":
                continue
            try:
                game = {"ID": gid, "FEN": None, "Moves": base64.b64encode(moves or b"").decode(), "WhiteMaterial": wmat, "BlackMaterial": bmat}
                ms = decode_game(game)
            except DecodeError:
                continue
            b = chess.Board()
            boards = []
            for m in ms:
                boards.append(b.copy(stack=False))
                b.push(m)
            start = None
            for i in range(20, len(ms) - 6):
                bi = boards[i]
                cat = category(bi)
                if cat and bi.turn == color and not bi.is_check() and category(boards[i + 1]) == cat and category(boards[i + 2]) == cat:
                    start = i
                    break
            if start is None:
                continue
            bs = boards[start]
            bal = material(bs, color) - material(bs, not color)
            if not won and bal > -1:
                continue  # a draw is only a lesson when the teacher was worse
            cat = category(bs)
            seg = [m.uci() for m in ms[start : start + SEGMENT]]
            out.append({
                "teacher": t,
                "game": gid,
                "white": players.get(wid, "?"),
                "black": players.get(bid, "?"),
                "whiteElo": welo or 0,
                "blackElo": belo or 0,
                "event": event,
                "site": site,
                "year": int((date or "0")[:4]) if (date or "")[:4].isdigit() else 0,
                "result": result,
                "color": "white" if color == chess.WHITE else "black",
                "cat": cat,
                "kind": minor_kind(bs) if cat == "minor" else None,
                "balance": bal,
                "fen": bs.fen(),
                "ply": start,
                "moves": seg,
                "toEnd": len(ms) - start,
            })
            stats[t] = stats.get(t, 0) + 1
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(f"{seen} games read, {len(out)} candidate endgames")
    for t in TEACHERS:
        print(f"  {t:12s} {stats.get(t, 0)}")


if __name__ == "__main__":
    main()
