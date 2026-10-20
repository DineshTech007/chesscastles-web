/**
 * Festive music for Vijayadashami: "Sita Ram Tarang (instrumental)" by Kontraa (Pixabay, free for commercial
 * use), its first minute and a half, at a gentle volume (static/festive/dasara.mp3). It downloads only when the
 * greeting opens and plays over and over until the visitor stops it. Browsers allow sound before the visitor's
 * first tap only sometimes: `autoplay` tries at once, and `start` (called from a tap or click handler) always
 * works.
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
      a.loop = true;
      this.audio = a;
    }
    return this.audio;
  }

  /** Starts downloading the music (no sound), so it plays at once when asked. */
  preload(): void {
    this.el();
  }

  /** Tries to start without a tap; true if the browser allowed it. */
  async autoplay(): Promise<boolean> {
    const a = this.el();
    if (!a || this.playing) return this.playing;
    try {
      clearInterval(this.fade);
      a.volume = VOLUME;
      await a.play();
      this.playing = true;
      return true;
    } catch {
      return false;
    }
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
