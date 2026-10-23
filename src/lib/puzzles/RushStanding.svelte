<script lang="ts">
  /**
   * After a Puzzle Rush (owner, 2026-10-22: "see where they stand quickly"): my place on the Puzzle Rush board, the
   * top three and the players just around me, and how many more puzzles pass the next one.
   */
  import { onMount } from 'svelte';
  import { session, startSignIn } from '$lib/auth';
  import { boardOf } from '$lib/social';
  import { myName } from '$lib/stores/me';
  import { rushTitle } from './rewards';
  import { placeOf } from './rushPlace';
  import type { KfideLeader } from '$lib/social';
  import { t } from '$lib/i18n';

  /** `board`: the 3-minute Rush, or Rush Unlimited ('endless', its own board; owner, 2026-10-23). */
  let { best, board = 'rush' }: { best: number; board?: 'rush' | 'endless' } = $props();

  let rows = $state<KfideLeader[] | undefined>();
  let failed = $state(false);
  const signedIn = $derived($session.status === 'in');
  onMount(() => {
    if ($session.status !== 'in') return;
    boardOf(board).then(
      (r) => (rows = r),
      () => (failed = true),
    );
  });

  const place = $derived(rows && $session.status === 'in' && best > 0 ? placeOf(rows, best, { uid: $session.uid, name: $myName || $t('awards.stand.you') }) : undefined);
  /** The top three, then the two above me and the two below (with a gap between). */
  const shown = $derived.by(() => {
    if (!place) return [];
    const i = place.rank - 1;
    const keep = new Set([0, 1, 2, i - 2, i - 1, i, i + 1, i + 2].filter((k) => k >= 0 && k < place.list.length));
    return [...keep].sort((a, b) => a - b);
  });
  const above = $derived(place && place.rank > 1 ? place.list[place.rank - 2] : undefined);
  /** The board holds the top 100: past it, the 100th is the one to pass. */
  const outside = $derived(!!place && place.rank > 100);
  /** A sentence with *bold* parts (features/awards.ts): its parts in order, the odd ones bold, values filled in after. */
  const rich = (s: string, vars: Record<string, string | number> = {}) => s.split('*').map((part) => part.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')));
</script>

{#snippet bold(parts: string[])}{#each parts as part, i (i)}{#if i % 2}<b>{part}</b>{:else}{part}{/if}{/each}{/snippet}

<section class="stand" aria-labelledby="stand-h">
  <h3 id="stand-h">{$t('awards.stand.h')}</h3>
  {#if !signedIn}
    <p class="muted">{$t('awards.stand.signin', { n: best })}</p>
    <button class="btn" onclick={() => startSignIn()}>Sign in</button>
  {:else if failed}
    <p class="muted">{$t('awards.stand.failed')}</p>
  {:else if !rows}
    <p class="muted">{$t('awards.stand.finding')}</p>
  {:else if !place}
    <p class="muted">{$t('awards.stand.none')}</p>
  {:else}
    <p class="rank">
      {#if outside}
        {@render bold(rich($t('awards.stand.outside'), { n: place.list[99].rating - best + 1 }))}
      {:else if place.rank === 1}
        {@render bold(rich($t('awards.stand.first')))}
      {:else}
        {@render bold(rich(place.list.length <= 100 ? $t('awards.stand.rank.of') : $t('awards.stand.rank.top'), { rank: place.rank, n: place.list.length }))}{#if above}{@render bold(rich($t('awards.stand.pass'), { n: above.rating - best + 1, name: above.name }))}{/if}.
      {/if}
    </p>
    {#if !outside}
      <ol class="rows">
        {#each shown as k, j (k)}
          {@const r = place.list[k]}
          {#if j > 0 && k > shown[j - 1] + 1}<li class="gap" aria-hidden="true">⋯</li>{/if}
          <li class:me={r.me}>
            <span class="pos num">{['🥇', '🥈', '🥉'][k] ?? `#${k + 1}`}</span>
            <span class="who">{r.me ? $t('awards.stand.me', { name: r.name }) : r.name}</span>
            {#if board === 'rush' && rushTitle(r.rating)}<span class="t">{rushTitle(r.rating)}</span>{/if}
            <b class="num">{r.rating}</b>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
  <a class="all" href={board === 'endless' ? '/leaderboard#endless' : '/leaderboard#rush'}>{$t('awards.stand.all')}</a>
</section>

<style>
  .stand {
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--raised);
    text-align: left;
  }
  h3 {
    margin: 0;
    font: 700 16px var(--font-title);
  }
  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .rank {
    margin: 0;
    font-size: 15px;
  }
  .rank b {
    color: var(--gold);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rows li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 14px;
  }
  .rows li.me {
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    font-weight: 800;
  }
  .rows li.gap {
    justify-content: center;
    color: var(--muted);
    padding: 0;
  }
  .pos {
    width: 34px;
    flex: none;
  }
  .who {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .t {
    font-size: 11.5px;
    color: var(--muted);
    white-space: nowrap;
  }
  .all {
    align-self: center;
    font-weight: 700;
    font-size: 14px;
  }
</style>
