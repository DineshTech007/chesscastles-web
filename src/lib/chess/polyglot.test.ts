import { Chess } from 'chessops/chess';
import { parseUci } from 'chessops/util';
import { describe, expect, it } from 'vitest';
import { polyglotKey } from './polyglot';

/** Test positions from the Polyglot book format specification. */
const VECTORS: [string, bigint][] = [
  ['', 0x463b96181691fc9cn],
  ['e2e4', 0x823c9b50fd114196n],
  ['e2e4 d7d5', 0x0756b94461c50fb0n],
  ['e2e4 d7d5 e4e5', 0x662fafb965db29d4n],
  ['e2e4 d7d5 e4e5 f7f5', 0x22a48b5a8e47ff78n],
  ['e2e4 d7d5 e4e5 f7f5 e1e2', 0x652a607ca3f242c1n],
  ['e2e4 d7d5 e4e5 f7f5 e1e2 e8f7', 0x00fdd303c946bdd9n],
  ['a2a4 b7b5 h2h4 b5b4 c2c4', 0x3c8123ea7b067637n],
  ['a2a4 b7b5 h2h4 b5b4 c2c4 b4c3 a1a3', 0x5c3f9b829b279560n],
];

describe('polyglotKey', () => {
  for (const [line, key] of VECTORS) {
    it(`matches the spec after "${line || 'start'}"`, () => {
      const pos = Chess.default();
      for (const uci of line.split(' ').filter(Boolean)) {
        const m = parseUci(uci)!;
        expect(pos.isLegal(m)).toBe(true);
        pos.play(m);
      }
      expect(polyglotKey(pos)).toBe(key);
    });
  }
});
