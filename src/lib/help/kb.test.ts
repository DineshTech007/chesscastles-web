import { describe, expect, it } from 'vitest';
import { findAnswers } from './kb';

const first = (q: string) => findAnswers(q)[0]?.id;

describe('the help bot', () => {
  it('finds the right answer for everyday questions', () => {
    expect(first('how do i change my profile picture')).toBe('photo');
    expect(first('what is kfide rating')).toBe('kfide');
    expect(first('my internet went off in the middle of a game')).toBe('resume');
    expect(first('how to import pgn from chess.com')).toBe('import');
    expect(first('clear board')).toBe('setup');
    expect(first('why cant I play bullet 1+0')).toBe('bullet');
    expect(first('someone is cheating')).toBe('report');
    expect(first('how to watch my friend play')).toBe('watch-friend');
    expect(first('delete my account')).toBe('delete');
  });
  it('says nothing rather than guessing', () => {
    expect(findAnswers('qwerty zzz')).toEqual([]);
    expect(findAnswers('')).toEqual([]);
  });
  it('answers parents, in English, Hindi and Marathi', () => {
    expect(findAnswers('Is it safe for my child?')[0]?.id).toBe('safe');
    expect(findAnswers('माझ्या मुलगी साठी सुरक्षित आहे का?')[0]?.id).toBe('safe');
    expect(findAnswers('पैसे वापस कैसे मिलेंगे')[0]?.id).toBe('refund');
    expect(findAnswers('how do I get a refund')[0]?.id).toBe('refund');
  });
});
