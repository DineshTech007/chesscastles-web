import { writable, get } from 'svelte/store';
import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';

/**
 * Board sounds, made on the fly with Web Audio (no sound files): a wooden
 * "tock" for a move, a heavier double knock for a capture, a bright ping
 * for check, two knocks for castling, and a soft chime when a game ends.
 * A game's start and its result (won, lost, drawn) have their own mallet
 * notes, like a marimba: a rising call to start, a little fanfare for a win,
 * two gentle falling notes for a loss (kind to children, never a "fail" noise).
 * A second, playful "Fun" theme (bright pops and a cartoon boing) is also
 * synthesised, for kids who want something livelier than plain wood.
 */

const KEY = 'k24.sound';
export const soundOn = writable(true);
if (typeof localStorage !== 'undefined') {
  try {
    soundOn.set(localStorage.getItem(KEY) !== 'off');
  } catch {
    /* default on */
  }
}
export function setSound(on: boolean) {
  soundOn.set(on);
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* fine */
  }
}

/**
 * The sound themes: Wood and Fun for everyone, and the Castle Shop's packs (src/lib/economy/core.ts ITEMS, slot
 * 'sound'; owner, 2026-10-23: "implement the sounds"), all made here with Web Audio. A Shop pack is used only while
 * the player owns it (src/lib/economy/wallet.ts puts Wood back otherwise).
 */
export const SOUND_THEMES = ['wood', 'fun', 'sarcade', 'scrystal', 'smarble', 'sroyal', 'sdrums'] as const;
export type SoundTheme = (typeof SOUND_THEMES)[number];
const THEME_KEY = 'k24.soundTheme';
export const soundTheme = writable<SoundTheme>('wood');
if (typeof localStorage !== 'undefined') {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && (SOUND_THEMES as readonly string[]).includes(saved)) soundTheme.set(saved as SoundTheme);
  } catch {
    /* default wood */
  }
}
export function setSoundTheme(t: SoundTheme) {
  soundTheme.set(t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* fine */
  }
}

let ctx: AudioContext | undefined;
function audio(): AudioContext | undefined {
  if (typeof window === 'undefined' || !get(soundOn)) return undefined;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

/** A short knock: filtered noise with a quick decay, plus a low body tone. */
function knock(at: number, { pitch = 900, gain = 0.5, length = 0.07 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const noise = a.createBuffer(1, Math.floor(a.sampleRate * length), a.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  const src = a.createBufferSource();
  src.buffer = noise;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = pitch;
  band.Q.value = 1.4;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + length);
  src.connect(band).connect(g).connect(a.destination);
  src.start(t);
  // The wood's body: a short low sine.
  const osc = a.createOscillator();
  osc.frequency.setValueAtTime(pitch / 5, t);
  osc.frequency.exponentialRampToValueAtTime(pitch / 9, t + length);
  const og = a.createGain();
  og.gain.setValueAtTime(gain * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + length * 1.2);
  osc.connect(og).connect(a.destination);
  osc.start(t);
  osc.stop(t + length * 1.3);
}

function tone(at: number, freq: number, length: number, gain = 0.18, wave: OscillatorType = 'sine') {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  osc.type = wave;
  osc.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/**
 * A mallet note (marimba-like): a round fundamental, a short bright overtone and a faint click, all decaying fast.
 * `wave` 'triangle' gives the brighter "Fun" theme.
 */
function mallet(at: number, freq: number, { gain = 0.3, length = 0.6, wave = 'sine' as OscillatorType } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const parts: [number, number, number][] = [
    [1, gain, length],
    [3.9, gain * 0.32, length * 0.2],
    [9.2, gain * 0.07, length * 0.07],
  ];
  for (const [mult, peak, len] of parts) {
    if (freq * mult > a.sampleRate / 2.2) continue;
    const osc = a.createOscillator();
    osc.type = mult === 1 ? wave : 'sine';
    osc.frequency.value = freq * mult;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }
}

/** A cartoon pitch slide (the "Fun" theme's boing), triangle wave from `from` to `to` Hz. */
function sweep(at: number, from: number, to: number, length: number, gain = 0.22) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

const WOOD = {
  move: () => knock(0, { pitch: 950, gain: 0.45 }),
  capture: () => {
    knock(0, { pitch: 700, gain: 0.6, length: 0.09 });
    knock(0.06, { pitch: 1100, gain: 0.35 });
  },
  castle: () => {
    knock(0, { pitch: 950, gain: 0.4 });
    knock(0.11, { pitch: 850, gain: 0.4 });
  },
  check: () => {
    knock(0, { pitch: 950, gain: 0.45 });
    tone(0.02, 1320, 0.18, 0.12);
  },
  end: () => {
    tone(0, 523, 0.35);
    tone(0.12, 659, 0.35);
    tone(0.24, 784, 0.5);
  },
  error: () => tone(0, 220, 0.15, 0.12),
  start: () => {
    mallet(0, 784, { gain: 0.3, length: 0.35 });
    mallet(0.12, 1175, { gain: 0.32, length: 0.7 });
  },
  lowTime: () => {
    tone(0, 1568, 0.09, 0.14);
    tone(0.16, 1568, 0.09, 0.14);
  },
  tick: () => tone(0, 1250, 0.035, 0.16),
  win: () => {
    mallet(0, 523, { gain: 0.28, length: 0.4 });
    mallet(0.1, 659, { gain: 0.28, length: 0.4 });
    mallet(0.2, 784, { gain: 0.3, length: 0.45 });
    mallet(0.32, 1047, { gain: 0.34, length: 1.1 });
    tone(0.44, 2093, 0.35, 0.05);
    tone(0.52, 2637, 0.4, 0.04);
  },
  loss: () => {
    mallet(0, 494, { gain: 0.26, length: 0.5 });
    mallet(0.22, 392, { gain: 0.24, length: 1 });
  },
  draw: () => {
    mallet(0, 587, { gain: 0.26, length: 0.45 });
    mallet(0.2, 440, { gain: 0.26, length: 0.9 });
  },
};

/** A brighter, bouncier set: a pop for a move, a cartoon boing for a capture. */
const FUN = {
  move: () => {
    tone(0, 880, 0.07, 0.2, 'triangle');
    tone(0.035, 1320, 0.06, 0.12, 'triangle');
  },
  capture: () => sweep(0, 520, 190, 0.16, 0.26),
  castle: () => {
    tone(0, 660, 0.1, 0.18, 'triangle');
    tone(0.1, 880, 0.14, 0.18, 'triangle');
  },
  check: () => {
    tone(0, 784, 0.08, 0.16, 'triangle');
    tone(0.07, 988, 0.08, 0.16, 'triangle');
    tone(0.14, 1319, 0.14, 0.18, 'triangle');
  },
  end: () => {
    tone(0, 523, 0.14, 0.2, 'triangle');
    tone(0.1, 659, 0.14, 0.2, 'triangle');
    tone(0.2, 784, 0.14, 0.2, 'triangle');
    tone(0.3, 1047, 0.4, 0.22, 'triangle');
  },
  error: () => sweep(0, 320, 180, 0.18, 0.18),
  start: () => {
    tone(0, 660, 0.09, 0.18, 'triangle');
    tone(0.09, 880, 0.09, 0.18, 'triangle');
    tone(0.18, 1175, 0.22, 0.2, 'triangle');
  },
  lowTime: () => {
    tone(0, 1760, 0.07, 0.16, 'triangle');
    tone(0.13, 1760, 0.07, 0.16, 'triangle');
  },
  tick: () => tone(0, 1480, 0.04, 0.18, 'triangle'),
  win: () => {
    mallet(0, 523, { gain: 0.24, length: 0.3, wave: 'triangle' });
    mallet(0.09, 659, { gain: 0.24, length: 0.3, wave: 'triangle' });
    mallet(0.18, 784, { gain: 0.26, length: 0.3, wave: 'triangle' });
    mallet(0.27, 1047, { gain: 0.3, length: 0.9, wave: 'triangle' });
    sweep(0.4, 1400, 2800, 0.25, 0.08);
  },
  loss: () => {
    sweep(0, 520, 330, 0.35, 0.18);
    mallet(0.32, 330, { gain: 0.22, length: 0.7, wave: 'triangle' });
  },
  draw: () => {
    mallet(0, 659, { gain: 0.22, length: 0.35, wave: 'triangle' });
    mallet(0.16, 659, { gain: 0.22, length: 0.6, wave: 'triangle' });
  },
};

// ---- the Shop's packs

/** A synth note with an optional glide (8-bit square, brass sawtooth…). */
function note(at: number, freq: number, length: number, { gain = 0.12, wave = 'square' as OscillatorType, to = 0, lowpass = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + length);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.setValueAtTime(gain, t + length * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  let out: AudioNode = g;
  if (lowpass) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lowpass * 0.4, t);
    f.frequency.exponentialRampToValueAtTime(lowpass, t + Math.min(0.08, length / 2));
    g.connect(f);
    out = f;
  }
  osc.connect(g);
  out.connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/** A burst of filtered noise (a drum's skin, thunder, a cash register's ring). */
function noise(at: number, length: number, { gain = 0.3, type = 'lowpass' as BiquadFilterType, freq = 800, q = 0.8 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * length), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + length);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** A glass bell: inharmonic partials, long and quiet. */
function bell(at: number, freq: number, { gain = 0.12, length = 0.9 } = {}) {
  const parts: [number, number, number][] = [
    [1, 1, 1],
    [2.76, 0.45, 0.6],
    [5.4, 0.25, 0.35],
    [8.93, 0.12, 0.2],
  ];
  const a = audio();
  if (!a) return;
  for (const [m, g, l] of parts) if (freq * m < a.sampleRate / 2.2) tone(at, freq * m, length * l, gain * g);
}

/** A drum: a falling low sine and a short slap of noise. */
function drum(at: number, freq: number, { gain = 0.55, length = 0.3 } = {}) {
  note(at, freq * 2.2, length, { gain, wave: 'sine', to: freq });
  noise(at, 0.05, { gain: gain * 0.35, type: 'bandpass', freq: 1800, q: 0.7 });
}

/** A harp string: a bright plucked note. */
function pluck(at: number, freq: number, { gain = 0.2, length = 0.55 } = {}) {
  tone(at, freq, length, gain, 'triangle');
  tone(at, freq * 2, length * 0.4, gain * 0.35, 'sine');
  tone(at, freq * 3, length * 0.15, gain * 0.15, 'sine');
}

/** A stone click in a big hall: the knock, then its echoes. */
function hall(pitch: number, gain = 0.45) {
  knock(0, { pitch, gain, length: 0.05 });
  knock(0.11, { pitch, gain: gain * 0.32, length: 0.05 });
  knock(0.23, { pitch, gain: gain * 0.12, length: 0.05 });
}

const ARCADE: typeof WOOD = {
  move: () => {
    note(0, 660, 0.05, { gain: 0.09 });
    note(0.045, 990, 0.05, { gain: 0.08 });
  },
  capture: () => note(0, 880, 0.16, { gain: 0.1, to: 200 }),
  castle: () => [523, 659, 784].forEach((f, i) => note(i * 0.06, f, 0.06, { gain: 0.08 })),
  check: () => {
    note(0, 1046, 0.07, { gain: 0.09 });
    note(0.1, 1046, 0.07, { gain: 0.09 });
  },
  end: () => [523, 659, 784, 1046].forEach((f, i) => note(i * 0.08, f, i === 3 ? 0.3 : 0.08, { gain: 0.09 })),
  error: () => note(0, 220, 0.18, { gain: 0.09, to: 110 }),
  start: () => note(0, 262, 0.32, { gain: 0.08, to: 1046 }),
  lowTime: () => {
    note(0, 1760, 0.05, { gain: 0.08 });
    note(0.12, 1760, 0.05, { gain: 0.08 });
  },
  tick: () => note(0, 1500, 0.03, { gain: 0.07 }),
  win: () => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => note(i * 0.07, f, i === 5 ? 0.45 : 0.07, { gain: 0.09 })),
  loss: () => [392, 349, 330, 262].forEach((f, i) => note(i * 0.16, f, i === 3 ? 0.4 : 0.14, { gain: 0.08 })),
  draw: () => {
    note(0, 587, 0.12, { gain: 0.08 });
    note(0.18, 587, 0.25, { gain: 0.08 });
  },
};

const CRYSTAL: typeof WOOD = {
  move: () => bell(0, 1568, { gain: 0.1, length: 0.6 }),
  capture: () => {
    bell(0, 1976, { gain: 0.12, length: 0.7 });
    bell(0.05, 1318, { gain: 0.1, length: 0.7 });
  },
  castle: () => {
    bell(0, 1318, { gain: 0.1 });
    bell(0.1, 1568, { gain: 0.1 });
  },
  check: () => {
    bell(0, 2093, { gain: 0.13 });
    bell(0.08, 2637, { gain: 0.09 });
  },
  end: () => [1047, 1318, 1568].forEach((f, i) => bell(i * 0.1, f, { gain: 0.11, length: 1.2 })),
  error: () => bell(0, 330, { gain: 0.1, length: 0.4 }),
  start: () => {
    bell(0, 1318, { gain: 0.1 });
    bell(0.12, 1976, { gain: 0.11, length: 1.1 });
  },
  lowTime: () => {
    bell(0, 2637, { gain: 0.09, length: 0.2 });
    bell(0.15, 2637, { gain: 0.09, length: 0.2 });
  },
  tick: () => bell(0, 3136, { gain: 0.06, length: 0.1 }),
  win: () => [1047, 1318, 1568, 2093, 2637].forEach((f, i) => bell(i * 0.09, f, { gain: 0.11, length: i === 4 ? 1.6 : 0.9 })),
  loss: () => {
    bell(0, 784, { gain: 0.1, length: 0.9 });
    bell(0.25, 659, { gain: 0.1, length: 1.3 });
  },
  draw: () => {
    bell(0, 1047, { gain: 0.1 });
    bell(0.2, 1047, { gain: 0.1, length: 1.2 });
  },
};

const MARBLE: typeof WOOD = {
  move: () => hall(1400, 0.42),
  capture: () => {
    hall(900, 0.55);
    knock(0.05, { pitch: 1600, gain: 0.3, length: 0.05 });
  },
  castle: () => {
    hall(1300, 0.38);
    knock(0.12, { pitch: 1200, gain: 0.36, length: 0.05 });
  },
  check: () => {
    hall(1400, 0.42);
    tone(0.02, 1760, 0.3, 0.08);
    tone(0.14, 1760, 0.2, 0.03);
  },
  end: () => WOOD.end(),
  error: () => tone(0, 220, 0.15, 0.12),
  start: () => {
    WOOD.start();
    mallet(0.3, 1175, { gain: 0.1, length: 0.6 });
  },
  lowTime: () => WOOD.lowTime(),
  tick: () => knock(0, { pitch: 2200, gain: 0.25, length: 0.03 }),
  win: () => {
    WOOD.win();
    [523, 659, 784, 1047].forEach((f, i) => mallet(0.2 + i * 0.1, f, { gain: 0.08, length: 0.6 }));
  },
  loss: () => WOOD.loss(),
  draw: () => WOOD.draw(),
};

const ROYAL: typeof WOOD = {
  move: () => pluck(0, 784, { gain: 0.18, length: 0.45 }),
  capture: () => {
    pluck(0, 587, { gain: 0.2 });
    pluck(0.05, 880, { gain: 0.16 });
  },
  castle: () => [523, 659, 784].forEach((f, i) => pluck(i * 0.08, f, { gain: 0.16 })),
  check: () => note(0, 880, 0.28, { gain: 0.09, wave: 'sawtooth', lowpass: 2400 }),
  end: () => [523, 659, 784].forEach((f) => note(0, f, 0.9, { gain: 0.06, wave: 'sawtooth', lowpass: 2000 })),
  error: () => pluck(0, 220, { gain: 0.16 }),
  start: () => {
    note(0, 523, 0.12, { gain: 0.08, wave: 'sawtooth', lowpass: 2200 });
    note(0.13, 784, 0.4, { gain: 0.09, wave: 'sawtooth', lowpass: 2600 });
  },
  lowTime: () => {
    pluck(0, 1760, { gain: 0.14, length: 0.2 });
    pluck(0.14, 1760, { gain: 0.14, length: 0.2 });
  },
  tick: () => pluck(0, 2093, { gain: 0.09, length: 0.1 }),
  // Trumpets: da-da-da-DAA, DAA.
  win: () => {
    const b = (at: number, f: number, l: number) => note(at, f, l, { gain: 0.09, wave: 'sawtooth', lowpass: 3000 });
    b(0, 523, 0.1);
    b(0.12, 523, 0.1);
    b(0.24, 523, 0.1);
    b(0.36, 659, 0.45);
    b(0.84, 784, 0.9);
    [523, 659].forEach((f) => note(0.84, f, 0.9, { gain: 0.05, wave: 'sawtooth', lowpass: 2400 }));
  },
  loss: () => {
    pluck(0, 494, { gain: 0.18, length: 0.7 });
    pluck(0.3, 392, { gain: 0.16, length: 1.1 });
  },
  draw: () => {
    pluck(0, 587, { gain: 0.16 });
    pluck(0.22, 440, { gain: 0.16, length: 0.9 });
  },
};

const DRUMS: typeof WOOD = {
  move: () => drum(0, 110, { gain: 0.45, length: 0.22 }),
  capture: () => {
    drum(0, 75, { gain: 0.7, length: 0.4 });
    noise(0.02, 0.7, { gain: 0.18, type: 'lowpass', freq: 220 });
  },
  castle: () => {
    drum(0, 130, { gain: 0.45 });
    drum(0.12, 110, { gain: 0.45 });
  },
  check: () => {
    drum(0, 150, { gain: 0.5, length: 0.2 });
    drum(0.09, 150, { gain: 0.5, length: 0.25 });
  },
  end: () => {
    for (let i = 0; i < 6; i++) drum(i * 0.06, 120, { gain: 0.25 + i * 0.05, length: 0.15 });
    note(0.4, 196, 1.6, { gain: 0.1, wave: 'triangle' });
    noise(0.4, 1.2, { gain: 0.08, type: 'bandpass', freq: 600, q: 2 });
  },
  error: () => drum(0, 70, { gain: 0.4 }),
  start: () => [90, 110, 130].forEach((f, i) => drum(i * 0.15, f, { gain: 0.45 })),
  lowTime: () => {
    drum(0, 200, { gain: 0.35, length: 0.12 });
    drum(0.14, 200, { gain: 0.35, length: 0.12 });
  },
  tick: () => noise(0, 0.03, { gain: 0.25, type: 'highpass', freq: 3000 }),
  // A drum roll, then a gong.
  win: () => {
    for (let i = 0; i < 10; i++) drum(i * (0.09 - i * 0.004), 120 + i * 4, { gain: 0.25 + i * 0.04, length: 0.14 });
    note(0.75, 147, 2.2, { gain: 0.14, wave: 'triangle' });
    note(0.75, 220, 1.8, { gain: 0.06, wave: 'sine' });
    noise(0.75, 1.6, { gain: 0.1, type: 'bandpass', freq: 500, q: 1.5 });
  },
  loss: () => {
    drum(0, 90, { gain: 0.5, length: 0.4 });
    drum(0.35, 70, { gain: 0.45, length: 0.6 });
  },
  draw: () => {
    drum(0, 110, { gain: 0.45 });
    drum(0.25, 110, { gain: 0.45 });
  },
};

type Sounds = typeof WOOD;
const THEMES: Record<SoundTheme, Sounds> = { wood: WOOD, fun: FUN, sarcade: ARCADE, scrystal: CRYSTAL, smarble: MARBLE, sroyal: ROYAL, sdrums: DRUMS };
const pick = <K extends keyof Sounds>(k: K) => (THEMES[get(soundTheme)] ?? WOOD)[k]();
export const sounds: Record<keyof Sounds, () => void> = {
  move: () => pick('move'),
  capture: () => pick('capture'),
  castle: () => pick('castle'),
  check: () => pick('check'),
  end: () => pick('end'),
  error: () => pick('error'),
  start: () => pick('start'),
  lowTime: () => pick('lowTime'),
  tick: () => pick('tick'),
  win: () => pick('win'),
  loss: () => pick('loss'),
  draw: () => pick('draw'),
};

/** A taste of a theme (the Shop's "Listen" and Settings' preview): a move, another, a capture, a check, a win. */
export function previewTheme(theme: SoundTheme) {
  const s = THEMES[theme] ?? WOOD;
  const steps: [number, keyof Sounds][] = [
    [0, 'move'],
    [380, 'move'],
    [760, 'capture'],
    [1200, 'check'],
    [1750, 'win'],
  ];
  for (const [ms, k] of steps) setTimeout(() => s[k](), ms);
}

/**
 * The Treasury's sounds (src/lib/economy): a coin's ring, a gem's sparkle, the daily chest, a level up, a purchase.
 * The same in every theme, soft, and silent with the sounds off.
 */
export function rewardSound(kind: 'coin' | 'gem' | 'chest' | 'level' | 'buy') {
  if (kind === 'coin') {
    bell(0, 1976, { gain: 0.07, length: 0.25 });
    bell(0.07, 2637, { gain: 0.08, length: 0.4 });
  } else if (kind === 'gem') {
    [2637, 3136, 3951].forEach((f, i) => bell(i * 0.06, f, { gain: 0.06, length: 0.5 }));
  } else if (kind === 'chest') {
    knock(0, { pitch: 500, gain: 0.4, length: 0.08 });
    [523, 659, 784, 1047].forEach((f, i) => mallet(0.12 + i * 0.08, f, { gain: 0.2, length: 0.5 }));
    [2093, 2637, 3136].forEach((f, i) => bell(0.5 + i * 0.07, f, { gain: 0.06, length: 0.7 }));
  } else if (kind === 'level') {
    [523, 659, 784, 1047, 1318].forEach((f, i) => mallet(i * 0.09, f, { gain: 0.22, length: i === 4 ? 1 : 0.4 }));
    [2637, 3136, 3951].forEach((f, i) => bell(0.5 + i * 0.06, f, { gain: 0.06, length: 0.8 }));
  } else {
    noise(0, 0.05, { gain: 0.25, type: 'highpass', freq: 2500 });
    bell(0.06, 2349, { gain: 0.09, length: 0.35 });
    bell(0.14, 3136, { gain: 0.1, length: 0.7 });
  }
}

/** A finished game's sound, from the player's side: won, lost or drawn. */
export const playOutcome = (o: 'won' | 'lost' | 'draw') => (o === 'won' ? sounds.win() : o === 'lost' ? sounds.loss() : sounds.draw());

/** The warning point for a clock: 10 seconds, or less in very fast games. */
export const lowTimeMs = (initialMs: number) => Math.min(10_000, initialMs / 8);

/**
 * The right sound for `move` played from `before` (which is not changed). `endChime` false: a game being played,
 * whose result has its own sound (won, lost, drawn), so the last move only knocks.
 */
export function playMoveSound(before: Chess, move: NormalMove, endChime = true) {
  const piece = before.board.get(move.from);
  const target = before.board.get(move.to);
  const after = before.clone();
  after.play(move);
  if (after.isEnd() && endChime) return sounds.end();
  if (after.isCheck()) return sounds.check();
  if (piece?.role === 'king' && target?.color === piece.color) return sounds.castle();
  const enPassant = piece?.role === 'pawn' && (move.from & 7) !== (move.to & 7) && !target;
  if (target || enPassant) return sounds.capture();
  sounds.move();
}
