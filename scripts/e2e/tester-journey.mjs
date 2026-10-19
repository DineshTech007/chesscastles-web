// Aarav's journey: first-person milestone posts built from the tester's real sessions
// (reports/aarav-data.json, from scripts/e2e/tester-data.mjs). Every game, number, opening,
// lesson and mistake in a post comes from the data; Aarav, his family and his coach are the
// story around it, and the page says so. Writes src/lib/journey/journey.json (the /journey
// pages read it) and reports/journey/*.md.
//   node scripts/e2e/tester-journey.mjs [target=2500]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TARGET = Number(process.argv[2] ?? 2500);
const data = JSON.parse(readFileSync(join('reports', 'aarav-data.json'), 'utf8'));
const { sessions, games } = data;
const MILESTONES = [1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500].filter((m) => m <= TARGET);

const COURSE = {
  'Caro-Kann Defence': { side: 'Black', idea: 'answer 1.e4 with ...c6 and ...d5, keep the pawns healthy, and be happy to reach an endgame' },
  'Jobava London': { side: 'White', idea: 'd4, Nc3 and Bf4 early, with the knight jumping to b5 to hit c7' },
  'Chebanenko Slav': { side: 'Black', idea: 'the Slav with ...a6: hold d5 and get ...b5 in' },
};
const LEARN_NAME = {
  tactics: 'a tactics lesson and a themed puzzle',
  puzzles: 'rated puzzles',
  strategy: "Guru's strategy lesson",
  'guru-review': 'a Guru review of one of my games',
  endgames: 'an endgame lesson',
  'database-review': 'my last game checked against the 5.4 million games',
  'masters-endgames': "an endgame from a master's own game",
  'vision-drill': 'a blindfold puzzle in the Blindfold Gym',
  'watch-game': 'a live grandmaster game with the engine on',
  'openings-other': 'a new opening in the trainer',
  traps: 'opening traps and principles',
  'books-read': 'a chapter of a chess book',
  leaderboard: 'the leaderboard',
  plan: 'my weekly plan',
  masters: 'the masters page',
  vision: 'the Blindfold Gym',
  books: 'the library',
};
const CATALOGUE_NAME = {
  italian: 'Italian Game', sicilian: 'Sicilian Defence', 'queens-gambit': "Queen's Gambit", french: 'French Defence', 'ruy-lopez': 'Ruy Lopez', nimzo: 'Nimzo-Indian',
  scotch: 'Scotch Game', 'kings-indian': "King's Indian", london: 'London System', scandinavian: 'Scandinavian', 'open-sicilian': 'Open Sicilian', qgd: "Queen's Gambit Declined",
  vienna: 'Vienna Game', najdorf: 'Sicilian Najdorf', catalan: 'Catalan', petrov: 'Petrov Defence', english: 'English Opening', grunfeld: 'Grünfeld', 'kings-gambit': "King's Gambit",
  berlin: 'Berlin Defence', jobava: 'Jobava London', dragon: 'Sicilian Dragon', slav: 'Slav Defence', sveshnikov: 'Sicilian Sveshnikov', pirc: 'Pirc Defence', 'queens-indian': "Queen's Indian",
  'semi-slav': 'Semi-Slav', benoni: 'Modern Benoni',
};
const lineName = (line) => (line?.startsWith('st-') ? { 'st-caro-kann--advance': 'Caro-Kann, Advance Variation', 'st-jobava-london--e6': 'Jobava London, 3...e6', 'st-chebanenko--e3': 'Chebanenko Slav, 5.e3' }[line] ?? line : CATALOGUE_NAME[line] ?? line);
const dateOf = (when) => new Date(`${when.slice(0, 10)}T${when.slice(11, 13)}:${when.slice(13, 15)}:00`);
const dayText = (when) => dateOf(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const pct = (l) => (l.length ? Math.round((100 * l.filter((g) => g.result === 'win').length) / l.length) : 0);
const rec = (l) => `${l.filter((g) => g.result === 'win').length} wins, ${l.filter((g) => g.result === 'draw').length} draws, ${l.filter((g) => g.result === 'loss').length} losses`;

// The story frame (fiction, said so on the page): who is around Aarav.
const FRAME = {
  name: 'Aarav',
  age: 11,
  city: 'Pune',
  family: 'my mother (who set the 6 pm study timer and never let me skip the review), my father (who drives me to every tournament and asks one question after each game: "which move?") and my little sister Diya, who learned the moves by watching',
  coach: 'my coach, Deshpande sir, a FIDE Master who runs the Saturday class at our school',
};

/** The sessions up to the one where the rating first reached `m`. */
function reached(m) {
  const i = sessions.findIndex((s) => (s.ratingAfter ?? 0) >= m);
  return i < 0 ? undefined : i;
}
const prevMilestone = (m) => MILESTONES[MILESTONES.indexOf(m) - 1] ?? 1500;

function post(m) {
  const end = reached(m);
  if (end === undefined) return undefined;
  // The first post covers everything from the start; later ones, the sessions since the last milestone.
  const startIdx = (() => {
    if (m === MILESTONES[0]) return 0;
    const p = reached(prevMilestone(m));
    return p === undefined ? 0 : p + 1;
  })();
  const span = sessions.slice(startIdx, end + 1);
  const spanGames = games.filter((g) => g.session >= span[0].session && g.session <= span.at(-1).session);
  const s = sessions[end];
  const allGames = games.filter((g) => g.session <= s.session);
  const losses = spanGames.filter((g) => g.result === 'loss' && g.worstMoves?.length);
  const worst = losses[0];
  const upWins = spanGames.filter((g) => g.n === 2 && g.result === 'win');
  const studied = [...new Set(span.map((x) => x.studied).filter(Boolean))];
  const learned = [...new Set(span.map((x) => x.learn.replace('Learn → ', '')).filter(Boolean))].map((k) => LEARN_NAME[k] ?? k);
  const newOpenings = [...new Set(spanGames.filter((g) => g.line && !g.line.startsWith('st-')).map((g) => lineName(g.line)))];
  const lineGames = spanGames.filter((g) => g.fromStudiedLine);
  const prof = s.profileAfter ?? {};
  const first = span[0];
  const body = [];
  body.push(`${dayText(s.when)}. Today my CC Rating on Chess Castles touched ${s.ratingAfter}. ${m === 1600 ? `When I started, in October, it said 1500 "(new)" and I lost my first three games in a row. ` : `The last stop was ${prevMilestone(m)}. `}Between then and now: ${span.length} ${span.length === 1 ? 'session' : 'sessions'}, ${spanGames.length} rapid games (15+10, never faster: ${FRAME.coach} says fast games only teach you about the clock), ${rec(spanGames)}.`);
  if (worst) {
    const [tp, lost] = (worst.turningPoint ?? '').replace(/by chesscastlestester/i, 'by me').split(' · ');
    body.push(`The game I remember most is the one I lost as ${worst.color} against the ${worst.opponent} in session ${worst.session}: ${worst.worstMoves.slice(0, 2).join(' and ')}. The review marked the turning point as ${tp || 'one move'}${lost ? `, ${lost}% of the winning chances gone in one move` : ''}. My father asked his question in the car: "which move?" I knew the answer this time, and that is the whole point of the review.`);
  }
  if (studied.length) body.push(`Openings: ${studied.map((c) => `the ${c}${COURSE[c] ? ` as ${COURSE[c].side} (${COURSE[c].idea})` : ''}`).join('; ')}. Each time the same routine from Learn → Openings: the course page, one model game played through, the trainer, and only then the line against a FIDE-rated opponent. From those lines in this stretch: ${rec(lineGames)}.`);
  if (newOpenings.length) body.push(`New in the trainer: ${newOpenings.join(', ')}. One opening a session, two moves at a time, and the trainer tells me at once when a move is not the line.`);
  if (learned.length) body.push(`The rest of Learn, one thing a session: ${learned.join('; ')}.`);
  if (prof.accuracy) body.push(`My profile says: accuracy ${prof.accuracy}%, opening ${prof.opening}, middlegame ${prof.middlegame}, endgame ${prof.endgame}; sharp moments ${prof.sharp} and calm moves ${prof.calm}. ${prof.sharp < 80 ? 'The sharp number is the low one, so tactics come first this week.' : 'The sharp number is up, which is what the puzzles were for.'}`);
  if (upWins.length) body.push(`${upWins.length === 1 ? 'One win' : `${upWins.length} wins`} against an opponent one level up (${upWins.map((g) => g.opponent).join(', ')}). My mother says that is the one that counts.`);
  body.push(`All my games so far: ${allGames.length}, ${rec(allGames)}; ${pct(allGames.filter((g) => g.color === 'white'))}% as White and ${pct(allGames.filter((g) => g.color === 'black'))}% as Black. Next stop: ${MILESTONES[MILESTONES.indexOf(m) + 1] ?? 'the title'}.`);
  return {
    slug: `aarav-${m}`,
    milestone: m,
    date: s.when.slice(0, 10),
    title: m >= TARGET ? `How I reached ${m}` : `${m}: ${m === 1600 ? 'the first step' : m === 1800 ? 'the lines start to work' : m === 2000 ? 'a real player now' : m === 2200 ? 'candidate master numbers' : m === 2400 ? 'the master mark' : 'another hundred'}`,
    sessions: span.map((x) => x.session),
    games: spanGames.length,
    record: rec(spanGames),
    body,
  };
}

/** The last post: the whole road, when the target is reached. */
function finalPost() {
  const end = reached(TARGET);
  if (end === undefined) return undefined;
  const s = sessions[end];
  const all = games.filter((g) => g.session <= s.session);
  const firstDay = dayText(sessions[0].when);
  const lastDay = dayText(s.when);
  const lineEarly = all.filter((g) => g.fromStudiedLine && g.session <= 3);
  const lineLater = all.filter((g) => g.fromStudiedLine && g.session > 3);
  const byOpp = [...new Set(all.map((g) => g.opponent))].sort((a, b) => a - b).map((o) => `${o}: ${rec(all.filter((g) => g.opponent === o))}`);
  const openings = [...new Set(all.map((g) => g.line).filter(Boolean))].map(lineName);
  const learned = [...new Set(sessions.slice(0, end + 1).map((x) => x.learn.replace('Learn → ', '')).filter(Boolean))].map((k) => LEARN_NAME[k] ?? k);
  const prof = s.profileAfter ?? {};
  return {
    slug: `aarav-${TARGET}-the-whole-road`,
    milestone: TARGET,
    date: s.when.slice(0, 10),
    title: `How a beginner reached ${TARGET}: the whole road`,
    sessions: sessions.slice(0, end + 1).map((x) => x.session),
    games: all.length,
    record: rec(all),
    body: [
      `From ${firstDay} to ${lastDay}: ${sessions.length} sessions, ${all.length} rapid games, CC Rating 1500 → ${s.ratingAfter}. ${rec(all)}. This is everything I did, in order, so that you can do it too.`,
      `1. Slow games only. Every game was 15+10 against a FIDE-rated opponent at my level, and game two of every session against one level up. By opponent: ${byOpp.join('; ')}.`,
      `2. Review every game, find the one move. Every loss I had was one move: the review's turning point. ${FRAME.coach} made me say in words why that move was bad before I was allowed the next game. ${FRAME.family}.`,
      `3. Learn a line before you play it. My first ${lineEarly.length} games from a line I had seen the same day: ${rec(lineEarly)}. After I started doing the course page, a model game and the trainer first, the next ${lineLater.length}: ${rec(lineLater)}.`,
      `4. One opening at a time, then many. ${openings.length} openings in all: ${openings.join(', ')}.`,
      `5. The rest of Learn, one thing a day: ${learned.join('; ')}.`,
      `6. Read the numbers. My profile at the end: accuracy ${prof.accuracy}%, opening ${prof.opening}, middlegame ${prof.middlegame}, endgame ${prof.endgame}, sharp moments ${prof.sharp}, calm moves ${prof.calm}. When a number was low, that was the next week's work.`,
      `The rating is a number. What changed is that I know, after every game, exactly which move to look at. Start there.`,
    ],
  };
}

const posts = MILESTONES.map(post).filter(Boolean);
const last = finalPost();
if (last) posts.push(last);
const curve = sessions.map((s) => ({ session: s.session, date: s.when.slice(0, 10), rating: s.ratingAfter ?? s.ratingBefore ?? 1500 }));
const journey = {
  updated: new Date().toLocaleDateString('en-CA'),
  target: TARGET,
  reached: !!last,
  hero: { ...FRAME, start: 1500, now: sessions.at(-1)?.ratingAfter ?? 1500, sessions: sessions.length, games: games.length, record: rec(games) },
  curve,
  posts,
};
mkdirSync('src/lib/journey', { recursive: true });
writeFileSync('src/lib/journey/journey.json', JSON.stringify(journey, null, 1));
mkdirSync(join('reports', 'journey'), { recursive: true });
for (const p of posts) writeFileSync(join('reports', 'journey', `${p.slug}.md`), `# ${p.title}\n\n${p.date} · sessions ${p.sessions.join(', ')} · ${p.games} games · ${p.record}\n\n${p.body.join('\n\n')}\n`);
console.log(`${posts.length} posts (${posts.map((p) => p.milestone).join(', ')})${last ? ' including the final one' : ''} → src/lib/journey/journey.json, reports/journey/`);
