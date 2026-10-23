/**
 * Pages where a child is busy (a game, a puzzle, a cup round, a live class): no welcome, install or other popup may
 * open over them. Castle Cups found it (2026-10-23): the language and reminders popups opened over a cup game's board,
 * the taps landed on the popup, and the game was lost on time. One list for every popup.
 */
export const BUSY_PAGE = /^\/(play|watch|analysis|puzzles|cups|castleclass|classroom)\/./;
export const busyPage = (path: string) => BUSY_PAGE.test(path);
