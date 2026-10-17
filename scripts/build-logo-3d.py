"""Five 3D crest designs for Chess Castles (shield + rook): metal, enamel,
bevels and shadows. Writes each mark and a horizontal lockup (name and
slogan as outlines) as SVG.

  python -P scripts/build-logo-3d.py <fonts-dir> design/logo-3d
"""
import math
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

fonts_dir, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

CINZEL = instantiateVariableFont(TTFont(os.path.join(fonts_dir, 'Cinzel[wght].ttf')), {'wght': 800})
SORA = instantiateVariableFont(TTFont(os.path.join(fonts_dir, 'Sora[wght].ttf')), {'wght': 600})


def text(font, s, size, x, y, tracking=0.0):
    upm = font['head'].unitsPerEm
    scale = size / upm
    cmap, gs, hmtx = font.getBestCmap(), font.getGlyphSet(), font['hmtx']
    names = [cmap.get(ord(c), '.notdef') for c in s]
    adv = [hmtx[n][0] + (tracking * upm if i < len(names) - 1 else 0) for i, n in enumerate(names)]
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
    cx = 0.0
    for n, a in zip(names, adv):
        gs[n].draw(TransformPen(pen, (scale, 0, 0, -scale, x + cx * scale, y)))
        cx += a
    return pen.getCommands(), sum(adv) * scale


ROOK = 'M22 12H34V21H44V12H56V21H66V12H78V31L70 38V64L77 72V78H83V90H17V78H23V72L30 64V38L22 31Z'
DOOR = 'M43 78V65A7 7 0 0 1 57 65V78Z'
SHIELD = 'M50 4L92 17V50C92 77 74 95 50 107C26 95 8 77 8 50V17Z'
SHIELD_IN = 'M50 11L86 22V50C86 73 70 89 50 99C30 89 14 73 14 50V22Z'


def defs(p):
    """Shared gradients and shadows; ids prefixed with `p` (several marks can share a page)."""
    return f'''<defs>
<linearGradient id="{p}gold" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff3c4"/><stop offset="0.22" stop-color="#f6d27a"/><stop offset="0.5" stop-color="#e2a53c"/>
  <stop offset="0.78" stop-color="#a8701a"/><stop offset="1" stop-color="#6e470c"/></linearGradient>
<linearGradient id="{p}goldcyl" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#6e470c"/><stop offset="0.16" stop-color="#b98424"/><stop offset="0.38" stop-color="#f6d27a"/>
  <stop offset="0.48" stop-color="#fff2c4"/><stop offset="0.62" stop-color="#e9b54c"/><stop offset="0.86" stop-color="#a8701a"/><stop offset="1" stop-color="#5c3a08"/></linearGradient>
<radialGradient id="{p}enamel" cx="0.45" cy="0.28" r="0.85">
  <stop offset="0" stop-color="#34508f"/><stop offset="0.45" stop-color="#18284d"/><stop offset="1" stop-color="#080f1f"/></radialGradient>
<linearGradient id="{p}ivory" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#bdb3a0"/><stop offset="0.35" stop-color="#fbf7ee"/><stop offset="0.55" stop-color="#ffffff"/>
  <stop offset="0.8" stop-color="#ddd3c1"/><stop offset="1" stop-color="#a99d86"/></linearGradient>
<linearGradient id="{p}gloss" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity="0.38"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<linearGradient id="{p}doorg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#03070f"/><stop offset="1" stop-color="#1b2b52"/></linearGradient>
<filter id="{p}drop" x="-20%" y="-20%" width="140%" height="150%">
  <feDropShadow dx="0" dy="2.2" stdDeviation="1.8" flood-color="#000" flood-opacity="0.5"/></filter>
<filter id="{p}soft" x="-20%" y="-20%" width="140%" height="150%">
  <feDropShadow dx="0" dy="3.5" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/></filter>
</defs>'''


def rook(p, fill, x, y, s, edge='#4a2f06', door_fill=None):
    door_fill = door_fill or f'url(#{p}doorg)'
    sw = 1.6 / s
    return (f'<g transform="translate({x} {y}) scale({s})" filter="url(#{p}drop)">'
            f'<path d="{ROOK}" fill="{fill}" stroke="{edge}" stroke-width="{sw:.2f}" stroke-linejoin="round"/>'
            # Lit tops of the battlements and base, a sense of depth.
            f'<path d="M22 12H34M44 12H56M66 12H78M17 78H83" stroke="#ffffff" stroke-opacity="0.55" stroke-width="{sw:.2f}" fill="none"/>'
            f'<path d="M22 31L30 38M78 31L70 38" stroke="#000" stroke-opacity="0.25" stroke-width="{sw * 1.6:.2f}" fill="none"/>'
            f'<path d="{DOOR}" fill="{door_fill}"/></g>')


def bevel_shield(p, rim, field):
    """A metal-rimmed shield with an enamel field, a gloss on top and a lit upper edge."""
    return (f'<g filter="url(#{p}soft)"><path d="{SHIELD}" fill="{rim}"/></g>'
            f'<path d="M12 18L50 6.5L88 18" fill="none" stroke="#fff8e0" stroke-opacity="0.7" stroke-width="1.2"/>'
            f'<path d="{SHIELD_IN}" fill="{field}"/>'
            f'<path d="{SHIELD_IN}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.4"/>'
            f'<path d="M50 11L86 22V50C86 58 84 66 80 72" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="1"/>')


def checker3d(p, top_y, bot_y, top_x0, top_x1, bot_x0, bot_x1, rows, cols, a, b):
    """A strip of chessboard seen slightly from above (each square a lit quad)."""
    out = []
    for r in range(rows):
        t0, t1 = r / rows, (r + 1) / rows
        y0, y1 = top_y + (bot_y - top_y) * t0, top_y + (bot_y - top_y) * t1
        l0, r0 = top_x0 + (bot_x0 - top_x0) * t0, top_x1 + (bot_x1 - top_x1) * t0
        l1, r1 = top_x0 + (bot_x0 - top_x0) * t1, top_x1 + (bot_x1 - top_x1) * t1
        for c in range(cols):
            u0, u1 = c / cols, (c + 1) / cols
            pts = [(l0 + (r0 - l0) * u0, y0), (l0 + (r0 - l0) * u1, y0), (l1 + (r1 - l1) * u1, y1), (l1 + (r1 - l1) * u0, y1)]
            fill = a if (r + c) % 2 == 0 else b
            out.append('<path d="M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + f'Z" fill="{fill}"/>')
    return ''.join(out)


def mark(name):
    """(svg body, viewBox) for each design, drawn in a 100-wide box."""
    p = name[:2]
    if name == 'royal':
        # 1 · Royal Crest: gold rim, navy enamel, a polished gold rook.
        body = bevel_shield(p, f'url(#{p}gold)', f'url(#{p}enamel)')
        body += f'<path d="{SHIELD_IN}" fill="url(#{p}gloss)"/>'
        body += rook(p, f'url(#{p}goldcyl)', 20.5, 18, 0.59)
        return body, '0 0 100 112'
    if name == 'marble':
        # 2 · Marble Tower: an ivory rook standing on a gold-and-navy board in perspective.
        body = bevel_shield(p, f'url(#{p}gold)', f'url(#{p}enamel)')
        body += checker3d(p, 70, 86, 30, 70, 22, 78, 2, 6, '#e9b54c', '#22355f')
        body += f'<path d="{SHIELD_IN}" fill="url(#{p}gloss)"/>'
        body += rook(p, f'url(#{p}ivory)', 25, 14.5, 0.5, edge='#5e5545', door_fill='#14213d')
        return body, '0 0 100 112'
    if name == 'rising':
        # 3 · Rising Rook: a big gold rook breaking out over the top of the shield.
        body = bevel_shield(p, f'url(#{p}gold)', f'url(#{p}enamel)')
        body += checker3d(p, 66, 80, 30, 70, 24, 76, 2, 6, '#e9b54c', '#1c2c55')
        body += rook(p, f'url(#{p}goldcyl)', 15, -14, 0.7)
        return body, '0 -12 100 124'
    if name == 'quartered':
        # 4 · Quartered Crest: a 2×2 chessboard shield in navy and gold, an ivory rook over it.
        body = bevel_shield(p, f'url(#{p}gold)', f'url(#{p}enamel)')
        body += f'<path d="M50 11L14 22V56H50Z" fill="url(#{p}gold)" opacity="0.92"/>'
        body += f'<path d="M50 56H85.6C84 75 70 90 50 99Z" fill="url(#{p}gold)" opacity="0.92"/>'
        body += f'<path d="M50 11V99M14 56H86" stroke="#000" stroke-opacity="0.3" stroke-width="0.8"/>'
        body += f'<path d="{SHIELD_IN}" fill="url(#{p}gloss)"/>'
        body += rook(p, f'url(#{p}ivory)', 22, 20, 0.56, edge='#3b3428', door_fill='#14213d')
        return body, '0 0 100 112'
    if name == 'laurel':
        # 5 · Champion: the royal crest held in a gold laurel wreath (tournaments and trophies).
        # Two branches curving up round the shield: a stem, and pairs of leaves along it.
        R, CX, CY = 44, 50, 60
        leaves, stems = [], []
        for side in (1, -1):
            pts = []
            for k in range(8):
                phi = math.radians(102 + k * 14)
                x, y = CX + R * math.cos(phi), CY + R * math.sin(phi)
                dx, dy = -math.sin(phi), math.cos(phi)
                base = math.degrees(math.atan2(dy, dx)) - 90
                if side < 0:
                    x, base = 100 - x, -base
                pts.append((x, y))
                for tilt, off in ((32, 1), (-32, -1)):
                    a = base + tilt * side
                    nx, ny = math.cos(math.radians(phi * 0 + 0)), 0
                    lx = x + off * 3.2 * math.cos(phi) * (1 if side > 0 else -1)
                    ly = y + off * 3.2 * math.sin(phi)
                    leaves.append(f'<ellipse cx="{lx:.2f}" cy="{ly:.2f}" rx="2.6" ry="6.2" transform="rotate({a:.1f} {lx:.2f} {ly:.2f})" fill="url(#{p}gold)" stroke="#6e470c" stroke-width="0.5"/>')
            stems.append('<path d="M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + '" fill="none" stroke="#a8701a" stroke-width="1.2" stroke-linecap="round"/>')
        body = f'<g filter="url(#{p}soft)">{"".join(stems)}{"".join(leaves)}</g>'
        body += f'<g transform="translate(14 6) scale(0.72)">' + bevel_shield(p, f'url(#{p}gold)', f'url(#{p}enamel)') + f'<path d="{SHIELD_IN}" fill="url(#{p}gloss)"/>' + rook(p, f'url(#{p}goldcyl)', 20.5, 18, 0.59) + '</g>'
        return body, '0 0 100 112'
    raise ValueError(name)


DESIGNS = ['royal', 'marble', 'rising', 'quartered', 'laurel']
for name in DESIGNS:
    body, vb = mark(name)
    p = name[:2]
    x0, y0, w, h = (float(v) for v in vb.split())
    open(os.path.join(out, f'{name}-mark.svg'), 'w', encoding='utf-8').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w * 4:.0f}" height="{h * 4:.0f}">{defs(p)}{body}</svg>\n')
    # Lockups: the mark, then CHESS CASTLES on one line and the slogan under it.
    for mode, (chess, castles, slogan) in {'dark': ('#f6f2e9', f'url(#{p}gold)', '#aab3c5'), 'light': ('#14213d', '#a8701a', '#4a5162')}.items():
        mh = 112.0
        sc = mh / h
        mw = w * sc
        name_path, nw = text(CINZEL, 'CHESS CASTLES', 46, 0, 0, 0.04)
        n1, w1 = text(CINZEL, 'CHESS ', 46, mw + 24, 64, 0.04)
        n2, w2 = text(CINZEL, 'CASTLES', 46, mw + 24 + w1, 64, 0.04)
        sl, ws = text(SORA, 'LEARN · PLAY · CONQUER', 13.5, mw + 26, 90, 0.26)
        total = mw + 24 + max(nw, ws) + 6
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total:.0f} {mh:.0f}" width="{total * 2:.0f}" height="{mh * 2:.0f}">{defs(p)}'
               f'<g transform="scale({sc:.4f}) translate({-x0:.2f} {-y0:.2f})">{body}</g>'
               f'<path d="{n1}" fill="{chess}"/><path d="{n2}" fill="{castles}"/><path d="{sl}" fill="{slogan}"/></svg>\n')
        open(os.path.join(out, f'{name}-lockup-{mode}.svg'), 'w', encoding='utf-8').write(svg)
    print(name)
