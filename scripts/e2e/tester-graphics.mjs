// Pictures for the blog and the journey pages, drawn from the practice account's record
// (src/lib/journey/journey.json, reports/aarav-data.json): the rating curve, the
// "learn a line before you play it" bars, the profile numbers before and after, and
// the session plan. Written as SVG to static/journey/ (crisp at any size, one look in
// both themes: navy ground, gold marks, white text).
//   node scripts/e2e/tester-graphics.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const journey = JSON.parse(readFileSync('src/lib/journey/journey.json', 'utf8'));
const data = JSON.parse(readFileSync('reports/aarav-data.json', 'utf8'));
mkdirSync('static/journey', { recursive: true });
const NAVY = '#0b1426';
const CARD = '#14213d';
const GOLD = '#edb040';
const TEXT = '#f4f1ea';
const MUTED = '#9aa6c0';
const FONT = "font-family='Segoe UI, Roboto, Helvetica, Arial, sans-serif'";
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 1. The rating curve.
{
  const W = 1200;
  const H = 520;
  const curve = journey.curve;
  const lo = 1300;
  const hi = 2600;
  const x = (i) => 80 + (i * (W - 120)) / Math.max(1, curve.length - 1);
  const y = (r) => H - 70 - ((r - lo) * (H - 150)) / (hi - lo);
  const path = curve.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(c.rating).toFixed(1)}`).join(' ');
  const area = `${path} L${x(curve.length - 1).toFixed(1)} ${y(lo)} L${x(0)} ${y(lo)} Z`;
  const ticks = [1400, 1600, 1800, 2000, 2200, 2400];
  const marks = [[3, 'low point 1353'], [10, '1619'], [22, '2017'], [37, '2520']];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' width='${W}' height='${H}' ${FONT}>
<rect width='${W}' height='${H}' rx='18' fill='${NAVY}'/>
<text x='40' y='46' font-size='26' font-weight='700' fill='${TEXT}'>CC Rating by session: 1500 → ${journey.hero.now}</text>
<text x='40' y='74' font-size='16' fill='${MUTED}'>${curve.length} sessions · ${data.games.length} rapid games (15+10) · ${journey.hero.record}</text>
${ticks.map((t) => `<line x1='80' x2='${W - 40}' y1='${y(t)}' y2='${y(t)}' stroke='#2a3a5f' stroke-dasharray='4 6'/><text x='72' y='${y(t) + 5}' font-size='14' text-anchor='end' fill='${MUTED}'>${t}</text>`).join('')}
<line x1='80' x2='${W - 40}' y1='${y(2500)}' y2='${y(2500)}' stroke='${GOLD}' stroke-dasharray='8 6'/><text x='${W - 44}' y='${y(2500) - 8}' font-size='14' text-anchor='end' fill='${GOLD}'>target 2500</text>
<path d='${area}' fill='${GOLD}' opacity='0.12'/>
<path d='${path}' fill='none' stroke='${GOLD}' stroke-width='3.5' stroke-linejoin='round'/>
${curve.map((c, i) => `<circle cx='${x(i)}' cy='${y(c.rating)}' r='4' fill='${GOLD}'/>`).join('')}
${marks.map(([sNo, label]) => { const i = curve.findIndex((c) => c.session === sNo); if (i < 0) return ''; const c = curve[i]; const up = c.rating < 1800; const last = i === curve.length - 1; return `<text x='${x(i)}' y='${y(c.rating) + (up ? 26 : -14)}' font-size='15' font-weight='700' text-anchor='${last ? 'end' : 'middle'}' fill='${TEXT}'>${esc(label)}</text>`; }).join('')}
${[1, 10, 20, 30, curve.length].map((n) => { const i = curve.findIndex((c) => c.session === n); return i < 0 ? '' : `<text x='${x(i)}' y='${H - 40}' font-size='14' text-anchor='middle' fill='${MUTED}'>session ${n}</text>`; }).join('')}
</svg>`;
  writeFileSync('static/journey/rating-curve.svg', svg);
}

// 2. Learn a line before you play it.
{
  const G = data.games;
  const early = G.filter((g) => g.fromStudiedLine && g.session <= 3);
  const later = G.filter((g) => g.fromStudiedLine && g.session > 3);
  const count = (l, r) => l.filter((g) => g.result === r).length;
  const W = 1200;
  const H = 400;
  const row = (yy, title, list, color) => {
    const w = W - 120;
    const n = list.length;
    const parts = [['win', '#3fb27f', 'wins'], ['draw', '#9aa6c0', 'draws'], ['loss', '#e05d5d', 'losses']];
    let xx = 60;
    let out = `<text x='60' y='${yy - 18}' font-size='18' font-weight='700' fill='${TEXT}'>${esc(title)}</text>`;
    for (const [r, c, name] of parts) {
      const k = count(list, r);
      const ww = (w * k) / n;
      if (k) out += `<rect x='${xx}' y='${yy}' width='${Math.max(2, ww - 3)}' height='44' rx='6' fill='${c}'/><text x='${xx + ww / 2}' y='${yy + 29}' font-size='16' font-weight='700' text-anchor='middle' fill='${NAVY}'>${k} ${name}</text>`;
      xx += ww;
    }
    return out + `<text x='${W - 60}' y='${yy + 70}' font-size='14' text-anchor='end' fill='${MUTED}'>${n} games</text>`;
  };
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' width='${W}' height='${H}' ${FONT}>
<rect width='${W}' height='${H}' rx='18' fill='${NAVY}'/>
<text x='60' y='52' font-size='26' font-weight='700' fill='${TEXT}'>Learn the line before you play it</text>
<text x='60' y='80' font-size='16' fill='${MUTED}'>Games played from an opening course’s line, on Chess Castles</text>
${row(140, 'Played the same session the line was first seen', early, GOLD)}
${row(270, 'After the course page, a model game and the trainer', later, GOLD)}
</svg>`;
  writeFileSync('static/journey/learn-before-play.svg', svg);
}

// 3. The profile's numbers, first five reviewed games vs the end.
{
  const first = data.sessions.find((s) => s.profileAfter?.accuracy)?.profileAfter ?? {};
  const last = [...data.sessions].reverse().find((s) => s.profileAfter?.accuracy)?.profileAfter ?? {};
  const rows = [['Accuracy', 'accuracy'], ['Opening', 'opening'], ['Middlegame', 'middlegame'], ['Endgame', 'endgame'], ['Sharp moments (tactics)', 'sharp'], ['Calm moves (plans)', 'calm']].filter(([, k]) => first[k] && last[k]);
  const W = 1200;
  const H = 110 + rows.length * 62;
  const bar = (yy, label, a, b) => `<text x='60' y='${yy + 22}' font-size='17' fill='${TEXT}'>${esc(label)}</text>
<rect x='340' y='${yy + 4}' width='${(a / 100) * 760}' height='12' rx='6' fill='#3a4a70'/><text x='${340 + (a / 100) * 760 + 10}' y='${yy + 15}' font-size='14' fill='${MUTED}'>${a} at the start</text>
<rect x='340' y='${yy + 22}' width='${(b / 100) * 760}' height='12' rx='6' fill='${GOLD}'/><text x='${340 + (b / 100) * 760 + 10}' y='${yy + 33}' font-size='14' font-weight='700' fill='${GOLD}'>${b} at the end</text>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' width='${W}' height='${H}' ${FONT}>
<rect width='${W}' height='${H}' rx='18' fill='${NAVY}'/>
<text x='60' y='48' font-size='26' font-weight='700' fill='${TEXT}'>Profile → “How you play”: the numbers moved first</text>
<text x='60' y='76' font-size='16' fill='${MUTED}'>After the first 5 reviewed games (rating 1454) and after the last session (rating ${journey.hero.now})</text>
${rows.map(([label, k], i) => bar(100 + i * 62, label, first[k], last[k])).join('')}
</svg>`;
  writeFileSync('static/journey/profile-numbers.svg', svg);
}

// 4. One session, step by step.
{
  const steps = [
    ['1', 'Game 1', 'Rapid 15+10 vs the FIDE-rated opponent at your level', 'Play → Play at FIDE level'],
    ['2', 'Game 2', 'The same, one level up', 'Play → Play at FIDE level'],
    ['3', 'Review', 'Find the turning point of each game', 'Analyse → Report'],
    ['4', 'Course', 'Course page → model game → trainer', 'Learn → Openings → Courses'],
    ['5', 'One more thing', 'Puzzles, Guru, endgames, database, masters, blindfold…', 'Learn'],
    ['6', 'Games 3–4', 'From the course’s line', 'the course’s Play it'],
    ['7', 'Game 5', 'A new opening from the catalogue, from move one', 'Learn → Openings → Trainer'],
    ['8', 'Profile', 'Read the numbers; the low one is next', 'Profile → How you play'],
  ];
  const W = 1200;
  const H = 120 + steps.length * 64;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' width='${W}' height='${H}' ${FONT}>
<rect width='${W}' height='${H}' rx='18' fill='${NAVY}'/>
<text x='60' y='48' font-size='26' font-weight='700' fill='${TEXT}'>One session, step by step</text>
<text x='60' y='76' font-size='16' fill='${MUTED}'>About 90 minutes for a person; the order matters more than the time</text>
${steps.map(([n, title, what, where], i) => { const yy = 104 + i * 64; return `<rect x='60' y='${yy}' width='${W - 120}' height='52' rx='12' fill='${CARD}'/><circle cx='92' cy='${yy + 26}' r='18' fill='${GOLD}'/><text x='92' y='${yy + 32}' font-size='17' font-weight='800' text-anchor='middle' fill='${NAVY}'>${n}</text><text x='126' y='${yy + 32}' font-size='18' font-weight='700' fill='${TEXT}'>${esc(title)}</text><text x='300' y='${yy + 32}' font-size='16' fill='${TEXT}'>${esc(what)}</text><text x='${W - 80}' y='${yy + 32}' font-size='14' text-anchor='end' fill='${GOLD}'>${esc(where)}</text>`; }).join('')}
</svg>`;
  writeFileSync('static/journey/session-plan.svg', svg);
}
console.log('static/journey: rating-curve.svg, learn-before-play.svg, profile-numbers.svg, session-plan.svg');
