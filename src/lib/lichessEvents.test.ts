import { describe, expect, it } from 'vitest';
import { ongoingHref, readChallenge, readOngoing } from './lichessEvents';

const base = {
  id: 'AbC123xy',
  status: 'created',
  challenger: { id: 'shreyaskudale', name: 'SHreYaskUdAle', rating: 1650, title: null },
  destUser: { id: 'chesscastlestester', name: 'chesscastlestester', rating: 1500 },
  rated: false,
  speed: 'rapid',
  timeControl: { type: 'clock', limit: 600, increment: 0, show: '10+0' },
  color: 'random',
  finalColor: 'white',
};

describe('incoming challenges', () => {
  it('reads a challenge sent to me: name, rating, time control, my colour', () => {
    const c = readChallenge(base, 'chesscastlestester');
    expect(c).toMatchObject({ id: 'AbC123xy', from: 'SHreYaskUdAle', fromRating: 1650, minutes: 10, increment: 0, rated: false, myColor: 'black' });
  });
  it('ignores challenges I sent, ones for someone else, and ones no longer open', () => {
    expect(readChallenge(base, 'shreyaskudale')).toBeUndefined();
    expect(readChallenge(base, 'someoneelse')).toBeUndefined();
    expect(readChallenge({ ...base, status: 'canceled' }, 'chesscastlestester')).toBeUndefined();
    expect(readChallenge(base, undefined)).toBeUndefined();
  });
  it('leaves the colour open when the challenger asked for a random one and Lichess has not decided', () => {
    expect(readChallenge({ ...base, finalColor: undefined }, 'chesscastlestester')?.myColor).toBeUndefined();
    expect(readChallenge({ ...base, finalColor: undefined, color: 'black' }, 'chesscastlestester')?.myColor).toBe('white');
  });
});

describe('a game in progress (the bar back to it)', () => {
  const start = { gameId: 'GaMe1234', color: 'black', opponent: { username: 'Riya', rating: 1200 }, speed: 'blitz', compat: { bot: false, board: true } };
  it('opens on its Chess Castles board, with the colour', () => {
    const g = readOngoing(start)!;
    expect(g).toEqual({ id: 'GaMe1234', color: 'black', opponent: 'Riya', board: true });
    expect(ongoingHref(g)).toBe('/play/online/GaMe1234?c=black');
  });
  it('bullet (not playable through Lichess’s Board API) opens on lichess.org; Lichess’s computer is named by level', () => {
    expect(ongoingHref(readOngoing({ ...start, speed: 'bullet', compat: { board: false } })!)).toBe('https://lichess.org/GaMe1234');
    expect(readOngoing({ ...start, opponent: { ai: 3 } })!.opponent).toBe('Lichess level 3');
  });
  it('leaves out correspondence games (no clock to lose)', () => {
    expect(readOngoing({ ...start, speed: 'correspondence' })).toBeUndefined();
  });
});
