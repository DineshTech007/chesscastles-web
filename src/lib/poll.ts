/**
 * Asks the server again and again while a page is open (messages, friends playing, live games), gently:
 * - only while the tab is in front (hidden, it waits; back in front, it asks at once if a turn was missed);
 * - after a failure it waits longer each time (5 s, 15 s, then 60 s, never less than its usual pace), and goes
 *   back to the usual pace as soon as one answer comes, so a short outage is not hammered by every open tab.
 * `fn` fails by throwing or by returning false. Returns a stop function.
 */
export const BACKOFF = [5_000, 15_000, 60_000];

export function poll(fn: () => Promise<unknown>, every: number, { now = true }: { now?: boolean } = {}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let due = false;
  let running = false;
  let stopped = false;

  const delay = () => (failures ? Math.max(every, BACKOFF[Math.min(failures, BACKOFF.length) - 1]) : every);
  const schedule = () => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(turn, delay());
  };
  async function turn() {
    if (stopped || running) return;
    // Hidden: skip this turn and ask when the tab is back in front.
    if (document.visibilityState !== 'visible') return void (due = true);
    due = false;
    running = true;
    try {
      failures = (await fn()) === false ? failures + 1 : 0;
    } catch {
      failures++;
    }
    running = false;
    schedule();
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible' && due) void turn();
  };
  document.addEventListener('visibilitychange', onVisible);
  if (now) void turn();
  else schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
