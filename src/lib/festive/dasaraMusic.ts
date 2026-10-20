/**
 * Happy festive music for Vijayadashami: dhol and tasha drums, shehnai, brass and bells, about half a minute,
 * fading out at the end (static/festive/dasara.mp3, made for Chess Castles with Runway). It downloads only when
 * the greeting opens. Phones only allow sound after a tap, so `start` must be called from a tap (or click)
 * handler.
 */

const SRC = '/festive/dasara.mp3';
const VOLUME = 0.8;

export class DasaraMusic {
  private audio: HTMLAudioElement | undefined;
  private fade: ReturnType<typeof setInterval> | undefined;
  playing = false;
  onend: (() => void) | undefined;

  private el(): HTMLAudioElement | undefined {
    if (!this.audio && typeof Audio !== 'undefined') {
      const a = new Audio(SRC);
      a.preload = 'auto';
      a.onended = () => this.done();
      this.audio = a;
    }
    return this.audio;
  }

  /** Starts downloading the music (no sound), so it plays at once on the first tap. */
  preload(): void {
    this.el();
  }

  /** Starts the music (call it inside a tap/click handler). */
  start(): boolean {
    if (this.playing) return true;
    const a = this.el();
    if (!a) return false;
    clearInterval(this.fade);
    try {
      a.volume = VOLUME;
      a.currentTime = 0;
    } catch {
      /* not loaded yet: it starts from the beginning anyway */
    }
    this.playing = true;
    a.play().catch(() => this.done());
    return true;
  }

  /** Another tap: tries again if the phone held the sound back. */
  nudge(): void {
    const a = this.audio;
    if (this.playing && a?.paused) a.play().catch(() => {});
  }

  /** Stops with a short fade (iPhones can't change the volume: there it just stops). */
  stop(): void {
    const a = this.audio;
    if (a && !a.paused) {
      clearInterval(this.fade);
      let steps = 10;
      this.fade = setInterval(() => {
        a.volume = Math.max(0, a.volume - VOLUME / 10);
        if (--steps <= 0) {
          clearInterval(this.fade);
          a.pause();
        }
      }, 80);
    }
    this.done();
  }

  private done() {
    if (this.playing) {
      this.playing = false;
      this.onend?.();
    }
  }
}
