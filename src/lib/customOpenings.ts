import { OPENINGS, type Opening } from './openings';
import { playSans } from './chess/position';

const KEY = 'k24.customOpenings';

/** The player's own lines (typed moves), kept in the browser. */
export function customOpenings(): Opening[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** The catalogue and the player's own lines, by id. */
export function findOpening(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id) ?? customOpenings().find((o) => o.id === id);
}

/**
 * Checks and saves a line typed as moves ("1.e4 e5 2.Nf3" or "e4 e5 Nf3").
 * Returns the new opening, or an error message.
 */
export function addCustomOpening(movesText: string, side: 'white' | 'black', name?: string): Opening | string {
  const sans = movesText
    .trim()
    .split(/\s+/)
    .map((s) => s.replace(/^\d+\.+/, ''))
    .filter(Boolean);
  if (!sans.length) return 'Type the moves, like: e4 e5 Nf3';
  try {
    playSans(sans.join(' '));
  } catch (e) {
    return e instanceof Error ? e.message : 'Those moves are not legal.';
  }
  const opening: Opening = {
    id: `custom-${Date.now().toString(36)}`,
    name: name?.trim() || `My line: ${sans.slice(0, 6).join(' ')}${sans.length > 6 ? '…' : ''}`,
    sans: sans.join(' '),
    blurb: 'Your own line.',
    side,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([...customOpenings(), opening]));
  } catch {
    return 'This browser would not save it (storage is full or blocked).';
  }
  return opening;
}

export function removeCustomOpening(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(customOpenings().filter((o) => o.id !== id)));
  } catch {
    /* ignore */
  }
}
