<script lang="ts">
  /**
   * The victory effect a player wears from the Shop, over the whole screen after a win (in place of the plain
   * fireworks): confetti, golden rain, or the Royal Fanfare (a crown in light rays and gold). Nothing to catch the
   * taps, a few seconds long, and none at all when the device asks for less motion.
   */
  import { onMount } from 'svelte';
  import Fireworks from '$lib/components/Fireworks.svelte';

  let { kind }: { kind: string } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let crown = $state(false);

  onMount(() => {
    if (kind === 'vfireworks' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    const W = canvas.width;
    const H = canvas.height;
    if (kind === 'vfanfare') crown = true;
    type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; c: string; coin: boolean; life: number };
    const parts: P[] = [];
    const COLORS = ['#f2c14e', '#38d2ff', '#22c55e', '#f472b6', '#a78bfa', '#ff7a45', '#ffffff'];
    const coins = kind === 'vgoldrain' || kind === 'vfanfare';
    const total = kind === 'vconfetti' ? 180 : kind === 'vgoldrain' ? 120 : 140;
    for (let i = 0; i < total; i++) {
      const fromTop = kind !== 'vfanfare' || i % 2 === 0;
      parts.push({
        x: fromTop ? Math.random() * W : W / 2 + (Math.random() - 0.5) * 40 * dpr,
        y: fromTop ? -Math.random() * H * 0.8 : H * 0.42,
        vx: fromTop ? (Math.random() - 0.5) * 2 * dpr : (Math.random() - 0.5) * 16 * dpr,
        vy: fromTop ? (2 + Math.random() * 3) * dpr : -(6 + Math.random() * 10) * dpr,
        r: (coins ? 7 + Math.random() * 6 : 4 + Math.random() * 4) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[i % COLORS.length],
        coin: coins && (kind === 'vgoldrain' || i % 3 !== 0),
        life: 0,
      });
    }
    let raf = 0;
    const start = performance.now();
    const draw = (t: number) => {
      const el = t - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.life++;
        p.vy += 0.12 * dpr;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.coin) {
          // A coin turning: its width follows the rotation.
          const w = Math.abs(Math.cos(p.rot * 2)) * p.r + p.r * 0.15;
          const g = ctx.createRadialGradient(-w * 0.3, -p.r * 0.3, 1, 0, 0, p.r);
          g.addColorStop(0, '#fff4c2');
          g.addColorStop(0.5, '#f5c451');
          g.addColorStop(1, '#b87a12');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, w, p.r, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
        }
        ctx.restore();
      }
      if (el < 5200) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(draw);
    const off = setTimeout(() => (crown = false), 3600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(off);
    };
  });
</script>

{#if kind === 'vfireworks'}
  <Fireworks rockets={16} />
{:else}
  <canvas bind:this={canvas} class="fx" aria-hidden="true"></canvas>
  {#if crown}
    <div class="crown" aria-hidden="true"><span class="rays"></span><span class="c">👑</span></div>
  {/if}
{/if}

<style>
  .fx {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1200;
    pointer-events: none;
  }
  .crown {
    position: fixed;
    left: 50%;
    top: 38%;
    z-index: 1199;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .rays {
    position: absolute;
    left: -260px;
    top: -260px;
    width: 520px;
    height: 520px;
    background: repeating-conic-gradient(from 0deg, rgba(255, 220, 140, 0.35) 0 8deg, transparent 8deg 20deg);
    -webkit-mask: radial-gradient(circle, #000 10%, transparent 62%);
    mask: radial-gradient(circle, #000 10%, transparent 62%);
    animation:
      spin 9s linear infinite,
      fade 3.6s ease-in-out both;
  }
  .c {
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(-50%, -50%);
    font-size: 110px;
    filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.5));
    animation: drop 3.6s cubic-bezier(0.3, 1.5, 0.5, 1) both;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes fade {
    0%,
    100% {
      opacity: 0;
    }
    15%,
    80% {
      opacity: 1;
    }
  }
  @keyframes drop {
    0% {
      transform: translate(-50%, -180%) scale(0.3);
      opacity: 0;
    }
    20% {
      transform: translate(-50%, -50%) scale(1.1);
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }
</style>
