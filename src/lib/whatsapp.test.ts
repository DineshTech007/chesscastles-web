import { describe, expect, it } from 'vitest';
import { normalizePhone } from './social';
import { waLink, waMessage } from './whatsapp';

describe('normalizePhone', () => {
  it('reads Indian numbers as people type them', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('098765-43210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('0091 9876543210')).toBe('+919876543210');
  });
  it('keeps other countries’ numbers with their code', () => {
    expect(normalizePhone('+1 (415) 555-0123')).toBe('+14155550123');
  });
  it('refuses what cannot be a number', () => {
    expect(normalizePhone('98765')).toBeUndefined();
    expect(normalizePhone('+91 98765 432101')).toBeUndefined();
    expect(normalizePhone('hello')).toBeUndefined();
  });
});

describe('waMessage', () => {
  const report = { site: 'lichess' as const, user: 'kid21', games: 20, score: 55, accuracy: 81, blunders: 1.4, weak: [{ title: 'Missed forks', evidence: '6 times in 20 games' }], strong: 'Good openings with White' };
  it('tells the player where they lose points, with the link to their report', () => {
    const m = waMessage({ name: 'Aarav Patil', username: 'kid21', whose: 'self', report });
    expect(m).toContain('Namaste Aarav!');
    expect(m).toContain('score 55%, accuracy 81%');
    expect(m).toContain('Where you lose the most points: *Missed forks* (6 times in 20 games).');
    expect(m).toContain('https://chesscastles.com/insights?site=lichess&user=kid21');
    expect(m).toContain('Reply STOP');
  });
  it('speaks to a parent about their child', () => {
    const m = waMessage({ name: 'Aarav', username: 'kid21', whose: 'parent', report });
    expect(m).toContain("Aarav's chess update");
    expect(m).toContain('Where Aarav loses the most points');
  });
  it('invites a player with no report yet to Guru', () => {
    const m = waMessage({ name: 'Riya', username: 'riya', whose: 'self' });
    expect(m).toContain('Guru, the free chess coach');
    expect(m).toContain('https://chesscastles.com/insights');
  });
  it('opens WhatsApp with the message for that number', () => {
    expect(waLink('+919876543210', 'Hi & bye')).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye');
  });
});
