// Picks the lesson moments from the Stockfish-checked list: up to 6 per pattern,
// as many different legends as possible (Indian players first), clean names and events.
// Run: node scripts/select-moments.mjs verified.json src/lib/coach/data/moments.json
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath, perMotif = '6'] = process.argv.slice(2);
const ORDER = [
  'gukesh', 'anand', 'divya', 'pragg', 'humpy', 'arjun', 'vaishali', 'harika', 'vidit', 'carlsen', 'kasparov', 'fischer', 'tal',
  'capablanca', 'morphy', 'harikrishna', 'nihal', 'alekhine', 'karpov', 'kramnik', 'polgar', 'spassky', 'petrosian', 'botvinnik',
  'lasker', 'houyifan', 'dingliren', 'firouzja', 'caruana', 'nakamura', 'smyslov', 'steinitz',
];
const LEGEND_NAME = {
  gukesh: 'Gukesh D', anand: 'Viswanathan Anand', divya: 'Divya Deshmukh', pragg: 'Praggnanandhaa R', humpy: 'Humpy Koneru',
  arjun: 'Arjun Erigaisi', vaishali: 'Vaishali R', harika: 'Harika Dronavalli', vidit: 'Vidit Gujrathi', carlsen: 'Magnus Carlsen',
  kasparov: 'Garry Kasparov', fischer: 'Bobby Fischer', tal: 'Mikhail Tal', capablanca: 'José Raúl Capablanca', morphy: 'Paul Morphy',
  harikrishna: 'Pentala Harikrishna', nihal: 'Nihal Sarin', alekhine: 'Alexander Alekhine', karpov: 'Anatoly Karpov',
  kramnik: 'Vladimir Kramnik', polgar: 'Judit Polgar', spassky: 'Boris Spassky', petrosian: 'Tigran Petrosian',
  botvinnik: 'Mikhail Botvinnik', lasker: 'Emanuel Lasker', houyifan: 'Hou Yifan', dingliren: 'Ding Liren',
  firouzja: 'Alireza Firouzja', caruana: 'Fabiano Caruana', nakamura: 'Hikaru Nakamura', smyslov: 'Vasily Smyslov',
  steinitz: 'Wilhelm Steinitz',
};

/** "Narayanan, Sri" -> "Sri Narayanan"; odd database spellings tidied. */
function person(name) {
  const n = String(name ?? '').replace(/�/g, '').trim();
  const [last, first] = n.split(/,\s*/);
  return first && !/\d/.test(first) ? `${first} ${last}` : n.replace(/,/g, '');
}

function event(e, site) {
  let s = String(e ?? '').trim();
  if (/^Titled Tue/i.test(s)) return 'Titled Tuesday (online)';
  s = s
    .replace(/\bWch\b/g, 'World Championship')
    .replace(/\bch-([A-Z]{3})\b/g, '$1 Championship')
    .replace(/\bsimultaan\b/gi, 'simul')
    .replace(/\bolm?\b/g, 'Olympiad')
    .replace(/\s+/g, ' ')
    .trim();
  const place = String(site ?? '').replace(/\s+[A-Z]{3}$/, '').trim();
  if (place && !/INT|chess\.com|lichess/i.test(site) && !s.includes(place)) s = `${s}, ${place}`;
  return s || place || 'a tournament game';
}

const all = JSON.parse(readFileSync(inPath, 'utf-8'));
const out = {};
for (const motif of [...new Set(all.map((m) => m.motif))]) {
  const rank = (l) => (ORDER.indexOf(l) < 0 ? 99 : ORDER.indexOf(l));
  const good = all
    .filter((m) => m.motif === motif)
    // Not too bare and not too crowded: easier to see the idea.
    .filter((m) => ['mate2', 'mate3', 'backrank', 'smothered', 'passedpawn'].includes(motif) || (m.pieces >= 9 && m.pieces <= 26))
    .sort((a, b) => rank(a.legend) - rank(b.legend) || a.pieces - b.pieces);
  const picked = [];
  const legends = new Set();
  const games = new Set();
  for (const pass of [0, 1]) {
    for (const m of good) {
      if (picked.length >= Number(perMotif)) break;
      if (games.has(m.gameId) || (pass === 0 && legends.has(m.legend))) continue;
      picked.push(m);
      legends.add(m.legend);
      games.add(m.gameId);
    }
  }
  out[motif] = picked.map((m) => {
    const legendWhite = m.fen.split(' ')[1] === 'w';
    const white = legendWhite ? LEGEND_NAME[m.legend] : person(m.white);
    const black = legendWhite ? person(m.black) : LEGEND_NAME[m.legend];
    return { fen: m.fen, move: m.move, game: { id: m.gameId, white, black, event: event(m.event, m.site), year: Number(m.year) || 0, legend: m.legend } };
  });
  console.log(motif.padEnd(13), out[motif].map((m) => `${m.game.legend}`).join(', '));
}
writeFileSync(outPath, JSON.stringify(out));
