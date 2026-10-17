import { writable, get } from 'svelte/store';
import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';

/**
 * Board sounds, made on the fly with Web Audio (no sound files): a wooden
 * "tock" for a move, a heavier double knock for a capture, a bright ping
 * for check, two knocks for castling, and a soft chime when a game ends.
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

function tone(at: number, freq: number, length: number, gain = 0.18) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export const sounds = {
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
  /** A game begins: a bright two-note call. */
  start: () => {
    tone(0, 784, 0.16, 0.16);
    tone(0.13, 1175, 0.28, 0.16);
  },
  /** Your clock is running low: two quick beeps. */
  lowTime: () => {
    tone(0, 1568, 0.09, 0.14);
    tone(0.16, 1568, 0.09, 0.14);
  },
};

/** The warning point for a clock: 10 seconds, or less in very fast games. */
export const lowTimeMs = (initialMs: number) => Math.min(10_000, initialMs / 8);

/** The right sound for `move` played from `before` (which is not changed). */
export function playMoveSound(before: Chess, move: NormalMove) {
  const piece = before.board.get(move.from);
  const target = before.board.get(move.to);
  const after = before.clone();
  after.play(move);
  if (after.isEnd()) return sounds.end();
  if (after.isCheck()) return sounds.check();
  if (piece?.role === 'king' && target?.color === piece.color) return sounds.castle();
  const enPassant = piece?.role === 'pawn' && (move.from & 7) !== (move.to & 7) && !target;
  if (target || enPassant) return sounds.capture();
  sounds.move();
}
