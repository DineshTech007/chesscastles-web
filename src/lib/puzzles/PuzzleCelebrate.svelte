<script lang="ts">
  /**
   * A moment to remember, over the page: a new level (its trophy, "Level up!"), the level found after placement
   * (`found`: the rating revealed) or a new badge (its medal). A tap anywhere, or a few seconds, and it goes; the
   * next one in line (several can come at once) follows.
   */
  import { onMount } from 'svelte';
  import Medal from './Medal.svelte';
  import type { Badge } from './rewards';

  let { level, found, badge, onclose }: { level?: { name: string; image: string }; found?: number; badge?: Badge; onclose: () => void } = $props();
  const COLORS = ['#f2c14e', '#edb040', '#38d2ff', '#22c55e', '#f472b6', '#ffffff', '#a78bfa'];
  // svelte-ignore state_referenced_locally
  const bits = Array.from({ length: level ? 44 : 22 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.6 + Math.random() * 1.2,
    drift: (Math.random() - 0.5) * 90,
    spin: (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 500),
    c: COLORS[i % COLORS.length],
  }));
  onMount(() => {
    const t = setTimeout(onclose, level ? 5200 : 4000);
    return () => clearTimeout(t);
  });
</script>

<button class="cel" onclick={onclose} aria-label="Close">
  <span class="confetti" aria-hidden="true">
    {#each bits as b, i (i)}<i style="left: {b.x}%; background: {b.c}; animation-delay: {b.delay}s; animation-duration: {b.dur}s; --drift: {b.drift}px; --spin: {b.spin}deg"></i>{/each}
  </span>
  <span class="card" role="status">
    {#if level}
      <span class="glow" aria-hidden="true"></span>
      <img class="trophy" src={level.image} alt="" width="150" height="150" />
      {#if found !== undefined}
        <strong class="display head">Level found!</strong>
        <span class="sub">Your puzzle rating is <b class="num">{found}</b>: <b>{level.name}</b> level</span>
      {:else}
        <strong class="display head">Level up!</strong>
        <span class="sub">You reached <b>{level.name}</b> level</span>
      {/if}
    {:else if badge}
      <span class="glow" aria-hidden="true"></span>
      <span class="medal-wrap"><Medal {badge} size={150} /></span>
      <strong class="display head">New badge!</strong>
      <span class="sub"><b>{badge.name}</b>{#if badge.hint} · {badge.hint}{/if}</span>
    {/if}
    <span class="tap">Tap to keep going</span>
  </span>
</button>

<style>
  .cel {
    position: fixed;
    inset: 0;
    z-index: 95;
    display: grid;
    place-items: center;
    padding: 16px;
    border: 0;
    background: rgba(5, 8, 20, 0.72);
    color: #eef3ff;
    font: inherit;
    cursor: pointer;
    animation: fade 0.25s ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: min(340px, 100%);
    padding: 26px 20px 20px;
    border-radius: 26px;
    border: 1px solid rgba(242, 193, 78, 0.6);
    background:
      radial-gradient(90% 70% at 50% 0%, rgba(242, 193, 78, 0.28), transparent 70%),
      #111c36;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    text-align: center;
    animation: pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
  }
  .glow {
    position: absolute;
    top: 10px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, rgba(242, 193, 78, 0), rgba(242, 193, 78, 0.35), rgba(242, 193, 78, 0), rgba(242, 193, 78, 0.35), rgba(242, 193, 78, 0));
    animation: turn 6s linear infinite;
    filter: blur(6px);
  }
  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }
  .trophy,
  .medal-wrap {
    position: relative;
    animation: bounce 0.8s cubic-bezier(0.2, 1.5, 0.4, 1) 0.1s both;
  }
  .trophy {
    width: 150px;
    height: 150px;
    object-fit: contain;
    filter: drop-shadow(0 14px 22px rgba(0, 0, 0, 0.5));
  }
  @keyframes bounce {
    from {
      transform: translateY(30px) scale(0.5);
      opacity: 0;
    }
  }
  .head {
    position: relative;
    margin-top: 6px;
    font-size: 40px;
    line-height: 1;
    background: linear-gradient(180deg, #ffe39a, #edb040 60%, #c98a1b);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .sub {
    position: relative;
    font-size: 16px;
    color: #b4c0dc;
  }
  .sub b {
    color: #eef3ff;
  }
  .tap {
    margin-top: 10px;
    font-size: 12.5px;
    color: #8c9bbe;
  }
  .confetti {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .confetti i {
    position: absolute;
    top: -16px;
    width: 9px;
    height: 13px;
    border-radius: 2px;
    opacity: 0;
    animation-name: fall;
    animation-timing-function: cubic-bezier(0.25, 0.6, 0.5, 1);
    animation-fill-mode: forwards;
  }
  @keyframes fall {
    0% {
      opacity: 1;
      transform: translate(0, 0) rotate(0);
    }
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--drift), 100vh) rotate(var(--spin));
    }
  }
</style>
