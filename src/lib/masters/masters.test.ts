import { describe, expect, it } from 'vitest';
import { positionFromFen, uciToMove } from '$lib/chess/position';
import { LEGENDS } from '$lib/coach/content/legends';
import { CATS, GOALS, KIND_TIP, playerName, SAY, shortName, TEACHERS } from './content';
import { endgameNotes } from './notes';
import { masterOf, masterOpening } from './repertoire';

const notesOf = (fen: string, uci: string) => endgameNotes(positionFromFen(fen), uciToMove(uci)!).map((n) => n.k);

describe('endgame notes', () => {
  it('sees the opposition in a pawn endgame', () => {
    expect(notesOf('8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', 'e3e4')).toContain('opposition');
  });
  it('puts the rook behind the passed pawn', () => {
    expect(notesOf('6k1/8/8/P7/8/8/6K1/7R w - - 0 1', 'h1a1')).toContain('rookBehind');
  });
  it('pushes a passed pawn', () => {
    expect(notesOf('6k1/8/8/P7/8/8/6K1/R7 w - - 0 1', 'a5a6')).toContain('pushPasser');
  });
  it('creates a passed pawn by a capture', () => {
    // b5xa6: White's pawn on a6 has no black pawn ahead of it.
    expect(notesOf('6k1/8/p7/1P6/8/8/6K1/8 w - - 0 1', 'b5a6')).toEqual(expect.arrayContaining(['winsPawn', 'newPasser']));
  });
  it('trades rooks and says why when ahead', () => {
    expect(notesOf('3rk3/5ppp/8/8/8/8/P4PPP/3R2K1 w - - 0 1', 'd1d8')).toEqual(['trade', 'tradeAhead']);
  });
  it('walks the king to the centre', () => {
    expect(notesOf('8/5k2/8/8/8/6P1/5P1P/7K w - - 0 1', 'h1g2')).toEqual(['kingCentre']);
  });
  it('blocks a passed pawn', () => {
    expect(notesOf('6k1/8/8/8/p7/8/2N3K1/8 w - - 0 1', 'c2a3')).toContain('blockade');
  });
  it('says nothing it cannot check', () => {
    expect(notesOf('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'g2g3')).toEqual([]);
  });
});

describe('masters content', () => {
  it('has a name and bio for every teacher, in every language', () => {
    for (const t of TEACHERS) {
      const l = LEGENDS[t.id];
      expect(l?.name, t.id).toBeTruthy();
      expect(l.bio.hi && l.bio.mr && l.bio.en, t.id).toBeTruthy();
    }
  });
  it('translates every line', () => {
    const all = [...CATS.map((c) => c.tip), ...Object.values(KIND_TIP), ...Object.values(GOALS).map((g) => g.text), ...Object.values(SAY)];
    for (const t of all) expect(t.en && t.hi && t.mr).toBeTruthy();
  });
  it('writes player names the way people know them', () => {
    expect(playerName('Carlsen, Magnus')).toBe('Magnus Carlsen');
    expect(playerName('Nakamura, Hi')).toBe('Nakamura');
    expect(playerName('Giri, A.')).toBe('Giri');
    expect(playerName('Smyslov')).toBe('Smyslov');
    expect(shortName('Gukesh D')).toBe('Gukesh');
    expect(shortName('Magnus Carlsen')).toBe('Carlsen');
    expect(shortName('Praggnanandhaa R')).toBe('Pragg');
  });
  it('reads a master repertoire id', () => {
    expect(masterOf('m-carlsen-black')).toEqual({ teacher: 'carlsen', side: 'black' });
    expect(masterOf('m-nobody-white')).toBeUndefined();
    expect(masterOpening('m-gukesh-white')?.name).toBe("Gukesh D's openings with White");
  });
});
