// Consolidates everything Aarav's sessions recorded (tester-data/session-*.json) into one
// dataset for building a beginner's improvement roadmap: reports/aarav-data.json (sessions,
// games, activities, profile numbers) and reports/aarav-games.csv (one row per game, with
// what was studied before it). Also refreshes the tables in reports/roadmap.md.
//   node scripts/e2e/tester-data.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = 'tester-data';
const files = readdirSync(DATA).filter((f) => /^session-.*\.json$/.test(f)).sort();
const num = (t, re) => Number((re.exec(t ?? '') ?? [])[1]) || undefined;
const profileNumbers = (text) => ({
  gamesAll: num(text, /(\d+) games Won/),
  accuracy: num(text, /Accuracy (\d+)%/),
  opening: num(text, /Opening (\d+)/),
  middlegame: num(text, /Middlegame (\d+)/),
  endgame: num(text, /Endgame (\d+)/),
  sharp: num(text, /Sharp moments[^\d]*(\d+)/),
  calm: num(text, /Calm moves (\d+)/),
  inaccuraciesPerGame: num(text, /Inaccuracies ([\d.]+)/),
  mistakesPerGame: num(text, /Mistakes ([\d.]+)/),
  blundersPerGame: num(text, /Blunders ([\d.]+)/),
});
const sessions = [];
const games = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(join(DATA, f), 'utf8'));
  const studied = d.studied?.feature?.replace('Learn → Openings → ', '') ?? '';
  const s = {
    session: d.session,
    when: d.when,
    skillLevel: d.skill,
    ratingBefore: d.before?.menu?.rating,
    ratingAfter: d.after?.menu?.rating,
    games: d.games.length,
    wins: d.games.filter((g) => (g.result === '1-0') === (g.color === 'white') && g.result !== '½-½').length,
    draws: d.games.filter((g) => g.result === '½-½').length,
    studied,
    studySteps: d.studied?.used ?? [],
    learn: d.learned?.feature ?? '',
    learnSteps: d.learned?.used ?? [],
    puzzles: d.learned?.puzzles ?? [],
    feature: d.feature?.feature ?? '',
    profileBefore: profileNumbers(d.before?.profile?.stats),
    profileAfter: profileNumbers(d.after?.profile?.stats),
    bugs: d.bugs.map((b) => b.title),
  };
  sessions.push(s);
  for (const g of d.games) {
    const won = g.result !== '½-½' && (g.result === '1-0') === (g.color === 'white');
    const change = num(g.ratingChange, /\(([-+]\d+)\)/);
    games.push({
      session: d.session,
      n: g.n,
      at: d.when,
      opponent: g.opp,
      color: g.color,
      result: g.result === '½-½' ? 'draw' : won ? 'win' : 'loss',
      reason: g.reason,
      plies: g.moves,
      minutes: g.minutes,
      skillLevel: d.skill - 1,
      fromStudiedLine: !!g.opening,
      line: g.opening,
      studiedBefore: g.opening ? studied : '',
      ratingChange: change,
      ratingAfter: num(g.ratingChange, /Rapid (\d+)/),
      accuracyMine: num(g.reportText, /Accuracy (\d+) (\d+)/) && (g.color === 'white' ? num(g.reportText, /Accuracy (\d+)/) : Number(/Accuracy \d+ (\d+)/.exec(g.reportText ?? '')?.[1]) || undefined),
      turningPoint: (/Turning point: (.+?), (\d+)%/.exec(g.review ?? '') ?? []).slice(1, 3).join(' · '),
      worstMoves: g.mistakes,
    });
  }
}
writeFileSync(join('reports', 'aarav-data.json'), JSON.stringify({ updated: new Date().toISOString(), sessions, games }, null, 1));
const cols = ['session', 'n', 'at', 'opponent', 'color', 'result', 'reason', 'plies', 'minutes', 'skillLevel', 'fromStudiedLine', 'line', 'studiedBefore', 'ratingChange', 'ratingAfter', 'accuracyMine', 'turningPoint', 'worstMoves'];
const csv = [cols.join(','), ...games.map((g) => cols.map((c) => JSON.stringify(Array.isArray(g[c]) ? g[c].join('; ') : (g[c] ?? ''))).join(','))].join('\n');
writeFileSync(join('reports', 'aarav-games.csv'), csv);

// The roadmap's evidence tables, from the data.
const by = (pred) => games.filter(pred);
const line = (list) => (list.length ? `${list.filter((g) => g.result === 'win').length} W · ${list.filter((g) => g.result === 'draw').length} D · ${list.filter((g) => g.result === 'loss').length} L in ${list.length} (${list.reduce((a, g) => a + (g.ratingChange ?? 0), 0) >= 0 ? '+' : ''}${list.reduce((a, g) => a + (g.ratingChange ?? 0), 0)} points)` : 'no games yet');
const evidence = [
  '## Evidence so far (updated by scripts/e2e/tester-data.mjs)', '',
  `Sessions: ${sessions.length} · games: ${games.length} · CC Rating ${sessions[0]?.ratingBefore ?? '?'} → ${sessions.at(-1)?.ratingAfter ?? '?'} · engine skill level now ${sessions.at(-1)?.skillLevel ?? '?'}`, '',
  '| Games | Result |', '|---|---|',
  `| Plain games (no line studied first) | ${line(by((g) => !g.fromStudiedLine))} |`,
  `| Games from a line studied the same session | ${line(by((g) => g.fromStudiedLine))} |`,
  `| As White | ${line(by((g) => g.color === 'white'))} |`,
  `| As Black | ${line(by((g) => g.color === 'black'))} |`,
  ...[...new Set(games.map((g) => g.opponent))].sort().map((o) => `| Against FIDE ${o} | ${line(by((g) => g.opponent === o))} |`),
  '', '| Session | Skill | Rating | Studied | Learn section | Puzzles | Accuracy | Sharp | Calm | Opening/Middle/End |', '|---|---|---|---|---|---|---|---|---|---|',
  ...sessions.map((s) => `| ${s.session} | ${s.skillLevel} | ${s.ratingBefore ?? '?'} → ${s.ratingAfter ?? '?'} | ${s.studied} | ${s.learn.replace('Learn → ', '')} | ${s.puzzles.join('/') || '–'} | ${s.profileAfter.accuracy ?? '–'} | ${s.profileAfter.sharp ?? '–'} | ${s.profileAfter.calm ?? '–'} | ${s.profileAfter.opening ?? '–'}/${s.profileAfter.middlegame ?? '–'}/${s.profileAfter.endgame ?? '–'} |`),
  '',
].join('\n');
const rm = join('reports', 'roadmap.md');
if (existsSync(rm)) {
  let r = readFileSync(rm, 'utf8');
  r = r.includes('## Evidence so far') ? r.replace(/## Evidence so far[\s\S]*?(?=\n## |$)/, evidence) : `${r.trimEnd()}\n\n${evidence}`;
  writeFileSync(rm, r);
}
console.log(`${sessions.length} sessions, ${games.length} games → reports/aarav-data.json, reports/aarav-games.csv, roadmap evidence updated`);
