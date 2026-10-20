import { describe, expect, it } from 'vitest';
import { ageGroupOf, BROADCAST_MATCH, broadcastMatchScore } from './lichess';

describe('matching a tournament to its Lichess broadcast', () => {
  it('reads the age group in its many spellings', () => {
    expect(ageGroupOf('National Under 15')).toBe(15);
    expect(ageGroupOf('51st Indian Sub-Junior (Under15) Open Chess Championships 2026 | Open')).toBe(15);
    expect(ageGroupOf('Bihar State Sub-Junior FIDE Rating Chess Championship - 2026 | U-15 Open')).toBe(15);
    expect(ageGroupOf('Girls U11 Open')).toBe(11);
    expect(ageGroupOf('Khelo Chess India 94.0 Classical')).toBeUndefined();
  });

  it("pairs the federation's name with Lichess's name for the same event", () => {
    // Found on 20 Oct 2026: the events page said "National Under 15", Lichess broadcast it as the Sub-Junior.
    expect(broadcastMatchScore('National Under 15', '51st Indian Sub-Junior (Under15) Open Chess Championships 2026 | Open', 'Hyderabad')).toBeGreaterThanOrEqual(BROADCAST_MATCH);
    expect(broadcastMatchScore('KHELO CHESS INDIA 94.0 CLASSICAL FIDE RATING TOURNAMENT 2026', 'Khelo Chess India 94.0 Classical Fide Rating 2026')).toBeGreaterThanOrEqual(BROADCAST_MATCH);
  });

  it('does not pair different events', () => {
    expect(broadcastMatchScore('1st Manchester City International open fide Rated Tournament', 'Bihar State Sub-Junior FIDE Rating Chess Championship - 2026 | U-15 Open', 'Coimbatore')).toBeLessThan(BROADCAST_MATCH);
    // The same kind of event for another age group is a different event.
    expect(broadcastMatchScore('National Under 15', 'National Under 11 Open 2026')).toBe(0);
    expect(broadcastMatchScore('Bangladesh National Chess Championship 2026', '51st Indian Sub-Junior (Under15) Open Chess Championships 2026')).toBeLessThan(BROADCAST_MATCH);
  });
});
