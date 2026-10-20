import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { poll } from './poll';

/** A stand-in for the page: its visibility, and the visibilitychange event. */
const page = Object.assign(new EventTarget(), { visibilityState: 'visible' as 'visible' | 'hidden' });
const show = (v: 'visible' | 'hidden') => {
  page.visibilityState = v;
  page.dispatchEvent(new Event('visibilitychange'));
};
/** Lets the poller's awaited call finish. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('poll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('document', page);
    page.visibilityState = 'visible';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks at its pace, slower after failures (5 s, 15 s, 60 s), and back to its pace after an answer', async () => {
    const answers = [true, false, false, false, false, true, true];
    const fn = vi.fn(async () => answers.shift());
    const stop = poll(fn, 2000);
    await settle();
    expect(fn).toHaveBeenCalledTimes(1); // at once: ok
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(2); // failure 1
    await vi.advanceTimersByTimeAsync(4999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3); // after 5 s: failure 2
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fn).toHaveBeenCalledTimes(4); // after 15 s: failure 3
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(5); // after 60 s: failure 4
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(6); // still 60 s: ok now
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(7); // its pace again
    stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fn).toHaveBeenCalledTimes(7);
  });

  it('counts a thrown error as a failure, and never asks faster than its own pace', async () => {
    const fn = vi.fn(async () => {
      throw new Error('offline');
    });
    poll(fn, 120_000);
    await settle();
    await vi.advanceTimersByTimeAsync(119_999);
    expect(fn).toHaveBeenCalledTimes(1); // not after 5 s: a two-minute poller stays at two minutes
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('waits while the tab is hidden and asks at once when it is back', async () => {
    const fn = vi.fn(async () => true);
    poll(fn, 2000);
    await settle();
    show('hidden');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
    show('visible');
    await settle();
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
