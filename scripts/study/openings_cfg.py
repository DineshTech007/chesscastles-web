"""The study openings, for every script in scripts/study (one place to add an opening).

SIDE: the student's colour. CHAPTER_ROOT: where the chapters start. TITLE: the course name.
PREFER: the system's own moves (played at the student's turn when they are a main move).
LIMITS: lower limits for openings with fewer games. which(): the openings a game belongs to.
LICHESS: the Lichess puzzle-tag family of each opening (the gap-filler puzzles).
"""

SIDE = {
    "caro-kann": "black",
    "jobava-london": "white",
    "chebanenko": "black",
    "ruy-lopez": "white",
    "italian": "white",
    "queens-gambit": "white",
    "london": "white",
    "najdorf": "black",
    "french": "black",
    "kings-indian": "black",
    "qgd": "black",
}
CHAPTER_ROOT = {
    "caro-kann": "e4 c6",
    "jobava-london": "",
    "chebanenko": "d4 d5 c4 c6",
    "ruy-lopez": "e4 e5 Nf3 Nc6 Bb5",
    "italian": "e4 e5 Nf3 Nc6 Bc4",
    "queens-gambit": "d4 d5 c4",
    "london": "",
    "najdorf": "e4 c5",
    "french": "e4 e6",
    "kings-indian": "",
    "qgd": "d4 d5 c4 e6",
}
TITLE = {
    "caro-kann": "Caro-Kann Defence",
    "jobava-london": "Jobava London",
    "chebanenko": "Chebanenko Slav",
    "ruy-lopez": "Ruy Lopez",
    "italian": "Italian Game",
    "queens-gambit": "Queen's Gambit",
    "london": "London System",
    "najdorf": "Sicilian Najdorf",
    "french": "French Defence",
    "kings-indian": "King's Indian Defence",
    "qgd": "Queen's Gambit Declined",
}
PREFER = {
    "jobava-london": {"d2d4", "b1c3", "c1f4"},
    "london": {"d2d4", "c1f4", "e2e3", "g1f3", "c2c3"},
    "kings-indian": {"g8f6", "g7g6", "f8g7", "d7d6", "e8g8"},
}
LIMITS = {"jobava-london": {"min_share": 0.003, "min_games": 20, "var_games": 4}}
LICHESS = {
    "caro-kann": "Caro-Kann_Defense",
    "jobava-london": "Rapport-Jobava_System",
    "chebanenko": "Slav_Defense_Chebanenko_Variation",
    "ruy-lopez": "Ruy_Lopez",
    "italian": "Italian_Game",
    "queens-gambit": "Queens_Gambit",
    "london": "London_System",
    "najdorf": "Sicilian_Defense_Najdorf_Variation",
    "french": "French_Defense",
    "kings-indian": "Kings_Indian_Defense",
    "qgd": "Queens_Gambit_Declined",
}

ALL = list(SIDE)


def which(ms):
    """Every study opening a game belongs to (by its first moves, UCI). A game can be in two (a Queen's Gambit
    Declined is in White's Queen's Gambit course and in Black's QGD course)."""
    out = []
    if len(ms) < 8:
        return out
    white, black = ms[0::2], ms[1::2]
    first4 = ms[:4]
    if ms[0] == "e2e4" and ms[1] == "c7c6":
        out.append("caro-kann")
    if ms[0] == "e2e4" and ms[1] == "e7e6":
        out.append("french")
    if first4 == ["e2e4", "e7e5", "g1f3", "b8c6"] and len(ms) > 4:
        if ms[4] == "f1b5":
            out.append("ruy-lopez")
        elif ms[4] == "f1c4":
            out.append("italian")
    # The Najdorf player's games: 1.e4 c5, and after 2.Nf3 the ...d6 Sicilian (an open Sicilian must reach ...a6
    # by move 5); White's other second moves (2.c3, 2.Nc3, 2.d4, 2.f4…) all belong to the course.
    if ms[0] == "e2e4" and ms[1] == "c7c5":
        if ms[2] != "g1f3":
            out.append("najdorf")
        elif ms[3] == "d7d6":
            if "f3d4" not in ms[:8] or "a7a6" in black[:6]:
                out.append("najdorf")
    # Jobava London: d4, Nc3 and Bf4 within White's first four moves, before c4, e4 or Nf3.
    if ms[0] in ("d2d4", "b1c3", "c1f4"):
        need = {"d2d4", "b1c3", "c1f4"}
        seen = set()
        for m in white[:4]:
            if m in need:
                seen.add(m)
                if seen == need:
                    out.append("jobava-london")
                    break
            elif m in ("c2c4", "e2e4", "g1f3"):
                break
    # London System: 1.d4 and Bf4 within White's first three moves, no c4 or Nc3 among the first four.
    if ms[0] == "d2d4" and "c1f4" in white[:3] and not ({"c2c4", "b1c3", "e2e4"} & set(white[:4])):
        out.append("london")
    if "d2d4" in white[:4] and "c2c4" in white[:4]:
        need = {"d7d5", "c7c6", "g8f6", "a7a6"}
        seen = set()
        for m in black[:6]:
            if m == "e7e6" and "a7a6" not in seen:
                break
            if m in need:
                seen.add(m)
        if seen == need:
            out.append("chebanenko")
    # Queen's Gambit (White) and the Queen's Gambit Declined (Black).
    if ms[:3] == ["d2d4", "d7d5", "c2c4"]:
        out.append("queens-gambit")
        if ms[3] == "e7e6":
            out.append("qgd")
    # King's Indian: against 1.d4, Black sets up ...Nf6, ...g6, ...Bg7 and ...d6 in the first five moves, no ...d5.
    if ms[0] == "d2d4":
        kid = {"g8f6", "g7g6", "f8g7", "d7d6"}
        b5 = set(black[:5])
        if kid <= b5 and "d7d5" not in black[:5]:
            out.append("kings-indian")
    return out
