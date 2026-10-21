/**
 * Homework solved at home: the same question board as in class (TaskSolver), each move checked by the class's room
 * through the API (no live connection needed). The answers come only after the due date.
 */
import { getHomework, homeworkClaim, homeworkTry, type HomeworkReply, type Progress, type Row, type Task } from './api';
import type { Tried } from './live.svelte';
import type { SolverHost } from './solver';
import { sounds } from '$lib/sound';

export class HomeworkSession implements SolverHost {
  task = $state<Task | undefined>();
  progress = $state<Record<string, Progress>>({});
  now = $state(Date.now());
  tried = $state<Tried | undefined>();
  hint = undefined;
  lb = $state<Row[]>([]);
  settings = { lb: true };
  me: { uid: string };
  notice = $state('');
  due = $state(0);
  error = $state('');
  readonly homework = true;
  private offset = 0;
  private tick: ReturnType<typeof setInterval>;

  constructor(
    private classId: string,
    private hid: string,
    uid: string,
  ) {
    this.me = { uid };
    this.tick = setInterval(() => (this.now = Date.now() + this.offset), 500);
    void this.load();
  }

  get mine(): Progress | undefined {
    return this.progress[this.me.uid];
  }

  async load() {
    try {
      const v = await getHomework(this.classId, this.hid);
      this.offset = v.now - Date.now();
      this.task = v.task;
      this.progress = v.progress;
      this.lb = v.ranking;
      this.due = v.due;
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  private apply(r: HomeworkReply) {
    if (r.p) this.progress = { ...this.progress, [r.p.uid]: r.p };
    if (r.ranking) this.lb = r.ranking;
    if (r.ignored || !this.task) return;
    this.tried = { task: this.task.id, ok: r.ok, reply: r.reply, ended: r.ended, again: r.again, p: r.p, at: Date.now() };
  }
  private fail(e: unknown) {
    const msg = (e as Error).message;
    this.notice = msg;
    sounds.error();
    // The due date passed: the answers can be shown now.
    void this.load();
  }

  tryMove(item: number, uci: string, cpu = false) {
    homeworkTry(this.classId, this.hid, { item, uci, cpu }).then(
      (r) => this.apply(r),
      (e) => this.fail(e),
    );
  }
  claim(item: number, result: 'win' | 'draw' | 'resign') {
    homeworkClaim(this.classId, this.hid, { item, result }).then(
      (r) => this.apply(r),
      (e) => this.fail(e),
    );
  }

  close() {
    clearInterval(this.tick);
  }
}
