/**
 * Soft festive music for Vijayadashami, made in the browser (no recording, nothing to license or download):
 * a temple bell, a tanpura drone (Pa Sa Sa Sa) and a bansuri-like melody in Raag Bhoopali (Sa Re Ga Pa Dha),
 * about fifty seconds, fading out at the end. Phones only allow sound after a tap, so `start` must be called
 * from a tap (or click) handler.
 */

const SA = 220;
const R: Record<string, number> = { 'D.': 5 / 6, S: 1, R: 9 / 8, G: 5 / 4, P: 3 / 2, D: 5 / 3, "S'": 2, "R'": 9 / 4, "G'": 5 / 2 };

/** Raag Bhoopali phrases: [note, beats]; "-" is a rest. */
const TUNE: [string, number][] = [
  ['G', 2], ['R', 1], ['S', 1], ['D.', 2], ['S', 2],
  ['R', 1], ['G', 1], ['P', 2], ['G', 2], ['-', 1],
  ['D', 1], ['P', 1], ['G', 1], ['R', 1], ['S', 3], ['-', 1],
  ['G', 1], ['P', 1], ['D', 2], ["S'", 3], ['-', 1],
  ["S'", 1], ['D', 1], ['P', 1], ['G', 1], ['P', 2], ['D', 1], ['P', 1],
  ['G', 2], ['R', 1], ['S', 1], ['R', 1], ['G', 3], ['-', 1],
  ['P', 1], ['G', 1], ['R', 1], ['S', 1], ['D.', 2], ['S', 4],
];
const BEAT = 0.62;

export class DasaraMusic {
  private ctx: AudioContext | undefined;
  private master: GainNode | undefined;
  playing = false;
  onend: (() => void) | undefined;

  /** Starts the music (call it inside a tap/click handler). */
  start(): boolean {
    if (this.playing) return true;
    const AC = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!AC) return false;
    try {
      const ctx: AudioContext = this.ctx ?? new AC();
      this.ctx = ctx;
      void ctx.resume();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      this.master = master;
      const t0 = ctx.currentTime + 0.05;
      master.gain.linearRampToValueAtTime(0.22, t0 + 2);

      // A reverb-like tail: a few soft echoes.
      const wet = ctx.createGain();
      wet.gain.value = 0.25;
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.23;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      delay.connect(fb).connect(delay);
      wet.connect(delay).connect(master);

      this.bell(t0, master, wet);
      const tuneLen = TUNE.reduce((s, [, b]) => s + b, 0) * BEAT;
      const melodyAt = t0 + 3.2;
      const total = 3.2 + tuneLen * 2 + 3;
      this.drone(t0 + 0.4, t0 + total, master);
      this.melody(melodyAt, master, wet);
      this.melody(melodyAt + tuneLen, master, wet);
      this.bell(t0 + total - 4.5, master, wet);
      // Fade out at the end.
      master.gain.setValueAtTime(0.22, t0 + total - 3);
      master.gain.linearRampToValueAtTime(0, t0 + total);
      this.playing = true;
      // The end, in the music's own time (a phone may hold the sound back for a moment before it starts).
      const marker = ctx.createOscillator();
      const silent = ctx.createGain();
      silent.gain.value = 0;
      marker.connect(silent).connect(ctx.destination);
      marker.onended = () => {
        if (this.master === master) this.stop();
      };
      marker.start(t0);
      marker.stop(t0 + total + 0.2);
      return true;
    } catch {
      return false;
    }
  }

  /** Another tap: wakes the sound if the phone still holds it back. */
  nudge(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  /** Stops with a short fade. */
  stop(): void {
    const ctx = this.ctx;
    const m = this.master;
    if (ctx && m) {
      const now = ctx.currentTime;
      m.gain.cancelScheduledValues(now);
      m.gain.setValueAtTime(m.gain.value, now);
      m.gain.linearRampToValueAtTime(0, now + 0.8);
      setTimeout(() => {
        try {
          m.disconnect();
        } catch {
          /* already gone */
        }
      }, 1000);
    }
    this.master = undefined;
    if (this.playing) {
      this.playing = false;
      this.onend?.();
    }
  }

  /** A temple bell: a few inharmonic partials with a long ring. */
  private bell(at: number, out: AudioNode, wet: AudioNode) {
    const ctx = this.ctx!;
    for (const [mult, level, decay] of [
      [1, 0.5, 4.5],
      [2.76, 0.25, 2.8],
      [5.4, 0.12, 1.6],
      [8.93, 0.06, 0.9],
    ] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = SA * 2 * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(level * 0.5, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      o.connect(g);
      g.connect(out);
      g.connect(wet);
      o.start(at);
      o.stop(at + decay + 0.1);
    }
  }

  /** The tanpura: Pa (low), Sa, Sa, Sa (lower octave), plucked again and again. */
  private drone(from: number, until: number, out: AudioNode) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.Q.value = 0.7;
    const bus = ctx.createGain();
    bus.gain.value = 0.16;
    lp.connect(bus).connect(out);
    const strings = [SA * 0.75, SA, SA, SA * 0.5];
    const gap = 0.95;
    let t = from;
    let i = 0;
    while (t < until - 1) {
      const f = strings[i % 4];
      for (const detune of [-4, 3]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.32, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + 3.7);
      }
      t += i % 4 === 3 ? gap * 1.6 : gap;
      i++;
    }
  }

  /** The bansuri: a soft, breathy tone with vibrato and gentle glides between notes. */
  private melody(at: number, out: AudioNode, wet: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 3.2;
    vib.connect(vibDepth);
    vibDepth.connect(o.frequency);
    vibDepth.connect(o2.frequency);
    const mix2 = ctx.createGain();
    mix2.gain.value = 0.18;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g);
    o2.connect(mix2).connect(g);
    // Breath: filtered noise following the same envelope.
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = SA * 4;
    bp.Q.value = 1.2;
    const breath = ctx.createGain();
    breath.gain.value = 0.035;
    noise.connect(bp).connect(breath).connect(g);
    g.connect(out);
    g.connect(wet);

    let t = at;
    let first = true;
    for (const [n, beats] of TUNE) {
      const dur = beats * BEAT;
      if (n === '-') {
        g.gain.setTargetAtTime(0, t, 0.08);
        t += dur;
        first = true;
        continue;
      }
      const f = SA * 2 * R[n];
      if (first) {
        o.frequency.setValueAtTime(f, t);
        o2.frequency.setValueAtTime(f * 2, t);
      } else {
        // Meend: a short glide into the next note.
        o.frequency.setTargetAtTime(f, t, 0.035);
        o2.frequency.setTargetAtTime(f * 2, t, 0.035);
      }
      g.gain.setTargetAtTime(first ? 0.42 : 0.38, t, first ? 0.06 : 0.03);
      g.gain.setTargetAtTime(0.3, t + dur * 0.6, 0.2);
      first = false;
      t += dur;
    }
    g.gain.setTargetAtTime(0, t, 0.15);
    const end = t + 1.2;
    for (const s of [o, o2, vib, noise]) {
      s.start(at);
      s.stop(end);
    }
  }
}
