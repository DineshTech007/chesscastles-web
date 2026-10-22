<script lang="ts">
  /**
   * A Puzzle Racer vehicle, side view facing right, drawn here (no pictures to load): sports car, bus, jeep, scooter,
   * racing car, truck, taxi, rocket, tractor and police car, in the colour of its lane. Racing, the wheels turn; on a
   * combo, speed lines stream behind; the rocket's flame flickers and the police lights flash.
   */
  import { CARS } from './api';

  let { car = 0, size = 64, moving = false, boost = false }: { car?: number; size?: number; moving?: boolean; boost?: boolean } = $props();
  const c = $derived(CARS[car % CARS.length]);
</script>

{#snippet wheel(x: number, y: number, r: number)}
  <g class="wheel" style="transform-origin: {x}px {y}px">
    <circle cx={x} cy={y} r={r} fill="#1f2430" />
    <circle cx={x} cy={y} r={r * 0.55} fill="#cfd6e3" />
    <path d="M{x - r * 0.5} {y}h{r} M{x} {y - r * 0.5}v{r}" stroke="#6b7385" stroke-width={r * 0.18} />
    <circle cx={x} cy={y} r={r * 0.18} fill="#4b5263" />
  </g>
{/snippet}

<svg class="car" class:moving class:boost viewBox="0 0 64 32" width={size} height={size / 2} role="img" aria-label={c.name}>
  <defs>
    <linearGradient id="gloss-{car}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.45" />
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.05" />
      <stop offset="1" stop-color="#000" stop-opacity="0.25" />
    </linearGradient>
  </defs>
  {#if boost}
    <g class="speed" stroke={c.color} stroke-linecap="round">
      <path d="M1 12h7" stroke-width="1.6" />
      <path d="M-2 17h9" stroke-width="1.6" />
      <path d="M2 22h6" stroke-width="1.6" />
    </g>
  {/if}
  <ellipse cx="33" cy="29.5" rx="27" ry="1.8" fill="#000" opacity="0.28" />

  {#if c.kind === 'sports'}
    <path d="M5 23 L9 17 Q15 12.5 25 11.5 L37 11.5 Q43 11.5 49 15.5 L57 17.5 Q61 18.5 61 22 L61 24.5 L5 24.5 Z" fill={c.color} />
    <path d="M5 23 L9 17 Q15 12.5 25 11.5 L37 11.5 Q43 11.5 49 15.5 L57 17.5 Q61 18.5 61 22 L61 24.5 L5 24.5 Z" fill="url(#gloss-{car})" />
    <path d="M26 13 L36.5 13 Q41 13 45 16 L26 16 Z" fill="#bfe3ff" opacity="0.9" />
    <rect x="57" y="19" width="4" height="2" rx="1" fill="#fff7c2" />
    <rect x="5" y="19.5" width="3" height="2" rx="1" fill="#ff5a5a" />
    {@render wheel(16, 24.5, 5)}
    {@render wheel(50, 24.5, 5)}
  {:else if c.kind === 'bus'}
    <rect x="4" y="5" width="56" height="20" rx="4" fill={c.color} />
    <rect x="4" y="5" width="56" height="20" rx="4" fill="url(#gloss-{car})" />
    {#each [8, 17, 26, 35, 44] as x (x)}<rect {x} y="8" width="7" height="6.5" rx="1.2" fill="#bfe3ff" />{/each}
    <rect x="53" y="8" width="5.5" height="10" rx="1.2" fill="#bfe3ff" />
    <rect x="4" y="17" width="49" height="1.6" fill="#fff" opacity="0.7" />
    <rect x="57.5" y="20" width="2.5" height="2" rx="1" fill="#fff7c2" />
    {@render wheel(15, 25, 4.6)}
    {@render wheel(49, 25, 4.6)}
  {:else if c.kind === 'jeep'}
    <path d="M6 24.5 L6 15 Q6 13 8 13 L22 13 L26 8 L42 8 L44 13 L56 14.5 Q59 15 59 18 L59 24.5 Z" fill={c.color} />
    <path d="M6 24.5 L6 15 Q6 13 8 13 L22 13 L26 8 L42 8 L44 13 L56 14.5 Q59 15 59 18 L59 24.5 Z" fill="url(#gloss-{car})" />
    <path d="M27.5 9.5 L33 9.5 L33 13 L25.5 13 Z M35 9.5 L41 9.5 L42.3 13 L35 13 Z" fill="#bfe3ff" />
    <circle cx="4.5" cy="17" r="4" fill="#1f2430" /><circle cx="4.5" cy="17" r="2" fill="#5b6273" />
    <rect x="55" y="16" width="4" height="2" rx="1" fill="#fff7c2" />
    {@render wheel(16, 24.5, 5.4)}
    {@render wheel(48, 24.5, 5.4)}
  {:else if c.kind === 'scooter'}
    <path d="M14 22 Q16 15 26 15 L40 15 Q44 15 46 11 L49 6 L52 6.5 L48 16 Q46 22 40 22 Z" fill={c.color} />
    <path d="M14 22 Q16 15 26 15 L40 15 Q44 15 46 11 L49 6 L52 6.5 L48 16 Q46 22 40 22 Z" fill="url(#gloss-{car})" />
    <rect x="22" y="12.5" width="13" height="3" rx="1.5" fill="#2b2f3a" />
    <circle cx="29" cy="5.5" r="4" fill={c.color} /><path d="M27 5.5 h5" stroke="#bfe3ff" stroke-width="1.6" />
    <path d="M29 9.5 L31 15" stroke="#2b2f3a" stroke-width="2.2" stroke-linecap="round" />
    <path d="M50 6 h4" stroke="#2b2f3a" stroke-width="1.8" stroke-linecap="round" />
    {@render wheel(18, 24, 5)}
    {@render wheel(47, 24, 5)}
  {:else if c.kind === 'f1'}
    <path d="M4 21 L4 13 L9 13 L9 18 L22 18 L28 14 L38 14 L44 18 L58 19.5 Q62 20 62 22.5 L62 24 L4 24 Z" fill={c.color} />
    <path d="M4 21 L4 13 L9 13 L9 18 L22 18 L28 14 L38 14 L44 18 L58 19.5 Q62 20 62 22.5 L62 24 L4 24 Z" fill="url(#gloss-{car})" />
    <circle cx="33" cy="13" r="3.4" fill="#fde047" /><path d="M31 12.5 h4.5" stroke="#1f2430" stroke-width="1.3" />
    <rect x="55" y="23" width="8" height="2" rx="1" fill="#1f2430" />
    {@render wheel(15, 23.5, 6)}
    {@render wheel(51, 24.5, 4.8)}
  {:else if c.kind === 'truck'}
    <rect x="3" y="6" width="36" height="18.5" rx="2" fill={c.color} />
    <rect x="3" y="6" width="36" height="18.5" rx="2" fill="url(#gloss-{car})" />
    <path d="M40 24.5 L40 11 L51 11 L58 17 Q60 18 60 20 L60 24.5 Z" fill="#e5e7eb" />
    <path d="M42 13 L50 13 L55 17.5 L42 17.5 Z" fill="#bfe3ff" />
    <rect x="57" y="20" width="3" height="2" rx="1" fill="#fff7c2" />
    {@render wheel(12, 25, 4.6)}
    {@render wheel(27, 25, 4.6)}
    {@render wheel(51, 25, 4.6)}
  {:else if c.kind === 'taxi'}
    <path d="M5 24.5 L5 18.5 Q5 16.5 8 16 L15 15 L21 9.5 Q22.5 8.5 25 8.5 L40 8.5 Q42.5 8.5 44 10 L49 15 L57 16 Q60 16.5 60 19.5 L60 24.5 Z" fill={c.color} />
    <path d="M5 24.5 L5 18.5 Q5 16.5 8 16 L15 15 L21 9.5 Q22.5 8.5 25 8.5 L40 8.5 Q42.5 8.5 44 10 L49 15 L57 16 Q60 16.5 60 19.5 L60 24.5 Z" fill="url(#gloss-{car})" />
    <path d="M22.5 10.5 L31.5 10.5 L31.5 15 L17.5 15 Z M33.5 10.5 L42 10.5 L46.5 15 L33.5 15 Z" fill="#bfe3ff" />
    <rect x="26" y="4.5" width="12" height="4" rx="1" fill="#1f2430" /><text x="32" y="7.7" font-size="3.2" font-weight="900" fill="#fde047" text-anchor="middle">TAXI</text>
    {#each [0, 1, 2, 3, 4, 5, 6] as k (k)}<rect x={12 + k * 5} y="19" width="2.5" height="2.5" fill={k % 2 ? '#1f2430' : 'transparent'} />{/each}
    {@render wheel(16, 24.5, 5)}
    {@render wheel(49, 24.5, 5)}
  {:else if c.kind === 'rocket'}
    <g class="flame">
      <path d="M8 13.5 Q-2 16 8 18.5 Q3 16 8 13.5 Z" fill="#fde047" />
      <path d="M9 12 Q-6 16 9 20 Q2 16 9 12 Z" fill="#f97316" opacity="0.85" />
    </g>
    <path d="M9 11 L44 11 Q56 11 62 16 Q56 21 44 21 L9 21 Z" fill={c.color} />
    <path d="M9 11 L44 11 Q56 11 62 16 Q56 21 44 21 L9 21 Z" fill="url(#gloss-{car})" />
    <path d="M12 11 L6 4 L18 11 Z M12 21 L6 28 L18 21 Z" fill="#e5e7eb" />
    <circle cx="44" cy="16" r="3.2" fill="#bfe3ff" stroke="#fff" stroke-width="1" />
    <rect x="24" y="11" width="3" height="10" fill="#fff" opacity="0.65" />
  {:else if c.kind === 'tractor'}
    <path d="M16 22 L16 13 L24 13 L26 4 L40 4 L40 13 L54 14 Q58 14.5 58 18 L58 22 Z" fill={c.color} />
    <path d="M16 22 L16 13 L24 13 L26 4 L40 4 L40 13 L54 14 Q58 14.5 58 18 L58 22 Z" fill="url(#gloss-{car})" />
    <rect x="28" y="6" width="9.5" height="7" rx="1" fill="#bfe3ff" />
    <rect x="46" y="7.5" width="2.2" height="7" fill="#2b2f3a" />
    {@render wheel(22, 21.5, 8)}
    {@render wheel(52, 25, 4.6)}
  {:else}
    <path d="M5 24.5 L5 18.5 Q5 16.5 8 16 L15 15 L21 9.5 Q22.5 8.5 25 8.5 L40 8.5 Q42.5 8.5 44 10 L49 15 L57 16 Q60 16.5 60 19.5 L60 24.5 Z" fill="#f8fafc" />
    <path d="M5 18 L60 18 L60 22 L5 22 Z" fill={c.color} />
    <path d="M5 24.5 L5 18.5 Q5 16.5 8 16 L15 15 L21 9.5 Q22.5 8.5 25 8.5 L40 8.5 Q42.5 8.5 44 10 L49 15 L57 16 Q60 16.5 60 19.5 L60 24.5 Z" fill="url(#gloss-{car})" />
    <path d="M22.5 10.5 L31.5 10.5 L31.5 15 L17.5 15 Z M33.5 10.5 L42 10.5 L46.5 15 L33.5 15 Z" fill="#1e293b" opacity="0.8" />
    <rect class="siren red" x="27" y="5.5" width="5" height="3" rx="1" fill="#ef4444" />
    <rect class="siren blue" x="32" y="5.5" width="5" height="3" rx="1" fill="#3b82f6" />
    {@render wheel(16, 24.5, 5)}
    {@render wheel(49, 24.5, 5)}
  {/if}
</svg>

<style>
  .car {
    display: block;
    overflow: visible;
  }
  .moving :global(.wheel) {
    animation: spin 0.45s linear infinite;
  }
  .moving {
    animation: bob 0.5s ease-in-out infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes bob {
    50% {
      transform: translateY(-0.6px);
    }
  }
  .speed path {
    animation: whoosh 0.4s linear infinite;
  }
  .speed path:nth-child(2) {
    animation-delay: 0.13s;
  }
  .speed path:nth-child(3) {
    animation-delay: 0.26s;
  }
  @keyframes whoosh {
    from {
      transform: translateX(4px);
      opacity: 1;
    }
    to {
      transform: translateX(-6px);
      opacity: 0;
    }
  }
  .flame {
    transform-origin: 9px 16px;
    animation: flicker 0.18s ease-in-out infinite alternate;
  }
  @keyframes flicker {
    to {
      transform: scaleX(1.35);
    }
  }
  .siren {
    animation: siren 0.6s steps(1) infinite;
  }
  .siren.blue {
    animation-delay: 0.3s;
  }
  @keyframes siren {
    50% {
      opacity: 0.25;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .moving,
    .moving :global(.wheel),
    .speed path,
    .flame,
    .siren {
      animation: none;
    }
  }
</style>
