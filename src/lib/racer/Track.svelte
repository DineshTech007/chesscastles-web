<script lang="ts">
  /**
   * The race track (Puzzle Racer): one lane per racer, red-and-white kerbs, the chequered start and finish, a flag
   * waving at the finish. Each car drives along its lane as its score grows (the leader near the flag); the scores
   * stand on the right, the leader's in gold, mine highlighted.
   */
  import Car from './Car.svelte';
  import type { CarView, Phase } from './api';

  let { cars, me, phase, seconds = 90 }: { cars: CarView[]; me: string; phase: Phase; seconds?: number } = $props();

  const lanes = $derived([...cars].sort((a, b) => a.car - b.car));
  const top = $derived(Math.max(0, ...cars.map((c) => c.score)));
  /**
   * The finish: about what a good young racer scores in this race (a point every 6 seconds), moved on once the leader
   * gets near it, so every point visibly moves a car and the leader never leaves the road.
   */
  const target = $derived(Math.max(Math.ceil(seconds / 6), Math.ceil(top * 1.15)));
  const rankOf = $derived(new Map([...cars].sort((a, b) => b.score - a.score || b.solved - a.solved).map((c, i) => [c.uid, i + 1])));
</script>

<div class="track" class:racing={phase === 'racing'} aria-label="The race">
  <div class="kerb"></div>
  <div class="lanes">
    <div class="start" aria-hidden="true"></div>
    <div class="finish" aria-hidden="true">
      <svg class="flag" viewBox="0 0 32 40" width="26" height="32" aria-hidden="true">
        <rect x="2" y="2" width="2.2" height="37" rx="1" fill="#d6dbe6" />
        <g class="cloth">
          {#each [0, 1, 2, 3] as r (r)}{#each [0, 1, 2, 3, 4] as k (k)}<rect x={4.2 + k * 5} y={3 + r * 4.4} width="5" height="4.4" fill={(r + k) % 2 ? '#111' : '#fff'} />{/each}{/each}
        </g>
      </svg>
    </div>
    {#each lanes as c (c.uid)}
      {@const pct = Math.min(1, c.score / target)}
      {@const rank = rankOf.get(c.uid) ?? 0}
      <div class="lane" class:me={c.uid === me} class:off={!c.online && !c.bot}>
        <div class="road">
          <div class="rider" style="--p: {pct}">
            <span class="tag">{c.uid === me ? 'You' : c.name}{c.bot ? ' 🤖' : ''}</span>
            <Car car={c.car} size={58} moving={phase === 'racing'} boost={phase === 'racing' && c.combo >= 5} />
            {#if phase === 'over' && rank === 1 && top > 0}<span class="cup" aria-label="Winner">🏆</span>{/if}
          </div>
        </div>
        <span class="score num" class:lead={rank === 1 && top > 0}>{c.score}</span>
      </div>
    {/each}
  </div>
  <div class="kerb"></div>
</div>

<style>
  .track {
    border-radius: 16px;
    overflow: hidden;
    background: #2f6b2f;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
  }
  .kerb {
    height: 7px;
    background: repeating-linear-gradient(90deg, #e53935 0 16px, #fafafa 16px 32px);
  }
  .racing .kerb {
    animation: kerb 0.6s linear infinite;
  }
  @keyframes kerb {
    to {
      background-position: -32px 0;
    }
  }
  .lanes {
    position: relative;
    background: linear-gradient(180deg, #3a3f4b, #2c313b);
  }
  .start,
  .finish {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 10px;
    z-index: 1;
    background:
      repeating-conic-gradient(#fff 0 25%, #111 0 50%) 0 0 / 10px 10px;
    opacity: 0.85;
  }
  .start {
    left: 66px;
  }
  .finish {
    right: 46px;
  }
  .flag {
    position: absolute;
    top: -2px;
    left: -2px;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
  }
  .cloth {
    transform-origin: 4px 10px;
    animation: wave 1.1s ease-in-out infinite alternate;
  }
  @keyframes wave {
    from {
      transform: skewY(-6deg) scaleX(0.94);
    }
    to {
      transform: skewY(5deg) scaleX(1);
    }
  }
  .lane {
    position: relative;
    display: flex;
    align-items: center;
    height: 42px;
    border-bottom: 2px dashed rgba(255, 255, 255, 0.18);
  }
  .lane:last-child {
    border-bottom: 0;
  }
  .lane.me {
    background: linear-gradient(90deg, rgba(242, 193, 78, 0.18), rgba(242, 193, 78, 0.05));
    box-shadow: inset 3px 0 0 #f2c14e;
  }
  .lane.off {
    opacity: 0.5;
  }
  .road {
    position: relative;
    flex: 1;
    height: 100%;
  }
  /* A car's place: from the start line to just before the flag. */
  .rider {
    position: absolute;
    top: 50%;
    left: calc(8px + var(--p) * (100% - 74px));
    transform: translateY(-46%);
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: left 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 2;
  }
  .tag {
    position: absolute;
    top: -9px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font: 700 10.5px var(--font-body);
    color: #e9edf6;
    text-shadow: 0 1px 2px #000;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .me .tag {
    color: #f7d27a;
  }
  .cup {
    position: absolute;
    right: -18px;
    top: 4px;
    font-size: 18px;
    animation: pop 0.6s ease-out;
  }
  @keyframes pop {
    from {
      transform: scale(0);
    }
    70% {
      transform: scale(1.4);
    }
  }
  .score {
    flex: none;
    width: 44px;
    text-align: center;
    font: 800 20px/1 'Barlow Condensed', var(--font-title);
    color: #ffb84d;
    text-shadow: 0 0 8px rgba(255, 160, 40, 0.45);
    background: rgba(0, 0, 0, 0.35);
    align-self: stretch;
    display: grid;
    place-items: center;
  }
  .score.lead {
    color: #ffe08a;
    text-shadow: 0 0 10px rgba(255, 210, 90, 0.8);
  }
  @media (max-width: 600px) {
    .lane {
      height: 36px;
    }
    .start {
      left: 56px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .racing .kerb,
    .cloth,
    .cup {
      animation: none;
    }
    .rider {
      transition: none;
    }
  }
</style>
