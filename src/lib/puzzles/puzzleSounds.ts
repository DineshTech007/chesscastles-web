import { get } from 'svelte/store';
import { soundOn } from '$lib/sound';

/**
 * Puzzle sounds, made in the browser (nothing to download): a bright chime when a puzzle is solved, a ding for
 * each star, a soft low tone after a miss, ticks in the last seconds of the timer, a sparkle for a new badge and a
 * bigger fanfare for a new level.
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
  /** A new level: a bigger fanfare, rising to a held chord with a sparkle on top. */
  levelUp() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.02;
    [[392, 0], [523.25, 0.1], [659.25, 0.2], [783.99, 0.3], [1046.5, 0.42]].forEach(([f, d]) => note(f, t + d, 0.35, 0.15, 'triangle'));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, t + 0.6, 1.2, 0.09, 'sine'));
    [2093, 2637, 3136].forEach((f, i) => note(f, t + 0.7 + i * 0.08, 0.3, 0.05, 'sine'));
  },
  /** A new badge: a quick sparkle. */
  badge() {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.02;
    [1568, 2093, 2637, 3136].forEach((f, i) => note(f, t + i * 0.07, 0.35, 0.08, 'sine'));
    note(1046.5, t, 0.6, 0.1, 'triangle');
  },
  /** A firework's burst: a short, soft crackle (a little different each time). */
  pop() {
    const c = audio();
    if (!c) return;
    const len = Math.floor(c.sampleRate * 0.35);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500 + Math.random() * 900;
    const g = c.createGain();
    g.gain.value = 0.25;
    src.connect(f).connect(g).connect(c.destination);
    src.start(c.currentTime + 0.01);
  },
  /** A puzzle's end: the solved chime and a ding for each star, or the soft miss. */
  result(solved: boolean, stars: number) {
    if (!solved) return this.missed();
    this.solved();
    for (let i = 1; i <= stars; i++) setTimeout(() => this.star(i), 450 + i * 230);
  },
};
