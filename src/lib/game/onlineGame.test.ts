import { describe, expect, it } from 'vitest';
import { uciToMove } from '$lib/chess/position';
import { OnlineGame } from './onlineGame';

const full = (moves = '', extra: object = {}) => ({
  type: 'gameFull',
  id: 'abcd1234',
  rated: true,
  speed: 'rapid',
  clock: { initial: 600000, increment: 0 },
  white: { id: 'me', name: 'Me', rating: 1810 },
  black: { id: 'them', name: 'Them', rating: 1795, title: 'FM' },
  initialFen: 'startpos',
  state: { type: 'gameState', moves, wtime: 600000, btime: 600000, winc: 0, binc: 0, status: 'started', ...extra },
});

describe('OnlineGame', () => {
  it('rebuilds the game from Lichess messages', () => {
    const g = new OnlineGame('white');
    expect(g.apply(full('e2e4 e7e5'))).toBe(true);
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'e5']);
    expect(g.opponent).toMatchObject({ name: 'Them', title: 'FM', rating: 1795 });
    expect(g.myTurn).toBe(true);
    // The same moves again change nothing.
    expect(g.apply({ type: 'gameState', moves: 'e2e4 e7e5', wtime: 590000, btime: 600000, status: 'started' })).toBe(false);
    expect(g.wtime).toBe(590000);
  });

  it('shows the player\'s move at once and takes it back if refused', () => {
    const g = new OnlineGame('white');
    g.apply(full('e2e4 e7e5'));
    expect(g.playLocal(uciToMove('g1f3')!, 'g1f3')).toBe(true);
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(g.myTurn).toBe(false);
    g.undoLocal();
    expect(g.plies).toHaveLength(2);
    // Confirmed by the server: pending clears.
    g.playLocal(uciToMove('g1f3')!, 'g1f3');
    g.apply({ type: 'gameState', moves: 'e2e4 e7e5 g1f3', wtime: 590000, btime: 600000, status: 'started' });
    expect(g.pending).toBeUndefined();
    expect(g.plies).toHaveLength(3);
  });

  it('offers Abort only until the player has moved', () => {
    const w = new OnlineGame('white');
    w.apply(full(''));
    expect([w.canAbort, w.movedYet]).toEqual([true, false]);
    w.apply({ type: 'gameState', moves: 'e2e4', wtime: 600000, btime: 600000, status: 'started' });
    // White has moved: Resign and Offer draw now (Lichess still lets the game be aborted until Black moves).
    expect([w.canAbort, w.movedYet]).toEqual([true, true]);
    const b = new OnlineGame('black');
    b.apply(full('e2e4'));
    expect(b.movedYet).toBe(false);
    b.apply({ type: 'gameState', moves: 'e2e4 e7e5', wtime: 600000, btime: 600000, status: 'started' });
    expect([b.canAbort, b.movedYet]).toEqual([false, true]);
  });

  it('runs the clock of the side to move', () => {
    const g = new OnlineGame('white');
    g.apply(full('e2e4 e7e5'), 1000);
    expect(g.remaining('white', 6000)).toBe(595000);
    expect(g.remaining('black', 6000)).toBe(600000);
  });

  it('knows how the game ended', () => {
    const g = new OnlineGame('white');
    g.apply(full('f2f3 e7e5 g2g4 d8h4', { status: 'mate', winner: 'black' }));
    expect(g.isOver).toBe(true);
    expect(g.result).toBe('0-1');
    expect(g.endReason).toBe('Checkmate');
    const r = new OnlineGame('black');
    r.apply(full('e2e4', { status: 'resign', winner: 'black' }));
    expect(r.endReason).toBe('White resigned');
  });

  it('names Lichess\'s computer', () => {
    const g = new OnlineGame('white');
    g.apply({ ...full(''), black: { aiLevel: 5 } });
    expect(g.opponent).toMatchObject({ name: 'Stockfish level 5', ai: 5 });
  });

  it('keeps each move’s clock as it arrives, for its time beside the moves', () => {
    const g = new OnlineGame('white');
    g.apply(full(''));
    g.apply({ type: 'gameState', moves: 'e2e4', wtime: 600000, btime: 600000, status: 'started' });
    g.apply({ type: 'gameState', moves: 'e2e4 e7e5', wtime: 600000, btime: 600000, status: 'started' });
    g.apply({ type: 'gameState', moves: 'e2e4 e7e5 g1f3', wtime: 595000, btime: 600000, status: 'started' });
    g.apply({ type: 'gameState', moves: 'e2e4 e7e5 g1f3 b8c6', wtime: 595000, btime: 588000, status: 'started' });
    expect(g.clocks).toEqual([600000, 600000, 595000, 588000]);
    // The first two moves: no clock running yet.
    expect(g.times).toEqual([0, 0, 5000, 12000]);
  });
});
