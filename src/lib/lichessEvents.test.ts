import { describe, expect, it } from 'vitest';
import { readChallenge } from './lichessEvents';

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
