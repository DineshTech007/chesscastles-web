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

  let { best }: { best: number } = $props();

  let rows = $state<KfideLeader[] | undefined>();
  let failed = $state(false);
  const signedIn = $derived($session.status === 'in');
  onMount(() => {
    if ($session.status !== 'in') return;
    boardOf('rush').then(
      (r) => (rows = r),
      () => (failed = true),
    );
  });

  const place = $derived(rows && $session.status === 'in' && best > 0 ? placeOf(rows, best, { uid: $session.uid, name: $myName || 'You' }) : undefined);
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
</script>

<section class="stand" aria-labelledby="stand-h">
  <h3 id="stand-h">Where you stand</h3>
  {#if !signedIn}
    <p class="muted">Sign in to put your best ({best}) on the Puzzle Rush leaderboard and see your place.</p>
    <button class="btn" onclick={() => startSignIn()}>Sign in</button>
  {:else if failed}
    <p class="muted">The leaderboard is not reachable right now.</p>
  {:else if !rows}
    <p class="muted">Finding your place…</p>
  {:else if !place}
    <p class="muted">Solve a puzzle in a rush to get on the leaderboard.</p>
  {:else}
    <p class="rank">
      {#if outside}
        Outside the top 100: <b>{place.list[99].rating - best + 1}</b> more to get in.
      {:else if place.rank === 1}
        <b>You are #1</b> on the Puzzle Rush leaderboard! 👑
      {:else}
        <b>You are #{place.rank}</b> {place.list.length <= 100 ? `of ${place.list.length}` : 'in the top 100'}{#if above}: <b>{above.rating - best + 1}</b> more to pass {above.name}{/if}.
      {/if}
    </p>
    {#if !outside}
      <ol class="rows">
        {#each shown as k, j (k)}
          {@const r = place.list[k]}
          {#if j > 0 && k > shown[j - 1] + 1}<li class="gap" aria-hidden="true">⋯</li>{/if}
          <li class:me={r.me}>
            <span class="pos num">{['🥇', '🥈', '🥉'][k] ?? `#${k + 1}`}</span>
            <span class="who">{r.me ? `${r.name} (you)` : r.name}</span>
            {#if rushTitle(r.rating)}<span class="t">{rushTitle(r.rating)}</span>{/if}
            <b class="num">{r.rating}</b>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
  <a class="all" href="/leaderboard#rush">See the whole leaderboard →</a>
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
