"""Builds Knight24's chess library from public-domain books.

  python scripts/build-books.py F:/dev/gamesdb_work/books static/books

Chess books only, whose authors died more than 60 years ago (public domain
in India, and in the US): Project Gutenberg's public-domain texts and
Wikisource's proofread transcriptions. The Gutenberg header, footer and
licence are removed (we use the public-domain text only, as their licence
allows), page numbers are dropped, pictures are kept, Wikisource's chess
diagrams become positions (FEN) that the reader draws on a real board, and
each book is split into chapters.

Writes <slug>/book.json, <slug>/<image files> and index.json.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

from bs4 import BeautifulSoup, Comment, Tag

work, out = sys.argv[1], sys.argv[2]
UA = 'ChessCastles library builder/1.0 (+https://chesscastles.com)'

# topics: what the book teaches, for the library's shelves (opening, middlegame, endgame, general).
BOOKS = [
    dict(id=33870, slug='chess-fundamentals', title='Chess Fundamentals', author='José Raúl Capablanca', year=1921,
         level='Beginner to club player', notation='descriptive', colour='#1d4ed8', topics=['endgame', 'middlegame', 'opening'],
         about='The world champion explains the endgame, the middlegame and the opening in plain words, with his own games. One of the best chess books ever written.'),
    dict(wikisource='My Chess Career', slug='my-chess-career', title='My Chess Career', author='José Raúl Capablanca', year=1920,
         level='Club player', notation='descriptive', colour='#1e40af', topics=['middlegame', 'endgame', 'general'],
         about='Capablanca tells how he learned chess at four and became the best player in the world, through his own games, explained move by move.'),
    dict(id=16377, slug='blue-book-of-chess', title='The Blue Book of Chess', author='Howard Staunton', year=1870,
         level='Beginner', notation='descriptive', colour='#0e7490', topics=['opening', 'general'],
         about='The rules, the moves and the first ideas of the game, then every recognised opening, by the English master after whom the Staunton chess pieces are named.'),
    dict(wikisource="The Chess-Player's Text Book", slug='chess-players-text-book', title="The Chess-Player's Text Book", author='Howard Staunton', year=1849,
         level='Beginner', notation='descriptive', colour='#0f766e', topics=['general', 'opening', 'endgame'],
         about='A short first course: the board and the men, how they move, the laws of the game, the main openings and the simple mates.'),
    dict(id=78804, slug='studies-of-chess', title='Studies of Chess', author='François-André Danican Philidor and others', year=1810,
         level='Club player', notation='descriptive', colour='#7c3aed', topics=['opening', 'endgame'],
         about='Philidor, who said “pawns are the soul of chess”, analyses openings and endings. With the poem “Caïssa”, where the goddess of chess was born.'),
    dict(id=55278, slug='chess-generalship', title='Chess Generalship: Grand Reconnaissance', author='Franklin Knowles Young', year=1910,
         level='Advanced', notation='descriptive', colour='#374151', topics=['middlegame'],
         about='Chess explained like the art of war: how the pieces work together, and how to plan.'),
    dict(id=34180, slug='paul-morphy', title='The Exploits and Triumphs of Paul Morphy', author='Frederick Milnes Edge', year=1859,
         level='Chess history', notation='descriptive', colour='#b45309', topics=['general'],
         about='The story of Paul Morphy’s famous tour of Europe in 1858, told by his secretary: how the young American beat the best players of his time.'),
    dict(id=4902, slug='chess-history-and-reminiscences', title='Chess History and Reminiscences', author='Henry Edward Bird', year=1893,
         level='Chess history', notation='descriptive', colour='#4d7c0f', topics=['general'],
         about='Where chess came from (including India’s chaturanga) and stories of the great players and clubs of the 1800s.'),
    dict(wikisource='The Morals of Chess (1841)', slug='morals-of-chess', title='The Morals of Chess', author='Benjamin Franklin', year=1786,
         level='Short essay', notation='none', colour='#9a3412', topics=['general'],
         about='Benjamin Franklin on what chess teaches us: foresight, care and patience, and how to play fair. A few minutes to read.'),
    dict(wikisource="Maelzel's Chess-Player", slug='maelzels-chess-player', title="Maelzel's Chess-Player", author='Edgar Allan Poe', year=1836,
         level='Chess history', notation='none', colour='#581c87', topics=['general'],
         about='The famous writer Edgar Allan Poe works out, like a detective, how the chess-playing machine “The Turk” really hid a human player.'),
    dict(id=61410, slug='automaton-chess-player', title='The Automaton Chess Player', author='Robert Willis', year=1821,
         level='Chess history', notation='none', colour='#0f766e', topics=['general'],
         about='How did “The Turk”, the famous chess-playing machine, really work? A short, curious investigation from 1821.'),
]

# Wrappers (div, span, center…) are removed, so headings sit at the top level and chapters split cleanly.
KEEP = {'p', 'h2', 'h3', 'h4', 'i', 'b', 'em', 'strong', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'br', 'pre', 'blockquote',
        'sup', 'sub', 'ul', 'ol', 'li', 'hr', 'small', 'figure', 'figcaption'}
BLOCK_HEADINGS = ('h2', 'h3')


def fetch(url, path):
    if os.path.exists(path):
        return open(path, 'rb').read()
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    data = urllib.request.urlopen(req, timeout=60).read()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(data)
    return data


def clean(soup, slug, images):
    for el in soup.find_all(['script', 'style']):
        el.decompose()
    for el in soup.find_all(string=lambda t: isinstance(t, Comment)):
        el.extract()
    for el in soup.select('.pagenum, .pageno, span[class*=pagenum]'):
        el.decompose()
    for el in list(soup.find_all(True)):
        if el.name not in KEEP:
            el.unwrap()
            continue
        attrs = {}
        if el.name == 'img' and el.get('src'):
            src = el['src'].split('#')[0]
            name = re.sub(r'[^A-Za-z0-9._-]', '_', os.path.basename(urllib.parse.urlparse(src).path))
            images.add((src, name))
            attrs = {'src': f'/books/{slug}/{name}', 'alt': el.get('alt', 'Diagram'), 'loading': 'lazy'}
        if el.name == 'figure' and el.get('data-fen'):
            attrs = {'class': 'k24-diagram', 'data-fen': el['data-fen']}
        for k in ('colspan', 'rowspan'):
            if el.get(k):
                attrs[k] = el[k]
        el.attrs = attrs
    return soup


def split(body):
    """Chapters at h2/h3 headings; tiny sections (a heading alone) join the next."""
    chapters, cur = [], {'title': 'Opening', 'parts': []}
    for node in list(body.children):
        if isinstance(node, Tag) and node.name in BLOCK_HEADINGS:
            if cur['parts']:
                chapters.append(cur)
            cur = {'title': re.sub(r'\s+', ' ', node.get_text(' ')).strip()[:90] or 'Section', 'parts': [str(node)]}
        else:
            cur['parts'].append(str(node))
    chapters.append(cur)
    merged = []
    for c in chapters:
        html = ''.join(c['parts'])
        text = re.sub(r'<[^>]+>', '', html).strip()
        if merged and len(re.sub(r'<[^>]+>', '', merged[-1]['html'])) < 300 and '<img' not in merged[-1]['html'] and 'k24-diagram' not in merged[-1]['html']:
            merged[-1]['html'] += html
            if len(text) > 300:
                merged[-1]['title'] = f"{merged[-1]['title']} · {c['title']}"[:90]
        else:
            merged.append({'title': c['title'], 'html': html})
    return [m for m in merged if len(re.sub(r'<[^>]+>', '', m['html']).strip()) > 40]


# ---------- Project Gutenberg ----------

def gutenberg(b):
    raw = fetch(f"https://www.gutenberg.org/cache/epub/{b['id']}/pg{b['id']}-images.html", os.path.join(work, f"{b['id']}.html"))
    soup = BeautifulSoup(raw, 'html.parser')
    for el in soup.select('#pg-header, #pg-footer, section.pg-boilerplate, .pg-boilerplate, div#pg-machine-header, div#pg-start-separator, div#pg-end-separator'):
        el.decompose()
    body = soup.body or soup
    images = set()
    clean(body, b['slug'], images)
    chapters = split(body)
    for src, name in sorted(images):
        try:
            data = fetch(f"https://www.gutenberg.org/cache/epub/{b['id']}/{src}", os.path.join(work, str(b['id']), name))
            open(os.path.join(out, b['slug'], name), 'wb').write(data)
        except Exception as e:
            print('  image', src, e)
    return chapters, len(images), f"https://www.gutenberg.org/ebooks/{b['id']}", 'Project Gutenberg'


# ---------- Wikisource ----------

PIECES = {'king': 'k', 'queen': 'q', 'rook': 'r', 'bishop': 'b', 'knight': 'n', 'pawn': 'p'}


def board_fen(board):
    """The position in a Wikisource chess diagram, from its pieces' "e4 white king" labels."""
    grid = [[''] * 8 for _ in range(8)]
    for img in board.find_all('img'):
        m = re.match(r'^([a-h])([1-8]) (white|black) (king|queen|rook|bishop|knight|pawn)$', (img.get('alt') or '').strip())
        if m:
            f, r, colour, piece = m.groups()
            ch = PIECES[piece]
            grid[8 - int(r)][ord(f) - 97] = ch.upper() if colour == 'white' else ch
    rows = []
    for row in grid:
        s, empty = '', 0
        for c in row:
            if c:
                s += (str(empty) if empty else '') + c
                empty = 0
            else:
                empty += 1
        rows.append(s + (str(empty) if empty else ''))
    return '/'.join(rows)


def ws_page(title):
    path = os.path.join(work, 'wikisource', re.sub(r'[^A-Za-z0-9]+', '_', title) + '.json')
    url = 'https://en.wikisource.org/w/api.php?' + urllib.parse.urlencode({'action': 'parse', 'page': title, 'prop': 'text', 'format': 'json', 'formatversion': 2, 'redirects': 1})
    return json.loads(fetch(url, path))['parse']['text']


def ws_soup(html, slug):
    soup = BeautifulSoup(html, 'html.parser')
    for el in soup.select('.ws-noexport, .wst-header, #ws-data, .mw-editsection, .noprint, .reference, .mw-references-wrap, span[style*="display:none"], .pagenum, .ws-pagenum, .licenseContainer'):
        el.decompose()
    # Piece symbols inside the text (File:Chess_klt45.svg…) -> the chess characters.
    for img in soup.find_all('img'):
        m = re.search(r'Chess_([kqrbnp])([dl])t45', img.get('src', ''))
        if m and not img.find_parent('div', class_='chess-board'):
            glyph = 'kqrbnp'.index(m.group(1))
            img.replace_with(('♔♕♖♗♘♙' if m.group(2) == 'l' else '♚♛♜♝♞♟')[glyph])
    # Chess diagrams -> <figure data-fen>, drawn by the reader on a real board.
    for board in soup.select('div.chess-board'):
        holder = board.find_parent('div', class_='thumb') or board.find_parent('table') or board
        fen = board_fen(board)
        caption = ''
        if holder is not board:
            for b in holder.select('div.chess-board'):
                b.decompose()
            caption = re.sub(r'\s+', ' ', holder.get_text(' ')).strip()
            caption = re.sub(r'^(?:[a-h] ?){8}|(?:[a-h] ?){8}$', '', caption).strip()
            caption = re.sub(r'(?:\b[1-8]\b ?){8}', '', caption).strip()
        fig = soup.new_tag('figure', attrs={'data-fen': fen})
        if caption and len(caption) < 160:
            cap = soup.new_tag('figcaption')
            cap.string = caption
            fig.append(cap)
        holder.replace_with(fig)
    root = soup.select_one('.mw-parser-output') or soup
    return root


def wikisource(b):
    title = b['wikisource']
    html = ws_page(title)
    # The chapters, in the order the contents page lists them.
    subs = []
    for href in re.findall(r'href="/wiki/([^"#]+)"', html):
        t = urllib.parse.unquote(href).replace('_', ' ')
        if t.startswith(title + '/') and t not in subs:
            subs.append(t)
    images = set()
    chapters = []
    if subs:
        for t in subs:
            body = clean(ws_soup(ws_page(t), b['slug']), b['slug'], images)
            text = re.sub(r'\s+', ' ', body.get_text(' ')).strip()
            if len(text) < 60:
                continue
            name = t.split('/', 1)[1].replace('/', ' · ')
            # "CHAPTER II. TECHNICAL TERMS IN USE…" -> "Chapter 2: Technical terms in use…"
            # (an initial like "J. Corzo" does not end the title; a drop capital "W E have…" is the text, not a title)
            m = re.match(r'(?:PART [IVX]+ .{0,40}?)?CHAPTER [IVXL]+\.?\s*((?:[^.]|\.(?<=\b[A-Z]\.))+)', text)
            label = m.group(1).strip().rstrip(':;,') if m else ''
            if len(label) > 70 or re.match(r'^[A-Z] [A-Z]', label):
                label = ''
            letters = [c for c in label if c.isalpha()]
            if letters and sum(c.isupper() for c in letters) > 0.7 * len(letters):
                label = label.capitalize()
            chapters.append({'title': (f'{name}: {label}' if label and name.startswith('Chapter') else name)[:90], 'html': str(body)})
    else:
        body = clean(ws_soup(html, b['slug']), b['slug'], images)
        chapters = split(body) or [{'title': b['title'], 'html': str(body)}]
        if len(chapters) == 1:
            chapters[0]['title'] = b['title']
    for src, name in sorted(images):
        try:
            url = 'https:' + src if src.startswith('//') else src
            data = fetch(url, os.path.join(work, 'wikisource', 'img', name))
            open(os.path.join(out, b['slug'], name), 'wb').write(data)
        except Exception as e:
            print('  image', src, e)
    return chapters, len(images), 'https://en.wikisource.org/wiki/' + urllib.parse.quote(title.replace(' ', '_')), 'Wikisource'


index = []
for b in BOOKS:
    os.makedirs(os.path.join(out, b['slug']), exist_ok=True)
    chapters, n_images, source, source_name = wikisource(b) if b.get('wikisource') else gutenberg(b)
    meta = {k: b[k] for k in ('slug', 'title', 'author', 'year', 'level', 'notation', 'colour', 'about', 'topics')}
    book = {**meta, 'source': source, 'sourceName': source_name, 'audio': [], 'audioSource': None, 'chapters': chapters}
    json.dump(book, open(os.path.join(out, b['slug'], 'book.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    words = sum(len(re.sub(r'<[^>]+>', ' ', c['html']).split()) for c in chapters)
    diagrams = sum(c['html'].count('k24-diagram') for c in chapters)
    index.append({**meta, 'chapters': len(chapters), 'words': words, 'images': n_images, 'diagrams': diagrams, 'audio': 0})
    print(f"{b['slug']}: {len(chapters)} chapters, {words} words, {n_images} images, {diagrams} diagrams")

json.dump(index, open(os.path.join(out, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
