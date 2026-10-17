/**
 * Vision Sprint: one minute of quick board-sight questions with no board in
 * sight (square colours, diagonals, knight jumps, what a piece attacks).
 * The questions come from a seed, so the leaderboard server can re-create
 * and grade exactly what the player answered. No imports: this file is
 * shared with server/api-worker/src/sprint.ts.
 */

export type SprintKind = 'color' | 'diagonal' | 'knight' | 'attack' | 'between';

export interface SprintQuestion {
  kind: SprintKind;
  text: string;
  options: string[];
  answer: string;
}

/** Seconds per sprint, and the longest the server accepts after the ticket was issued. */
export const SPRINT_SECONDS = 60;
export const SPRINT_GRACE_SECONDS = 30;

/** A small, fast, seeded random (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILES = 'abcdefgh';
const sq = (f: number, r: number) => `${FILES[f]}${r + 1}`;
const isLight = (f: number, r: number) => (f + r) % 2 === 1;

/** Fewest knight moves between two squares (breadth-first on the board). */
export function knightDistance(f1: number, r1: number, f2: number, r2: number): number {
  const seen = new Map<number, number>([[f1 * 8 + r1, 0]]);
  const queue = [[f1, r1]];
  const jumps = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  while (queue.length) {
    const [f, r] = queue.shift()!;
    const d = seen.get(f * 8 + r)!;
    if (f === f2 && r === r2) return d;
    for (const [df, dr] of jumps) {
      const nf = f + df;
      const nr = r + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7 || seen.has(nf * 8 + nr)) continue;
      seen.set(nf * 8 + nr, d + 1);
      queue.push([nf, nr]);
    }
  }
  return -1;
}

const PIECE_NAMES = { Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', K: 'king' } as const;

/** Whether a lone piece on an empty board attacks a square. */
function attacks(piece: keyof typeof PIECE_NAMES, f1: number, r1: number, f2: number, r2: number): boolean {
  const df = Math.abs(f2 - f1);
  const dr = Math.abs(r2 - r1);
  if (!df && !dr) return false;
  switch (piece) {
    case 'Q':
      return df === 0 || dr === 0 || df === dr;
    case 'R':
      return df === 0 || dr === 0;
    case 'B':
      return df === dr;
    case 'N':
      return (df === 1 && dr === 2) || (df === 2 && dr === 1);
    case 'K':
      return df <= 1 && dr <= 1;
  }
}

/** The question `i` of the sprint with this seed (the same seed always gives the same questions). */
export function sprintQuestion(seed: number, i: number): SprintQuestion {
  const rnd = seeded((seed ^ Math.imul(i + 1, 2654435761)) >>> 0);
  const int = (n: number) => Math.floor(rnd() * n);
  const kinds: SprintKind[] = ['color', 'color', 'diagonal', 'knight', 'attack', 'between'];
  // The first few are easy warm-ups: colours.
  const kind: SprintKind = i < 3 ? 'color' : kinds[int(kinds.length)];
  const f1 = int(8);
  const r1 = int(8);
  if (kind === 'color') {
    return { kind, text: `Is ${sq(f1, r1)} a light or a dark square?`, options: ['Light', 'Dark'], answer: isLight(f1, r1) ? 'Light' : 'Dark' };
  }
  if (kind === 'diagonal') {
    // Half the time pick a square that really is on a diagonal.
    let f2 = int(8);
    let r2 = int(8);
    if (rnd() < 0.5) {
      const d = 1 + int(7);
      const sf = rnd() < 0.5 ? 1 : -1;
      const sr = rnd() < 0.5 ? 1 : -1;
      if (f1 + sf * d >= 0 && f1 + sf * d < 8 && r1 + sr * d >= 0 && r1 + sr * d < 8) {
        f2 = f1 + sf * d;
        r2 = r1 + sr * d;
      }
    }
    if (f2 === f1 && r2 === r1) f2 = (f1 + 3) % 8;
    const yes = Math.abs(f2 - f1) === Math.abs(r2 - r1);
    return { kind, text: `Are ${sq(f1, r1)} and ${sq(f2, r2)} on the same diagonal?`, options: ['Yes', 'No'], answer: yes ? 'Yes' : 'No' };
  }
  if (kind === 'knight') {
    let f2 = int(8);
    let r2 = int(8);
    if (f2 === f1 && r2 === r1) f2 = (f1 + 1) % 8;
    const d = knightDistance(f1, r1, f2, r2);
    return { kind, text: `Fewest knight moves from ${sq(f1, r1)} to ${sq(f2, r2)}?`, options: ['1', '2', '3', '4', '5', '6'], answer: String(d) };
  }
  if (kind === 'attack') {
    const pieces = ['Q', 'R', 'B', 'N', 'K'] as const;
    const p = pieces[int(pieces.length)];
    let f2 = int(8);
    let r2 = int(8);
    if (rnd() < 0.5) {
      // Often pick a square that is attacked, so "yes" comes up as much as "no".
      const cands: [number, number][] = [];
      for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) if (attacks(p, f1, r1, f, r)) cands.push([f, r]);
      [f2, r2] = cands[int(cands.length)];
    }
    if (f2 === f1 && r2 === r1) f2 = (f1 + 2) % 8;
    return {
      kind,
      text: `A ${PIECE_NAMES[p]} stands on ${sq(f1, r1)}, alone on the board. Does it attack ${sq(f2, r2)}?`,
      options: ['Yes', 'No'],
      answer: attacks(p, f1, r1, f2, r2) ? 'Yes' : 'No',
    };
  }
  // between: is a square between two others on a line?
  const dir = int(3); // 0: file, 1: rank, 2: diagonal
  let a: [number, number] = [f1, r1];
  let b: [number, number];
  if (dir === 0) b = [f1, (r1 + 3 + int(4)) % 8];
  else if (dir === 1) b = [(f1 + 3 + int(4)) % 8, r1];
  else {
    const d = 2 + int(5);
    const fa = Math.min(f1, 7 - d);
    const ra = Math.min(r1, 7 - d);
    a = [fa, ra];
    b = [fa + d, ra + d];
  }
  const df = Math.sign(b[0] - a[0]);
  const dr = Math.sign(b[1] - a[1]);
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  let c: [number, number];
  if (rnd() < 0.5 && steps > 1) {
    const k = 1 + int(steps - 1);
    c = [a[0] + df * k, a[1] + dr * k];
  } else {
    c = [int(8), int(8)];
  }
  let yes = false;
  for (let k = 1; k < steps; k++) if (a[0] + df * k === c[0] && a[1] + dr * k === c[1]) yes = true;
  return {
    kind: 'between',
    text: `Is ${sq(c[0], c[1])} between ${sq(a[0], a[1])} and ${sq(b[0], b[1])} on a straight line?`,
    options: ['Yes', 'No'],
    answer: yes ? 'Yes' : 'No',
  };
}

/** Score of a finished sprint: +1 for a right answer, −1 for a wrong one, never below 0. */
export function gradeSprint(seed: number, answers: string[]): { score: number; right: number; wrong: number } {
  let right = 0;
  let wrong = 0;
  answers.slice(0, 200).forEach((a, i) => {
    if (sprintQuestion(seed, i).answer === a) right++;
    else wrong++;
  });
  return { score: Math.max(0, right - wrong), right, wrong };
}
