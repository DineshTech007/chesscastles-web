<script lang="ts">
  /** A small picture of each hero feature for the landing cards (drawn in SVG, in the site's colours). */
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import type { HeroId } from '$lib/heroFeatures';

  let { id }: { id: HeroId } = $props();
  const DB = [
    { m: 'e4', w: 38, d: 30, l: 32, n: '46%' },
    { m: 'd4', w: 36, d: 35, l: 29, n: '31%' },
    { m: 'Nf3', w: 35, d: 37, l: 28, n: '14%' },
    { m: 'c4', w: 37, d: 34, l: 29, n: '9%' },
  ];
  const AREAS = [
    { name: 'Openings', v: 0.72 },
    { name: 'Tactics', v: 0.84 },
    { name: 'Endgames', v: 0.38, weak: true },
    { name: 'Time use', v: 0.61 },
  ];
</script>

<div class="art">
  {#if id === 'guru'}
    <div class="guru">
      <GuruAvatar size={84} talking />
      <div class="bubble">
        <p>Great move! Now, what is the knight on f5 looking at?</p>
        <span class="langs"><span>EN</span><span>हिं</span><span>मरा</span></span>
      </div>
    </div>
  {:else}
    <svg viewBox="0 0 240 150" role="img" aria-hidden="true">
      {#if id === 'fide'}
        <rect x="8" y="22" width="92" height="86" rx="14" fill="var(--raised)" stroke="var(--border)" />
        <circle cx="54" cy="48" r="13" fill="var(--card)" stroke="var(--muted)" />
        <text x="54" y="80" class="t-sm" text-anchor="middle">You</text>
        <text x="54" y="99" class="t-num" text-anchor="middle">1650</text>
        <rect x="140" y="22" width="92" height="86" rx="14" fill="var(--raised)" stroke="var(--accent)" stroke-width="2" />
        <circle cx="186" cy="48" r="13" fill="var(--accent)" />
        <text x="186" y="53" class="t-sm on-accent" text-anchor="middle">FIDE</text>
        <text x="186" y="80" class="t-sm" text-anchor="middle">Opponent</text>
        <text x="186" y="99" class="t-num accent" text-anchor="middle">1800</text>
        <circle cx="120" cy="65" r="16" fill="var(--card)" stroke="var(--accent)" stroke-width="2" />
        <text x="120" y="70" class="t-vs" text-anchor="middle">VS</text>
        <rect x="26" y="118" width="56" height="22" rx="11" fill="var(--card)" stroke="var(--border)" />
        <text x="54" y="133" class="t-clock" text-anchor="middle">4:32</text>
        <rect x="158" y="118" width="56" height="22" rx="11" fill="var(--accent)" />
        <text x="186" y="133" class="t-clock on-accent" text-anchor="middle">4:51</text>
      {:else if id === 'database'}
        <text x="10" y="20" class="t-num accent">5,412,371</text>
        <text x="122" y="20" class="t-sm">games in this position</text>
        {#each DB as r, i (r.m)}
          {@const y = 36 + i * 28}
          <text x="10" y={y + 13} class="t-move">{r.m}</text>
          <rect x="46" y={y} width={1.4 * r.w} height="18" rx="4" fill="var(--win)" />
          <rect x={46 + 1.4 * r.w} y={y} width={1.4 * r.d} height="18" fill="var(--muted)" opacity="0.55" />
          <rect x={46 + 1.4 * (r.w + r.d)} y={y} width={1.4 * r.l} height="18" rx="4" fill="var(--loss)" opacity="0.85" />
          <text x="236" y={y + 13} class="t-sm" text-anchor="end">{r.n}</text>
        {/each}
      {:else if id === 'openings'}
        <g stroke="var(--accent)" stroke-width="2" fill="none" opacity="0.8">
          <path d="M120 34 C120 52 50 48 50 70" />
          <path d="M120 34 L120 70" />
          <path d="M120 34 C120 52 190 48 190 70" />
          <path d="M50 92 C50 106 30 104 30 118" />
          <path d="M50 92 C50 106 72 104 72 118" />
        </g>
        <rect x="94" y="10" width="52" height="24" rx="12" fill="var(--accent)" />
        <text x="120" y="27" class="t-move on-accent" text-anchor="middle">1.e4</text>
        {#each [['50', 'c5'], ['120', 'e5'], ['190', 'e6']] as [x, m] (m)}
          <rect x={Number(x) - 24} y="70" width="48" height="22" rx="11" fill="var(--raised)" stroke="var(--border)" />
          <text x={x} y="86" class="t-move" text-anchor="middle">{m}</text>
        {/each}
        {#each [{ x: 30, m: 'Nf3', ok: true }, { x: 72, m: 'Nc3', ok: false }] as n (n.m)}
          <rect x={n.x - 22} y="118" width="44" height="22" rx="11" fill={n.ok ? 'var(--win)' : 'var(--raised)'} stroke="var(--border)" />
          <text x={n.x} y="134" class="t-move" class:on-accent={n.ok} text-anchor="middle">{n.m}</text>
        {/each}
        <g transform="translate(160 106)">
          <rect width="72" height="38" rx="10" fill="var(--card)" stroke="var(--accent)" />
          <text x="36" y="17" class="t-sm" text-anchor="middle">Due today</text>
          <text x="36" y="31" class="t-move accent" text-anchor="middle">12 lines</text>
        </g>
      {:else if id === 'insights'}
        <circle cx="52" cy="68" r="38" fill="none" stroke="var(--raised)" stroke-width="12" />
        <circle cx="52" cy="68" r="38" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray="{0.78 * 238.8} 238.8" transform="rotate(-90 52 68)" />
        <text x="52" y="72" class="t-num" text-anchor="middle">78%</text>
        <text x="52" y="128" class="t-sm" text-anchor="middle">accuracy</text>
        {#each AREAS as a, i (a.name)}
          {@const y = 26 + i * 28}
          <text x="108" y={y} class="t-sm">{a.name}{a.weak ? ' · fix this' : ''}</text>
          <rect x="108" y={y + 5} width="124" height="9" rx="4.5" fill="var(--raised)" />
          <rect x="108" y={y + 5} width={124 * a.v} height="9" rx="4.5" fill={a.weak ? 'var(--loss)' : 'var(--accent)'} />
        {/each}
      {/if}
    </svg>
  {/if}
</div>

<style>
  .art {
    width: 100%;
    aspect-ratio: 240 / 150;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  text {
    fill: var(--text);
    font-family: inherit;
  }
  .t-sm {
    font-size: 11px;
    fill: var(--text-2);
  }
  .t-num {
    font-size: 20px;
    font-weight: 800;
  }
  .t-move {
    font-size: 12.5px;
    font-weight: 700;
  }
  .t-vs {
    font-size: 12px;
    font-weight: 900;
    fill: var(--accent);
  }
  .t-clock {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .accent {
    fill: var(--accent);
  }
  .on-accent {
    fill: var(--on-action);
  }
  .guru {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .bubble {
    position: relative;
    flex: 1;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--raised);
    border: 1px solid var(--border);
  }
  .bubble::before {
    content: '';
    position: absolute;
    left: -7px;
    top: 22px;
    width: 12px;
    height: 12px;
    background: var(--raised);
    border-left: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    transform: rotate(45deg);
  }
  .bubble p {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .langs {
    display: flex;
    gap: 6px;
  }
  .langs span {
    font-size: 11.5px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }
</style>
