"""Builds the Chess Castles logo files (SVG) from the chosen design: the crest
and the CHESS / CASTLES lettering, with the "Learn · Play · Conquer" tagline.

  python -P scripts/build-brand.py <fonts-dir> static/brand

Lettering is turned into outlines (Cinzel ExtraBold, Sora Medium; both SIL
Open Font License), so the logo looks the same everywhere, font or not.
PNG sizes are made from these SVGs by scripts/brand-png.mjs.
"""
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

fonts_dir, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

# Navy and gold.
NAVY, INK, GOLD, GOLD_DARK, IVORY = '#0b1426', '#14213d', '#edb040', '#a8701a', '#f6f2e9'
CARAMEL_TEXT = '#edb040'


def load(name, wght):
    f = TTFont(os.path.join(fonts_dir, name))
    return instantiateVariableFont(f, {'wght': wght})


CINZEL = load('Cinzel[wght].ttf', 800)
SORA = load('Sora[wght].ttf', 500)


def text(font, s, size, x, y, tracking=0.0, anchor='start'):
    """The text as one SVG path (baseline at y), and its width."""
    upm = font['head'].unitsPerEm
    scale = size / upm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font['hmtx']
    track = tracking * upm
    names = [cmap.get(ord(c), '.notdef') for c in s]
    adv = [hmtx[n][0] + (track if i < len(names) - 1 else 0) for i, n in enumerate(names)]
    width = sum(adv) * scale
    x0 = x - (width / 2 if anchor == 'middle' else width if anchor == 'end' else 0)
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
    cx = 0.0
    for n, a in zip(names, adv):
        tp = TransformPen(pen, (scale, 0, 0, -scale, x0 + cx * scale, y))
        gs[n].draw(tp)
        cx += a
    return pen.getCommands(), width


def cap_height(font, size):
    os2 = font['OS/2']
    return (getattr(os2, 'sCapHeight', 0) or 0.7 * font['head'].unitsPerEm) * size / font['head'].unitsPerEm


ROOK = 'M22 12H34V21H44V12H56V21H66V12H78V31L70 38V64L77 72V78H83V90H17V78H23V72L30 64V38L22 31Z'
DOOR = 'M43 78V65A7 7 0 0 1 57 65V78Z'
SHIELD = 'M50 4L92 17V50C92 77 74 95 50 107C26 95 8 77 8 50V17Z'
SHIELD_IN = 'M50 11L86 22V50C86 73 70 89 50 99C30 89 14 73 14 50V22Z'

# The Royal Crest in the site's colours: a gold-rimmed navy enamel shield
# with a polished gold rook.
DEFS = f"""<defs>
<linearGradient id="cgold" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fbe3a0"/><stop offset="0.3" stop-color="#f3c460"/><stop offset="0.55" stop-color="{GOLD}"/>
  <stop offset="0.8" stop-color="#c98f2a"/><stop offset="1" stop-color="#9a6a18"/></linearGradient>
<radialGradient id="cnavy" cx="0.45" cy="0.3" r="0.85">
  <stop offset="0" stop-color="#22355f"/><stop offset="0.5" stop-color="{INK}"/><stop offset="1" stop-color="{NAVY}"/></radialGradient>
<linearGradient id="civory" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#c9bfaa"/><stop offset="0.35" stop-color="#fbf8f1"/><stop offset="0.55" stop-color="#ffffff"/>
  <stop offset="0.8" stop-color="#e6decd"/><stop offset="1" stop-color="#b5a98f"/></linearGradient>
<linearGradient id="cgoldcyl" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#7a520f"/><stop offset="0.16" stop-color="#c08a2a"/><stop offset="0.38" stop-color="#f3c460"/>
  <stop offset="0.48" stop-color="#fff0c0"/><stop offset="0.62" stop-color="{GOLD}"/><stop offset="0.86" stop-color="#a8701a"/><stop offset="1" stop-color="#6e470c"/></linearGradient>
<linearGradient id="cgloss" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity="0.3"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<filter id="cdrop" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2.2" stdDeviation="1.8" flood-color="#000" flood-opacity="0.45"/></filter>
<filter id="csoft" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.6" flood-color="#000" flood-opacity="0.3"/></filter>
</defs>"""


def crest(x, y, h, *_colors, inner=True, flat=False):
    """The Royal Crest, `h` high, top-left at (x, y) (drawn in a 100 x 112 box): a gold
    rim, a navy enamel shield and a polished gold rook. `flat` (or inner=False): plain
    colours, no shading, for tiny sizes and one-colour printing."""
    s = h / 112
    flat = flat or not inner
    rim, field, rook = (GOLD, INK, GOLD) if flat else ('url(#cgold)', 'url(#cnavy)', 'url(#cgoldcyl)')
    parts = [f'<path d="{SHIELD}" fill="{rim}"/>' if flat else f'<g filter="url(#csoft)"><path d="{SHIELD}" fill="{rim}"/></g>']
    if not flat:
        parts.append('<path d="M12 18L50 6.5L88 18" fill="none" stroke="#fff8e0" stroke-opacity="0.7" stroke-width="1.2"/>')
    parts.append(f'<path d="{SHIELD_IN}" fill="{field}"/>')
    if not flat:
        parts.append(f'<path d="{SHIELD_IN}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.4"/>')
        parts.append('<path d="M50 11L86 22V50C86 58 84 66 80 72" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1"/>')
        parts.append(f'<path d="{SHIELD_IN}" fill="url(#cgloss)"/>')
    sc = 0.59
    sw = 1.6 / sc
    filt = '' if flat else ' filter="url(#cdrop)"'
    edge = '' if flat else f' stroke="#4a2f06" stroke-width="{sw:.2f}" stroke-linejoin="round"'
    lit = '' if flat else (f'<path d="M22 12H34M44 12H56M66 12H78M17 78H83" stroke="#fff" stroke-opacity="0.55" stroke-width="{sw:.2f}" fill="none"/>'
                           f'<path d="M22 31L30 38M78 31L70 38" stroke="#000" stroke-opacity="0.25" stroke-width="{sw * 1.6:.2f}" fill="none"/>')
    parts.append(f'<g transform="translate(20.5 18) scale({sc})"{filt}><path d="{ROOK}" fill="{rook}"{edge}/>{lit}<path d="{DOOR}" fill="{NAVY}"/></g>')
    return f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.4f})">{"".join(parts)}</g>'


def svg(w, h, body, title, bg=None):
    rect = f'<rect width="{w:.0f}" height="{h:.0f}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{DEFS}{rect}{body}</svg>\n')


def write(name, content):
    open(os.path.join(out, name), 'w', encoding='utf-8').write(content)
    print(name)


COLORS = {
    'light': dict(shield=INK, line=GOLD, rook=GOLD, door=INK, chess=INK, castles=GOLD_DARK, tag='#4a5162'),
    'dark': dict(shield=GOLD, line=NAVY, rook=NAVY, door=GOLD, chess=IVORY, castles=GOLD, tag='#aab3c5'),
}

for mode, c in COLORS.items():
    # Horizontal: crest beside two lines of lettering (with and without the tagline).
    size = 56
    capH = cap_height(CINZEL, size)
    gap = 0.42 * size
    crest_h = 2 * capH + gap + 18
    tx = crest_h * 100 / 112 + 26
    top = 9
    l1, w1 = text(CINZEL, 'CHESS', size, tx, top + capH, 0.04)
    l2, w2 = text(CINZEL, 'CASTLES', size, tx, top + 2 * capH + gap, 0.04)
    w = tx + max(w1, w2) + 4
    body = crest(0, 0, crest_h, c['shield'], c['line'], c['rook'], c['door']) + f'<path d="{l1}" fill="{c["chess"]}"/><path d="{l2}" fill="{c["castles"]}"/>'
    write(f'chesscastles-logo-{mode}.svg', svg(w, crest_h, body, 'Chess Castles'))
    tsize = 15
    tag, tw = text(SORA, 'LEARN · PLAY · CONQUER', tsize, tx, crest_h + 26, 0.22)
    write(f'chesscastles-logo-tagline-{mode}.svg', svg(max(w, tx + tw + 4), crest_h + 32, body + f'<path d="{tag}" fill="{c["tag"]}"/>', 'Chess Castles: Learn, Play, Conquer'))

    # Stacked: crest above one line of lettering and the tagline, centred.
    size = 44
    capH = cap_height(CINZEL, size)
    line, lw = text(CINZEL, 'CHESS CASTLES', size, 0, 0, 0.05)
    tag, tw = text(SORA, 'LEARN · PLAY · CONQUER', 14, 0, 0, 0.24)
    w = max(lw, tw) + 8
    ch = 120
    cx = (w - ch * 100 / 112) / 2
    y1 = ch + 20 + capH
    line, _ = text(CINZEL, 'CHESS CASTLES', size, w / 2, y1, 0.05, 'middle')
    tag, _ = text(SORA, 'LEARN · PLAY · CONQUER', 14, w / 2, y1 + 30, 0.24, 'middle')
    body = crest(cx, 0, ch, c['shield'], c['line'], c['rook'], c['door']) + f'<path d="{line}" fill="{c["chess"]}"/><path d="{tag}" fill="{c["tag"]}"/>'
    write(f'chesscastles-stacked-{mode}.svg', svg(w, y1 + 36, body, 'Chess Castles: Learn, Play, Conquer'))

    # The site's logo: the crest, CHESS CASTLES on one line, the slogan under it.
    size = 46
    capH = cap_height(CINZEL, size)
    ch = 112
    tx = ch * 100 / 112 + 24
    n1, nw1 = text(CINZEL, 'CHESS ', size, tx, 46 + capH / 2, 0.04)
    n2, nw2 = text(CINZEL, 'CASTLES', size, tx + nw1, 46 + capH / 2, 0.04)
    sl, slw = text(SORA, 'LEARN · PLAY · CONQUER', 15, tx + 2, 46 + capH / 2 + 30, 0.26)
    w = tx + max(nw1 + nw2, slw) + 6
    body = crest(0, 0, ch) + f'<path d="{n1}" fill="{c["chess"]}"/><path d="{n2}" fill="{c["castles"]}"/><path d="{sl}" fill="{c["tag"]}"/>'
    write(f'chesscastles-logo-slogan-{mode}.svg', svg(w, ch, body, 'Chess Castles: Learn, Play, Conquer'))
    write('chesscastles-crest-flat.svg', svg(100, 112, crest(0, 0, 112, flat=True), 'Chess Castles crest'))

    # The crest alone.
    write(f'chesscastles-crest-{mode}.svg', svg(100, 112, crest(0, 0, 112, c['shield'], c['line'], c['rook'], c['door']), 'Chess Castles crest'))

# Icons: the crest on a navy tile (app icon, browser tab), simpler at small sizes.
d = COLORS['dark']
write('icon.svg', svg(512, 512, f'<rect width="512" height="512" rx="112" fill="{NAVY}"/>' + crest(256 - 150, 256 - 168, 336, d['shield'], d['line'], d['rook'], d['door']), 'Chess Castles'))
write('icon-maskable.svg', svg(512, 512, crest(256 - 112, 256 - 126, 252, d['shield'], d['line'], d['rook'], d['door']), 'Chess Castles', NAVY))
write('favicon.svg', svg(64, 64, f'<rect width="64" height="64" rx="14" fill="{NAVY}"/>' + crest(32 - 23.2, 32 - 26, 52, d['shield'], d['line'], d['rook'], d['door'], inner=False), 'Chess Castles'))

# A picture for links shared on WhatsApp, X, Facebook… (1200 × 630).
size = 64
capH = cap_height(CINZEL, size)
line, _ = text(CINZEL, 'CHESS CASTLES', size, 600, 420, 0.05, 'middle')
tag, _ = text(SORA, 'LEARN · PLAY · CONQUER', 24, 600, 478, 0.24, 'middle')
site, _ = text(SORA, 'chesscastles.com', 22, 600, 575, 0.02, 'middle')
body = crest(600 - 220 * 100 / 112 / 2, 110, 220, d['shield'], d['line'], d['rook'], d['door'])
body += f'<path d="{line}" fill="{IVORY}"/><path d="{tag}" fill="{CARAMEL_TEXT}"/><path d="{site}" fill="#8f9ab0"/>'
write('social-card.svg', svg(1200, 630, body, 'Chess Castles: Learn, Play, Conquer', NAVY))
