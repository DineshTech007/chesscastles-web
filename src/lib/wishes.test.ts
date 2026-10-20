import { describe, expect, it } from 'vitest';
import { toParagraphs } from './wishes';

describe('toParagraphs', () => {
  it('keeps paragraphs written with empty lines, and runs their lines on', () => {
    expect(toParagraphs('First thought,\nstill the first.\n\n\nSecond one.')).toEqual(['First thought, still the first.', 'Second one.']);
  });

  it('takes a message without empty lines line by line (WhatsApp)', () => {
    expect(toParagraphs('Congratulations on the launch! 🙏\nMy students love the puzzles.\nBest wishes')).toEqual([
      'Congratulations on the launch! 🙏',
      'My students love the puzzles.',
      'Best wishes',
    ]);
  });

  it('joins an email’s wrapped lines that stop mid-sentence', () => {
    expect(toParagraphs('I played a few games against the FIDE\nopponents and they feel like real\nplayers.\nWell done.')).toEqual([
      'I played a few games against the FIDE opponents and they feel like real players.',
      'Well done.',
    ]);
  });

  it('tidies spaces without changing a word', () => {
    expect(toParagraphs('  Great   work ,  team .\r\n\r\nKeep going\t!  ')).toEqual(['Great work, team.', 'Keep going!']);
  });

  it('splits a very long paragraph after full sentences, never inside one', () => {
    const sentence = 'Chess Castles helps young players study every day with real games and clear lessons. ';
    const parts = toParagraphs(sentence.repeat(12));
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.endsWith('lessons.')).toBe(true);
    expect(parts.join(' ')).toBe(sentence.repeat(12).trim());
  });

  it('gives nothing for empty text', () => {
    expect(toParagraphs(' \n \n ')).toEqual([]);
  });
});
