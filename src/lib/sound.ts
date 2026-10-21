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

export type SoundTheme = 'wood' | 'fun';
const THEME_KEY = 'k24.soundTheme';
export const soundTheme = writable<SoundTheme>('wood');
if (typeof localStorage !== 'undefined') {
  try {
    if (localStorage.getItem(THEME_KEY) === 'fun') soundTheme.set('fun');
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

type Sounds = typeof WOOD;
const pick = <K extends keyof Sounds>(k: K) => (get(soundTheme) === 'fun' ? FUN[k] : WOOD[k])();
export const sounds: Record<keyof Sounds, () => void> = {
  move: () => pick('move'),
  capture: () => pick('capture'),
  castle: () => pick('castle'),
  check: () => pick('check'),
  end: () => pick('end'),
  error: () => pick('error'),
  start: () => pick('start'),
  lowTime: () => pick('lowTime'),
  win: () => pick('win'),
  loss: () => pick('loss'),
  draw: () => pick('draw'),
};

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
