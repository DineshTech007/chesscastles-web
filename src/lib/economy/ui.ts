import { writable } from 'svelte/store';

/** The daily reward's window (DailyChest.svelte, mounted once in +layout.svelte). */
export const dailyOpen = writable(false);

/** Opens the daily reward by itself once a day, on a page that is not a game (a choice kept in this browser). */
const SHOWN = 'cc.dailyShown';
export function dailyShownToday(day: string): boolean {
  try {
    return localStorage.getItem(SHOWN) === day;
  } catch {
    return true;
  }
}
export function markDailyShown(day: string) {
  try {
    localStorage.setItem(SHOWN, day);
  } catch {
    /* blocked */
  }
}

/** Indian digit grouping (1,00,000), as players in India read numbers. */
export const fmt = new Intl.NumberFormat('en-IN');
