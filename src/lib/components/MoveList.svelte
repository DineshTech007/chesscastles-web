<script lang="ts">
  import type { MoveSource } from '$lib/bot/fideBot';
  import type { MoveClass } from '$lib/review/badges';
  import MoveBadge from '$lib/review/MoveBadge.svelte';
  import { revealIn } from '$lib/scroll';

  let {
    sans,
    sources = [],
    current,
    onselect,
    badges = [],
    times = [],
  }: {
    sans: string[];
    /** Per ply, where a bot move came from (undefined for the player's). */
    sources?: (MoveSource | undefined)[];
    /** The ply shown on the board (sans.length = the latest). */
    current?: number;
    onselect?: (ply: number) => void;
    /** Per ply, the review badge (brilliant … blunder), once the game is reviewed. */
    badges?: (MoveClass | undefined)[];
    /** Per ply, how long the move took (ms): a bar and the time beside each row, as on chess.com. */
    times?: (number | undefined)[];
  } = $props();

  let box: HTMLDivElement;
  const rows = $derived(
    Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => ({ no: i + 1, w: 2 * i, b: 2 * i + 1 })),
  );
  const at = $derived(current ?? sans.length);
  const DOT: Record<MoveSource, string> = { book: 'var(--win)', opening: 'var(--accent)', engine: 'var(--engine)' };
  const timed = $derived(times.some((t) => t !== undefined));
  const longest = $derived(Math.max(1000, ...times.map((t) => t ?? 0)));
  /** 0.4s, 7.6s, 37s, 1:05. */
  const fmt = (ms: number) => (ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}:${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}`);

  $effect(() => {
    void sans.length;
    void at;
    queueMicrotask(() => revealIn(box, box?.querySelector('.cur')));
  });
</script>

<div class="moves" class:timed bind:this={box} role="list" aria-label="Moves">
  {#if !sans.length}
    <p class="empty label">No moves yet</p>
  {/if}
  {#each rows as r (r.no)}
    <div class="row" role="listitem">
      <span class="no num">{r.no}.</span>
      {#each [r.w, r.b] as ply (ply)}
        {#if ply < sans.length}
          <button class="mv" class:cur={ply + 1 === at} onclick={() => onselect?.(ply + 1)} disabled={!onselect}>
            {#if sources[ply]}<span class="src" style="background: {DOT[sources[ply]!]}" title="From {sources[ply]}"></span>{/if}
            {sans[ply]}
            {#if badges[ply] && badges[ply] !== 'good'}<MoveBadge kind={badges[ply]!} size={24} />{/if}
          </button>
        {:else}
          <span class="mv"></span>
        {/if}
      {/each}
      {#if timed}
        <span class="tm" aria-hidden="true">
          {#each [r.w, r.b] as ply (ply)}
            {#if ply < sans.length && times[ply] !== undefined}
              <span class="t"><i class:b={ply % 2 === 1} style="width: {Math.max(3, Math.round((times[ply]! / longest) * 100))}%"></i><b class="num">{fmt(times[ply]!)}</b></span>
            {:else}
              <span class="t"></span>
            {/if}
          {/each}
        </span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .moves {
    overflow-y: auto;
    padding: 6px 0;
    font-size: 15px;
  }
  .empty {
    padding: 8px 14px;
    margin: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 40px 1fr 1fr;
    align-items: center;
    padding: 1px 10px;
  }
  .row:nth-child(even) {
    background: color-mix(in srgb, var(--text) 3%, transparent);
  }
  .timed .row {
    grid-template-columns: 34px 1fr 1fr 74px;
  }
  .no {
    color: var(--muted);
  }
  /* Each move's time: a bar (as long as the move took, against the longest) and the time, White's above Black's. */
  .tm {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .t {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 13px;
  }
  .t i {
    display: block;
    max-width: 34px;
    height: 7px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text) 70%, transparent);
  }
  .t i.b {
    background: color-mix(in srgb, var(--text) 35%, transparent);
  }
  .t b {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--muted);
  }
  .mv {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .mv :global(.badge) {
    margin-left: auto;
  }
  .mv:disabled {
    cursor: default;
  }
  .mv:not(:disabled):hover {
    background: var(--raised);
  }
  .mv.cur {
    background: color-mix(in srgb, var(--brand) 30%, transparent);
  }
  .src {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
</style>
