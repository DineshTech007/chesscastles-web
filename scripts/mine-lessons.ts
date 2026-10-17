// Finds lesson moments in legends' games in CaissaBase: tactics (forks,
// pins, skewers, discovered attacks, mates, sacrifices…) and strategy
// (outposts, the 7th rank, open files). scripts/verify-moments.mjs then keeps
// only the moments Stockfish confirms.
// Run: npx vite-node scripts/mine-lessons.ts F:/dev/caissabase_2024.db3 out.json
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { attacks, between, kingAttacks } from 'chessops/attacks';
import type { Chess } from 'chessops/chess';
import { SquareSet } from 'chessops/squareSet';
import type { Color, Role, Square } from 'chessops/types';
import { opposite, squareFile, squareRank } from 'chessops/util';
import { fenOf, moveToUci } from '$lib/chess/position';
import { decodeMoves } from '$lib/games/caissa';

const [dbPath, outPath] = process.argv.slice(2);

/** Legend key -> the names the database uses for them (and the years their games can be from). */
const LEGENDS: Record<string, { names: string[]; from?: number; to?: number }> = {
  gukesh: { names: ['Gukesh, D'], from: 2012 },
  anand: { names: ['Anand, Viswanathan', 'Anand, V'], from: 1980 },
  pragg: { names: ['Praggnanandhaa, R'], from: 2012 },
  divya: { names: ['Divya, Deshmukh'], from: 2012 },
  humpy: { names: ['Koneru, Humpy', 'Koneru, H'], from: 1995 },
  arjun: { names: ['Erigaisi, Arjun'], from: 2012 },
  vaishali: { names: ['Vaishali, R', 'Vaishali, Rameshbabu'], from: 2010 },
  harika: { names: ['Harika, Dronavalli', 'Harika, D', 'Dronavalli, Harika'], from: 2000 },
  vidit: { names: ['Vidit, S', 'Vidit, Santosh Gujrathi'], from: 2005 },
  harikrishna: { names: ['Harikrishna, Pendyala', 'Harikrishna, P'], from: 1995 },
  nihal: { names: ['Nihal, Sarin'], from: 2012 },
  carlsen: { names: ['Carlsen, Magnus', 'Carlsen, M'], from: 2000 },
  kasparov: { names: ['Kasparov, Garry'] },
  fischer: { names: ['Fischer, R.', 'Fischer, Robert J'], to: 1993 },
  tal: { names: ['Tal, Mikhail'] },
  capablanca: { names: ['Capablanca, Jose'] },
  morphy: { names: ['Morphy, Paul'] },
  alekhine: { names: ['Alekhine, Alexander'] },
  karpov: { names: ['Karpov, A.', 'Karpov, Anatoly'], from: 1965 },
  kramnik: { names: ['Kramnik, Vladimir'] },
  spassky: { names: ['Spassky, Boris V'] },
  petrosian: { names: ['Petrosian, T.', 'Petrosian, Tigran V'], to: 1984 },
  botvinnik: { names: ['Botvinnik, M.', 'Botvinnik, Mikhail URS'], to: 1985 },
  lasker: { names: ['Lasker, Emanuel'] },
  polgar: { names: ['Polgar, Judit', 'Polgar, J.'] },
  houyifan: { names: ['Hou, Yifan', 'Hou Yifan'] },
  dingliren: { names: ['Ding, Liren', 'Ding Liren'] },
  firouzja: { names: ['Firouzja, Alireza'], from: 2010 },
  caruana: { names: ['Caruana, Fabiano', 'Caruana, F'] },
  nakamura: { names: ['Nakamura, Hikaru', 'Nakamura, Hi'] },
  smyslov: { names: ['Smyslov, V.', 'Smyslov, Vasily'] },
  steinitz: { names: ['Steinitz, Wilhelm'] },
};

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
const material = (pos: Chess, c: Color) =>
  (['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[]).reduce((s, r) => s + pos.board.pieces(c, r).size() * VALUE[r], 0);
const balance = (pos: Chess, c: Color) => material(pos, c) - material(pos, opposite(c));
const relRank = (sq: Square, c: Color) => (c === 'white' ? squareRank(sq) : 7 - squareRank(sq));

function attackersOf(pos: Chess, target: Square, color: Color): Square[] {
  const out: Square[] = [];
  for (const from of pos.board[color]) if (attacks(pos.board.get(from)!, from, pos.board.occupied).has(target)) out.push(from);
  return out;
}

interface Moment {
  motif: string;
  gameId: number;
  legend: string;
  white: string;
  black: string;
  year: string;
  event: string;
  site: string;
  result: string;
  ply: number;
  fen: string;
  move: string;
  pieces: number;
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const idToLegend = new Map<number, string>();
for (const [key, l] of Object.entries(LEGENDS)) {
  for (const name of l.names) {
    const row = db.prepare('SELECT ID FROM Players WHERE Name = ?').get(name) as { ID: number } | undefined;
    if (row) idToLegend.set(row.ID, key);
  }
}
console.log('legend names found:', idToLegend.size);
const idList = [...idToLegend.keys()].join(',');
const games = db
  .prepare(
    `SELECT g.ID, g.Moves, g.Date, g.Result, g.WhiteID, g.BlackID, w.Name AS W, b.Name AS B, e.Name AS E, s.Name AS S
     FROM Games g JOIN Players w ON w.ID = g.WhiteID JOIN Players b ON b.ID = g.BlackID
     LEFT JOIN Events e ON e.ID = g.EventID LEFT JOIN Sites s ON s.ID = g.SiteID
     WHERE (g.WhiteID IN (${idList}) OR g.BlackID IN (${idList})) AND g.FEN IS NULL`,
  )
  .all() as { ID: number; Moves: Uint8Array; Date: string; Result: string; WhiteID: number; BlackID: number; W: string; B: string; E: string; S: string }[];
console.log('games:', games.length);

const out: Moment[] = [];
let done = 0;
for (const g of games) {
  if (++done % 10000 === 0) console.log(done, 'games,', out.length, 'moments');
  const year = Number((g.Date ?? '').slice(0, 4)) || 0;
  const sideLegend: Partial<Record<Color, string>> = {};
  for (const [c, id] of [['white', g.WhiteID], ['black', g.BlackID]] as const) {
    const key = idToLegend.get(id);
    const l = key ? LEGENDS[key] : undefined;
    if (key && l && (!l.from || year >= l.from) && (!l.to || year <= l.to)) sideLegend[c] = key;
  }
  if (!sideLegend.white && !sideLegend.black) continue;
  let moves;
  try {
    moves = decodeMoves(Buffer.from(g.Moves).toString('base64')).moves;
  } catch {
    continue;
  }
  if (moves.length < 6) continue;
  const positions: Chess[] = [];
  let pos = decodeMoves('').start;
  for (const m of moves) {
    positions.push(pos.clone());
    pos.play(m);
  }
  positions.push(pos.clone());
  const last = moves.length - 1;
  const endsInMate = positions[last + 1].isCheckmate();
  const mater: Color = positions[last].turn;
  const base = { gameId: g.ID, white: g.W, black: g.B, year: String(year || ''), event: g.E ?? '', site: g.S ?? '', result: g.Result };
  const found = new Set<string>();

  for (let i = 0; i <= last; i++) {
    const before = positions[i];
    const me = before.turn;
    const legend = sideLegend[me];
    if (!legend) continue;
    const them = opposite(me);
    const m = moves[i];
    const after = positions[i + 1];
    const piece = after.board.get(m.to);
    // Castling is written king-to-rook: nothing of interest stands there.
    if (!piece || piece.color !== me) continue;
    const captured = before.board.get(m.to);
    const bal0 = balance(before, me);
    const even = Math.abs(bal0) <= 1;
    const gain = (k: number) => balance(positions[Math.min(i + k, last + 1)], me) - bal0;
    const won = (me === 'white' && g.Result === '1-0') || (me === 'black' && g.Result === '0-1');
    const enemyKing = after.board.kingOf(them);
    const add = (motif: string) => {
      if (found.has(motif)) return;
      found.add(motif);
      out.push({ motif, ...base, legend, ply: i, fen: fenOf(before), move: moveToUci(m), pieces: after.board.occupied.size() });
    };

    // Forks and double attacks: one piece hits two valuable targets.
    if (even && i < 120) {
      const hits: Role[] = [];
      for (const t of attacks(piece, m.to, after.board.occupied).intersect(after.board[them])) {
        const r = after.board.get(t)!.role;
        const undefended = attackersOf(after, t, them).length === 0;
        if (r === 'king' || VALUE[r] > VALUE[piece.role] || (undefended && r !== 'pawn')) hits.push(r);
      }
      if (piece.role === 'knight') {
        if (hits.filter((r) => r === 'king' || r === 'queen' || r === 'rook').length >= 2 && gain(4) >= 2) add('fork');
      } else if (hits.length >= 2 && gain(4) >= 2) add('doubleattack');
    }

    const slider = piece.role === 'bishop' || piece.role === 'rook' || piece.role === 'queen';
    // Pin: the slider sees the king through exactly one enemy piece, and wins material.
    if (slider && even && i < 120 && enemyKing !== undefined && attacks(piece, m.to, SquareSet.empty()).has(enemyKing)) {
      const mid = between(m.to, enemyKing).intersect(after.board.occupied);
      if (mid.size() === 1) {
        const p = after.board.get(mid.first()!)!;
        if (p.color === them && VALUE[p.role] >= 3 && gain(5) >= 2) add('pin');
      }
    }

    // Skewer: the slider attacks the king or queen, and the piece behind it falls.
    if (slider && even && i < 120) {
      const seen = attacks(piece, m.to, after.board.occupied);
      for (const front of seen.intersect(after.board[them])) {
        const fr = after.board.get(front)!.role;
        if (fr !== 'king' && fr !== 'queen') continue;
        const behind = attacks(piece, m.to, after.board.occupied.without(front)).diff(seen).intersect(after.board[them]);
        for (const b of behind) {
          const br = after.board.get(b)!.role;
          if (VALUE[br] < 3 || VALUE[br] >= VALUE[fr]) continue;
          const later = [i + 2, i + 4].some((k) => k <= last && moves[k].to === b && positions[k].turn === me);
          if (later && gain(5) >= 2) add('skewer');
        }
      }
    }

    // Discovered attacks and double checks: moving one piece unmasks another.
    if (i < 120) {
      let discovered = false;
      for (const s of after.board[me]) {
        if (s === m.to) continue;
        const p = after.board.get(s)!;
        if (p.role !== 'bishop' && p.role !== 'rook' && p.role !== 'queen') continue;
        const newly = attacks(p, s, after.board.occupied).diff(attacks(p, s, before.board.occupied)).intersect(after.board[them]);
        for (const t of newly) {
          const r = after.board.get(t)!.role;
          if (r === 'king' || r === 'queen') discovered = true;
        }
      }
      const checkers = enemyKing !== undefined ? attackersOf(after, enemyKing, me).length : 0;
      if (checkers >= 2 && won && (gain(6) >= 2 || (endsInMate && mater === me && last - i <= 6))) add('doublecheck');
      else if (discovered && even && gain(4) >= 2) add('discovered');
    }

    if (i === last && endsInMate) {
      // Smothered mate: a knight mates a king boxed in by its own pieces.
      if (piece.role === 'knight' && enemyKing !== undefined && [...kingAttacks(enemyKing)].every((sq) => after.board[them].has(sq))) add('smothered');
      // Back-rank mate: a rook or queen mates a king on its first rank.
      if ((piece.role === 'rook' || piece.role === 'queen') && enemyKing !== undefined && relRank(enemyKing, them) === 0 && relRank(m.to, them) === 0) add('backrank');
    }

    // Mate in 2 and in 3: the moves that started the final mating attack.
    if (endsInMate && mater === me) {
      if (i === last - 2) add('mate2');
      if (i === last - 4) add('mate3');
    }

    // The Greek gift: Bxh7+ (Bxh2+) against the castled king.
    const h7 = me === 'white' ? 55 : 15;
    const g8 = me === 'white' ? 62 : 6;
    if (piece.role === 'bishop' && m.to === h7 && captured?.role === 'pawn' && after.isCheck() && enemyKing === g8 && won && i < 80) add('greekgift');

    // Queen sacrifice: the queen is taken next move and mate follows soon.
    if (piece.role === 'queen' && i + 1 <= last && moves[i + 1].to === m.to && attackersOf(after, m.to, them).length > 0 && won && endsInMate && mater === me && last - i <= 10) add('queensac');

    // Combination: not just taking a loose piece, yet material is won a few moves later.
    const loose = !!captured && attackersOf(before, m.to, them).length === 0;
    if (even && !loose && gain(1) <= 1 && gain(6) >= 3 && i < 120 && found.size === 0) add('combination');

    // Passed pawn: pushing to the 7th rank or promoting decides the game.
    if (piece.role === 'pawn' && (m.promotion || relRank(m.to, me) === 6) && Math.abs(bal0) <= 2 && won) add('passedpawn');

    // Outpost: a knight on the 5th/6th rank, backed by a pawn, that no enemy pawn can ever chase away.
    if (piece.role === 'knight' && !captured && even && i >= 16 && i < 80 && (relRank(m.to, me) === 4 || relRank(m.to, me) === 5)) {
      const backed = attackersOf(after, m.to, me).some((s) => after.board.get(s)!.role === 'pawn');
      const f = squareFile(m.to);
      let chasable = false;
      for (const s of after.board.pieces(them, 'pawn')) {
        if (Math.abs(squareFile(s) - f) !== 1) continue;
        if (relRank(s, me) > relRank(m.to, me)) chasable = true;
      }
      if (backed && !chasable) add('outpost');
    }

    // Rook on the 7th rank, where enemy pawns or the king live.
    if (piece.role === 'rook' && even && i >= 20 && relRank(m.to, me) === 6) {
      const pawns7 = [...after.board.pieces(them, 'pawn')].filter((s) => relRank(s, me) === 6).length;
      const king8 = enemyKing !== undefined && relRank(enemyKing, me) === 7;
      if (pawns7 >= 2 || (pawns7 >= 1 && king8)) add('seventh');
    }

    // Open file: a rook moves onto a file with no pawns at all.
    if (piece.role === 'rook' && even && i >= 16 && i < 90 && squareFile(m.from) !== squareFile(m.to) && relRank(m.to, me) <= 1) {
      const f = squareFile(m.to);
      const pawnsOnFile = [...after.board.pieces('white', 'pawn'), ...after.board.pieces('black', 'pawn')].some((s) => squareFile(s) === f);
      if (!pawnsOnFile) add('openfile');
    }
  }
}
db.close();
const counts = out.reduce<Record<string, number>>((c, x) => ((c[x.motif] = (c[x.motif] ?? 0) + 1), c), {});
console.log('moments:', counts);
writeFileSync(outPath, JSON.stringify(out));
