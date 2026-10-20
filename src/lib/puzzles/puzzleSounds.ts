import { get } from 'svelte/store';
import { soundOn } from '$lib/sound';

/**
 * Puzzle sounds, made in the browser (nothing to download): a bright chime when a puzzle is solved, a ding for
 * each star, a soft low tone after a miss, ticks in the last seconds of the timer and a fanfare for a new badge.
 * They follow the site's sound switch.
 */
let ctx: AudioContext | undefined;
function audio(): AudioContext | undefined {
  if (typeof window === 'undefined' || !get(soundOn)) return undefined;
  try {
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    ctx ??= new AC();
    if (ctx!.state === 'suspended') void ctx!.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

/** One soft bell-like note. */
function note(freq: number, at: number, dur = 0.35, level = 0.18, type: OscillatorType = 'sine') {
  const c = ctx!;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = c.createGain();
  g2.gain.value = 0.25;
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.start(at);
  o2.start(at);
  o.stop(at + dur + 0.05);
  o2.stop(at + dur + 0.05);
}

export const puzzleSounds = {
  /** Solved: a rising major arpeggio. */
  solved() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.02;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, t + i * 0.09, 0.45, 0.16));
  },
  /** One star (n = 1, 2, 3): each a little higher. */
  star(n: number) {
    const c = audio();
    if (!c) return;
    note([1318.5, 1568, 2093][Math.max(0, Math.min(2, n - 1))], c.currentTime + 0.02, 0.5, 0.12, 'triangle');
  },
  /** Missed: two soft falling notes, not harsh. */
  missed() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.02;
    note(392, t, 0.3, 0.12, 'triangle');
    note(311.1, t + 0.18, 0.45, 0.12, 'triangle');
  },
  /** A tick in the last seconds. */
  tick() {
    const c = audio();
    if (!c) return;
    note(1760, c.currentTime + 0.01, 0.06, 0.06, 'square');
  },
  /** A new badge or level: a short fanfare. */
  fanfare() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.02;
    [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36], [783.99, 0.52], [1046.5, 0.64]].forEach(([f, d]) => note(f, t + d, 0.4, 0.14, 'triangle'));
  },
};
