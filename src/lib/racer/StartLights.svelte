<script lang="ts">
  /**
   * The start of a Puzzle Racer race, as in Formula 1: five red lights come on one by one with a beep (and a big 3,
   * 2, 1), then all turn green: GO! Timed by the race's clock (`now`: the room's time), so everyone starts together.
   */
  import { puzzleSounds } from '$lib/puzzles/puzzleSounds';

  let { startAt, now }: { startAt: number; now: () => number } = $props();

  const LIGHTS = 5;
  const SPAN = 4000;
  let t = $state(Date.now());
  let raf = 0;
  $effect(() => {
    const loop = () => {
      t = now();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
  const left = $derived(startAt - t);
  /** Red lights on: one more every 800 ms through the last 4 seconds. */
  const on = $derived(Math.max(0, Math.min(LIGHTS, Math.floor((SPAN - left) / (SPAN / LIGHTS)) + 1)));
  const go = $derived(left <= 0);
  const count = $derived(Math.ceil(left / 1000));

  let beeped = 0;
  let wentGo = false;
  $effect(() => {
    if (go && !wentGo) {
      wentGo = true;
      puzzleSounds.light(true);
    } else if (!go && on > beeped && left < SPAN + 50) {
      beeped = on;
      puzzleSounds.light(false);
    }
  });
</script>

{#if left > -1100}
  <div class="lights" class:go aria-live="assertive">
    <div class="box">
      {#each Array.from({ length: LIGHTS }) as _, i (i)}
        <span class="lamp" class:red={!go && i < on} class:green={go}></span>
      {/each}
    </div>
    {#if go}
      <strong class="word go-word">GO!</strong>
    {:else if count <= 3 && count >= 1}
      {#key count}<strong class="word">{count}</strong>{/key}
    {:else}
      <strong class="word small">Get ready…</strong>
    {/if}
  </div>
{/if}

<style>
  .lights {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    background: radial-gradient(circle at 50% 45%, rgba(10, 14, 24, 0.55), rgba(10, 14, 24, 0.85));
    border-radius: inherit;
    pointer-events: none;
  }
  .lights.go {
    animation: fade 1.1s ease-in forwards;
  }
  @keyframes fade {
    60% {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  .box {
    display: flex;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 18px;
    background: linear-gradient(180deg, #1c1f27, #0d0f14);
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.6),
      inset 0 0 0 2px #2a2e38;
  }
  .lamp {
    width: clamp(30px, 8vw, 46px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #3a1414, #1a0a0a);
    box-shadow: inset 0 0 0 3px #000;
    transition:
      background 0.08s,
      box-shadow 0.08s;
  }
  .lamp.red {
    background: radial-gradient(circle at 35% 30%, #ff8a8a, #e01b1b 55%, #8a0000);
    box-shadow:
      0 0 22px 4px rgba(255, 40, 40, 0.75),
      inset 0 0 0 3px #400;
  }
  .lamp.green {
    background: radial-gradient(circle at 35% 30%, #b8ffb8, #19d24a 55%, #08752a);
    box-shadow:
      0 0 26px 6px rgba(40, 255, 110, 0.8),
      inset 0 0 0 3px #033;
  }
  .word {
    font: 900 clamp(56px, 14vw, 110px) / 1 var(--font-display);
    color: #fff;
    text-shadow:
      0 6px 0 #b91c1c,
      0 0 30px rgba(255, 60, 60, 0.6);
    animation: zoom 0.8s ease-out;
  }
  .word.small {
    font-size: clamp(28px, 6vw, 40px);
    text-shadow: 0 3px 0 #334155;
    animation: none;
  }
  .go-word {
    color: #eaffea;
    text-shadow:
      0 6px 0 #15803d,
      0 0 40px rgba(40, 255, 110, 0.8);
    animation: blast 0.9s ease-out;
  }
  @keyframes zoom {
    from {
      transform: scale(2.2);
      opacity: 0;
    }
    35% {
      transform: scale(1);
      opacity: 1;
    }
  }
  @keyframes blast {
    from {
      transform: scale(0.4);
    }
    40% {
      transform: scale(1.35);
    }
    to {
      transform: scale(1.1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .word,
    .go-word,
    .lights.go {
      animation: none;
    }
  }
</style>
