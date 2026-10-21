<script lang="ts">
  /**
   * Fireworks over the whole screen after a win (owner's request, 2026-10-21: "if you win the game do some
   * fireworks"): rockets rise and burst into sparks for a few seconds, each with a soft pop. Nothing to catch the
   * taps (the result stays usable), and none at all when the device asks for less motion.
   */
  import { onMount } from 'svelte';
  import { puzzleSounds } from '$lib/puzzles/puzzleSounds';

  let { rockets = 7 }: { rockets?: number } = $props();
  let canvas: HTMLCanvasElement;
  const COLORS = ['#f2c14e', '#ffe39a', '#38d2ff', '#22c55e', '#f472b6', '#a78bfa', '#ffffff', '#ff7a45'];

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    size();
    const W = () => canvas.width;
    const H = () => canvas.height;
    type Rocket = { x: number; y: number; vy: number; top: number; c: string };
    type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; c: string; r: number };
    const up: Rocket[] = [];
    const sparks: Spark[] = [];
    let launched = 0;
    let nextAt = 0;
    let raf = 0;

    const launch = () => {
      const top = H() * (0.12 + Math.random() * 0.3);
      up.push({ x: W() * (0.15 + Math.random() * 0.7), y: H(), vy: -(H() - top) / 34, top, c: COLORS[Math.floor(Math.random() * COLORS.length)] });
      launched++;
    };
    const burst = (x: number, y: number, c: string) => {
      const n = 70;
      const second = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const v = (1.6 + Math.random() * 3.4) * dpr;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 48 + Math.random() * 30, c: i % 3 ? c : second, r: (1.3 + Math.random() * 1.5) * dpr });
      }
      puzzleSounds.pop();
    };

    const frame = (t: number) => {
      if (launched < rockets && t >= nextAt) {
        launch();
        nextAt = t + 260 + Math.random() * 320;
      }
      // Fading trails: the last frame dims a little.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, W(), H());
      ctx.globalCompositeOperation = 'lighter';
      for (let i = up.length - 1; i >= 0; i--) {
        const r = up[i];
        r.y += r.vy;
        r.vy *= 0.97;
        ctx.fillStyle = r.c;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        if (r.y <= r.top || r.vy > -1.5) {
          burst(r.x, r.y, r.c);
          up.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age++;
        s.vx *= 0.975;
        s.vy = s.vy * 0.975 + 0.045 * dpr;
        s.x += s.vx;
        s.y += s.vy;
        const left = 1 - s.age / s.life;
        if (left <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = left;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (launched < rockets || up.length || sparks.length) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(frame);
    addEventListener('resize', size);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', size);
    };
  });
</script>

<canvas bind:this={canvas} class="fw" aria-hidden="true"></canvas>

<style>
  .fw {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 120;
  }
</style>
