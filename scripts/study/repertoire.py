"""Builds each study opening's repertoire from its own games (scan.py): the move tree, the chapters, the model games.

The opening's own book: every position of the first 30 plies of the
opening's games, with the moves played there (how often, how they scored).
The trainer reads it, so at the student's turns it teaches what players of
this opening choose, and at the opponent's turns every reply that comes up.

Chapters, found from the games: from the start, the student's side plays its
most played move; at the opponent's turns, every reply with enough games
(MIN_SHARE of the opening's games and MIN_GAMES) opens a branch, for
SPLITS branching turns of the opponent. Each branch end is a chapter (a
transposition into the same position is one chapter). Per chapter: its
games, the student's score, how many variations a full repertoire of it has
(replies in 5%+ of games and 8+ games, up to move 13) and their average
length in the student's moves, its model games, and the endgames for the
engine's puzzle scan.

Run: python scripts/study/repertoire.py F:/dev/gamesdb_work/study2 static/data/study src/lib/study/chapters.json
"""

import hashlib
import json
import os
import sys

import chess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("CAISSA_TOOL", "C:/dev/knight24/tool/gamesdb"))
from caissa import position_key  # noqa: E402

sys.path.insert(0, HERE)
from openings_cfg import CHAPTER_ROOT, LIMITS, PREFER, SIDE, TITLE  # noqa: E402

# Where the chapters start: the opening's own starting point (the moves before it are the same in every game,
# or are other move orders that the book still covers by transposition).
# The system's own moves: at the student's turns these are played when they are a main move, as the opening's
# defining move order (Jobava: Nc3 and Bf4), not treated as a choice.
# A real choice for the student: a second move with this share of the games (and enough games). A chapter ends
# there: the student picks their move inside it.
CHOICE_SHARE = 0.15
BOOK_PLIES = 30
SPLITS = 3
MIN_SHARE = 0.012
MIN_GAMES = 25
VAR_SHARE, VAR_GAMES, VAR_PLIES = 0.05, 8, 26
# A young opening with fewer games (the Jobava London) gets lower limits, so every line that really occurs
# (2...Nc6, 1...c5, 3...Bb4...) is a chapter and variations go as deep as its games allow.
MODELS = 8
ENDGAMES = 40
VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def khex(b):
    return format(position_key(b), "016x")


def opening_names():
    """Position key -> the Lichess opening name (CC0) for it."""
    with open(os.path.join(HERE, "..", "..", "static", "data", "openings.json"), encoding="utf-8") as f:
        rows = json.load(f)
    out = {}
    for eco, name, sans in rows:
        b = chess.Board()
        try:
            for s in sans.split():
                b.push_san(s)
        except ValueError:
            continue
        out.setdefault(khex(b), name)
    return out


def is_endgame(b):
    w = sum(VALUE[p.piece_type] for p in b.piece_map().values() if p.color and p.piece_type not in (chess.PAWN, chess.KING))
    k = sum(VALUE[p.piece_type] for p in b.piece_map().values() if not p.color and p.piece_type not in (chess.PAWN, chess.KING))
    queens = bool(b.pieces(chess.QUEEN, chess.WHITE) or b.pieces(chess.QUEEN, chess.BLACK))
    return (not queens and w <= 8 and k <= 8) or w + k <= 13


def main():
    work, out_dir, chapters_path = sys.argv[1], sys.argv[2], sys.argv[3]
    only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else None
    names = opening_names()
    # One opening rebuilt: the others keep their chapters.
    all_chapters = json.load(open(chapters_path, encoding="utf-8")) if only and os.path.exists(chapters_path) else {}
    for oid, side in SIDE.items():
        if only and oid not in only:
            continue
        lim = LIMITS.get(oid, {})
        var_games = lim.get("var_games", VAR_GAMES)
        me = chess.WHITE if side == "white" else chess.BLACK
        games = [json.loads(line) for line in open(os.path.join(work, f"{oid}.jsonl"), encoding="utf-8")]
        # The opening's book: key -> uci -> [games, wins for the mover, draws]; and the positions each game reached.
        book, sans_of, reached = {}, {}, []
        for g in games:
            b = chess.Board()
            keys = []
            for i, u in enumerate(g["m"].split()[:BOOK_PLIES]):
                k = khex(b)
                keys.append(k)
                m = chess.Move.from_uci(u)
                if m not in b.legal_moves:
                    break
                s = book.setdefault(k, {}).setdefault(u, [0, 0, 0])
                s[0] += 1
                mover_white = b.turn == chess.WHITE
                s[1] += 1 if (g["r"] == "1-0") == mover_white and g["r"] != "1/2-1/2" else 0
                s[2] += 1 if g["r"] == "1/2-1/2" else 0
                sans_of.setdefault((k, u), b.san(m))
                b.push(m)
            keys.append(khex(b))
            reached.append(keys)
        total_games = len(games)
        min_games = max(lim.get("min_games", MIN_GAMES), int(total_games * lim.get("min_share", MIN_SHARE)))

        def moves_at(k):
            return sorted(book.get(k, {}).items(), key=lambda x: -x[1][0])

        # Chapters: branch on the opponent's replies with enough games.
        chapters = {}

        def walk(b, path, splits):
            k = khex(b)
            rows = moves_at(k)
            tot = sum(v[0] for _, v in rows)
            if not rows or b.ply() >= 16:
                return False
            if b.turn == me:
                prefer = PREFER.get(oid, set())
                pick = next((u for u, v in rows if u in prefer and v[0] / tot >= 0.05), None)
                if pick is None:
                    # More than one real move for the student: the chapter starts here.
                    if len(rows) > 1 and rows[1][1][0] / tot >= CHOICE_SHARE and rows[1][1][0] >= min_games:
                        return False
                    pick = rows[0][0]
                b2 = b.copy()
                b2.push(chess.Move.from_uci(pick))
                return walk(b2, path + [sans_of[(k, pick)]], splits)
            big = [(u, v) for u, v in rows if v[0] >= min_games]
            if not big:
                return False
            # One main reply only: not a branch, go on (it doesn't use up a split).
            if len(big) == 1:
                u = big[0][0]
                b2 = b.copy()
                b2.push(chess.Move.from_uci(u))
                return walk(b2, path + [sans_of[(k, u)]], splits)
            if splits >= SPLITS:
                return False
            for u, v in big:
                b2 = b.copy()
                b2.push(chess.Move.from_uci(u))
                p2 = path + [sans_of[(k, u)]]
                # Our reply is part of the chapter: the chapter ends where the student has to think on their own.
                if not walk(b2, p2, splits + 1):
                    ck = khex(b2)
                    if ck not in chapters or chapters[ck]["n"] < v[0]:
                        chapters[ck] = {"sans": p2, "n": v[0], "board": b2.copy()}
            return True

        root = chess.Board()
        root_path = CHAPTER_ROOT[oid].split()
        for sn in root_path:
            root.push_san(sn)
        walk(root, root_path, 0)

        # Variations of a chapter: the student's top move, the opponent's replies with 5%+ and 8+ games.
        def variations(b, depth_mine, seen):
            k = khex(b)
            if b.ply() >= VAR_PLIES or k in seen:
                return [depth_mine]
            rows = moves_at(k)
            tot = sum(v[0] for _, v in rows)
            if tot < var_games:
                return [depth_mine]
            seen = seen | {k}
            if b.turn == me:
                b2 = b.copy()
                b2.push(chess.Move.from_uci(rows[0][0]))
                return variations(b2, depth_mine + 1, seen)
            out = []
            for u, v in rows:
                if v[0] >= var_games and v[0] / tot >= VAR_SHARE:
                    b2 = b.copy()
                    b2.push(chess.Move.from_uci(u))
                    out += variations(b2, depth_mine, seen)
            return out or [depth_mine]

        listed = []
        for ck, c in chapters.items():
            leaves = variations(c["board"], 0, frozenset())
            # The name of the deepest named position on the way.
            b = chess.Board()
            name = ""
            for s in c["sans"]:
                b.push_san(s)
                name = names.get(khex(b), name)
            mine = [i for i, keys in enumerate(reached) if ck in keys]
            score = 0.0
            for i in mine:
                r = games[i]["r"]
                score += 0.5 if r == "1/2-1/2" else 1.0 if (r == "1-0") == (side == "white") else 0.0
            # The chapter is named by the opponent's move that starts it.
            sans = c["sans"]
            last_opp = max(i for i in range(len(sans)) if (i % 2 == 0) != (side == "white"))
            no = last_opp // 2 + 1
            title = f"{no}.{sans[last_opp]}" if last_opp % 2 == 0 else f"{no}...{sans[last_opp]}"
            listed.append({
                "id": hashlib.sha1(ck.encode()).hexdigest()[:8], "key": ck, "title": title, "name": name, "sans": " ".join(sans),
                "games": len(mine), "score": round(score / max(1, len(mine)), 3), "variations": len(leaves),
                "depth": round(sum(leaves) / max(1, len(leaves)), 1),
            })
        listed.sort(key=lambda c: (c["sans"].count(" "), -c["games"]))
        listed.sort(key=lambda c: -c["games"])
        # Each game belongs to the deepest chapter it reached.
        by_key = {c["key"]: c for c in listed}
        depth_of = {c["key"]: len(c["sans"].split()) for c in listed}
        chapter_of = []
        for keys in reached:
            hits = [k for k in keys if k in by_key]
            chapter_of.append(max(hits, key=lambda k: depth_of[k]) if hits else None)
        models, endgames = {}, []
        won = "1-0" if side == "white" else "0-1"
        mine_elo = (lambda g: g["we"]) if side == "white" else (lambda g: g["be"])
        their_elo = (lambda g: g["be"]) if side == "white" else (lambda g: g["we"])
        for c in listed:
            idx = [i for i, k in enumerate(chapter_of) if k == c["key"]]
            # Wins of the student's side first, then draws; losses only when there aren't enough of those.
            strength = lambda i: mine_elo(games[i]) + their_elo(games[i]) / 2 + min(games[i]["y"], 2024) * 2  # noqa: E731
            tier = lambda i: 2 if games[i]["r"] == won else 1 if games[i]["r"] == "1/2-1/2" else 0  # noqa: E731
            ranked = sorted(idx, key=lambda i: (tier(i), strength(i)), reverse=True)
            if sum(1 for i in ranked if tier(i) > 0) >= MODELS:
                ranked = [i for i in ranked if tier(i) > 0]
            models[c["id"]] = [{"id": games[i]["id"], "line": c["id"], "white": games[i]["w"], "black": games[i]["b"], "we": games[i]["we"], "be": games[i]["be"],
                                "year": games[i]["y"], "event": games[i]["ev"], "result": games[i]["r"]} for i in ranked[:MODELS]]
            # Endgames for the engine's puzzle scan: the stronger and more recent games first.
            n = 0
            for i in sorted(idx, key=lambda i: (min(games[i]["y"], 2024), games[i]["we"] + games[i]["be"]), reverse=True):
                if n >= ENDGAMES:
                    break
                g = games[i]
                ms = g["m"].split()
                b = chess.Board()
                for j, u in enumerate(ms):
                    if j >= 20 and is_endgame(b):
                        if len(ms) - j >= 10:
                            endgames.append({"opening": oid, "line": c["id"], "game": g["id"], "white": g["w"], "black": g["b"], "we": g["we"], "be": g["be"],
                                             "year": g["y"], "event": g["ev"], "fen": b.fen(), "moves": ms[j : j + 50]})
                            n += 1
                        break
                    b.push(chess.Move.from_uci(u))
        # The book, in 256 small files by the key's first two hex digits.
        shard_dir = os.path.join(out_dir, "book", oid)
        os.makedirs(shard_dir, exist_ok=True)
        shards = {}
        for k, mv in book.items():
            tot = sum(v[0] for v in mv.values())
            if tot < 3:
                continue
            rows = [[u, *v] for u, v in sorted(mv.items(), key=lambda x: -x[1][0]) if v[0] >= 2 or v[0] / tot >= 0.05][:8]
            shards.setdefault(k[:2], {})[k] = rows
        for p, d in shards.items():
            with open(os.path.join(shard_dir, f"{p}.json"), "w", encoding="utf-8") as f:
                json.dump(d, f, separators=(",", ":"))
        with open(os.path.join(work, f"{oid}.models.json"), "w", encoding="utf-8") as f:
            json.dump(models, f)
        with open(os.path.join(work, f"{oid}.endgames.json"), "w", encoding="utf-8") as f:
            json.dump(endgames, f)
        all_chapters[oid] = {"games": total_games, "chapters": [{k: v for k, v in c.items() if k != "key"} | {"key": c["key"]} for c in listed]}
        print(f"{oid}: {total_games} games, {len(listed)} chapters, {sum(c['variations'] for c in listed)} variations, {len(endgames)} endgames, {len(shards)} book files")
        for c in listed[:40]:
            print(f"   {c['title']:10s} {c['games']:6d} games {round(c['score'] * 100):3d}%  {c['variations']:3d} var, {c['depth']} moves  {c['sans']}  [{c['name']}]")
    with open(chapters_path, "w", encoding="utf-8") as f:
        json.dump(all_chapters, f, indent=1)


if __name__ == "__main__":
    main()
