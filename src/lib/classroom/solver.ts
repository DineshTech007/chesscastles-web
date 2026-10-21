/** What the question board (TaskSolver) needs: the live class, or homework solved at home (homework.svelte.ts). */
import type { Progress, Row, Task } from './api';
import type { Tried } from './live.svelte';

export interface SolverHost {
  task: Task | undefined;
  /** My progress on the task. */
  readonly mine: Progress | undefined;
  /** The room's (or server's) time now, ticking. */
  now: number;
  tried: Tried | undefined;
  hint: { task: string; item: number; square: string } | undefined;
  lb: Row[];
  settings: { lb: boolean };
  me: { uid: string };
  notice: string;
  /** Homework at home (no "waiting for the others"). */
  readonly homework?: boolean;
  tryMove(item: number, uci: string, cpu?: boolean): void;
  claim(item: number, result: 'win' | 'draw' | 'resign'): void;
}
