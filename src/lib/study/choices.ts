/**
 * The student's own repertoire in a study opening: at positions where they
 * have more than one main move, the move they chose (position key -> UCI).
 * One set per opening, used by the trainer in every chapter and line, and
 * kept in this browser.
 */
const KEY = (opening: string) => `k24.studyChoices.${opening}`;

export function loadChoices(opening: string): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(opening)) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function saveChoice(opening: string, key: string, uci: string): Record<string, string> {
  const all = { ...loadChoices(opening), [key]: uci };
  try {
    localStorage.setItem(KEY(opening), JSON.stringify(all));
  } catch {
    /* private mode: for this visit only */
  }
  return all;
}

/** Replaces the whole set (undo, reset). */
export function setChoices(opening: string, all: Record<string, string>): void {
  try {
    localStorage.setItem(KEY(opening), JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

/** Moves worth offering at the student's turns in a study opening: 3%+ of the games and 15+ games. */
export const STUDY_ALT_SHARE = 0.03;
export const STUDY_ALT_GAMES = 15;
