import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import type { Role } from 'chessops/types';
import { sanOf } from '$lib/chess/position';
import { decodeMoves, mainlineBytes, shakmatyOrder } from './caissa';

const VALUE: Partial<Record<Role, number>> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 };
const material = (pos: Chess, color: 'white' | 'black') =>
  (['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[]).reduce((s, r) => s + pos.board.pieces(color, r).size() * VALUE[r]!, 0);

describe('shakmaty move order', () => {
  it('orders the starting moves as shakmaty does', () => {
    const order = shakmatyOrder(Chess.default()).map((m) => sanOf(Chess.default(), m));
    // Single pushes a3..h3, double pushes a4..h4, then the knights.
    expect(order.slice(0, 3)).toEqual(['a3', 'b3', 'c3']);
    expect(order[11]).toBe('d4');
    expect(order[12]).toBe('e4');
    expect(order.slice(16)).toEqual(['Na3', 'Nc3', 'Nf3', 'Nh3']);
  });

  it('skips variations and comments', () => {
    expect([...mainlineBytes(new Uint8Array([11, 255, 12, 254, 253, 2, 0, 65, 66, 18]))]).toEqual([11, 18]);
  });

  it('decodes a short game', () => {
    // Bytes from the export: 1.d4 Nf6 (game 1 starts 0B 12).
    const { moves } = decodeMoves(btoa(String.fromCharCode(11, 18)));
    const pos = Chess.default();
    const sans = moves.map((m) => {
      const s = sanOf(pos, m);
      pos.play(m);
      return s;
    });
    expect(sans).toEqual(['d4', 'Nf6']);
  });
});

// Checks against the real database when it is on this PC: every game must end
// with the minimum material stored with it (checked before each promotion).
const DB = 'F:/dev/caissabase_2024.db3';
describe.runIf(existsSync(DB))('the CaissaBase games', () => {
  it('decode exactly (material checksum on 3,000 games)', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(DB, { readOnly: true });
    const rows = db
      .prepare('SELECT ID, FEN, Moves, WhiteMaterial, BlackMaterial FROM Games ORDER BY ID LIMIT 3000')
      .all() as { ID: number; FEN: string | null; Moves: Uint8Array; WhiteMaterial: number; BlackMaterial: number }[];
    let bad = 0;
    for (const r of rows) {
      const b64 = Buffer.from(r.Moves).toString('base64');
      const { start, moves } = decodeMoves(b64, r.FEN ?? undefined);
      const pos = start.clone();
      let minW = material(pos, 'white');
      let minB = material(pos, 'black');
      for (const m of moves) {
        if (m.promotion) {
          minW = Math.min(minW, material(pos, 'white'));
          minB = Math.min(minB, material(pos, 'black'));
        }
        pos.play(m);
      }
      minW = Math.min(minW, material(pos, 'white'));
      minB = Math.min(minB, material(pos, 'black'));
      if (minW !== r.WhiteMaterial || minB !== r.BlackMaterial) bad++;
    }
    db.close();
    expect(bad).toBe(0);
  }, 60_000);
});
