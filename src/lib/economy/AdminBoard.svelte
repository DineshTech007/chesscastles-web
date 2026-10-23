<script lang="ts">
  /**
   * Richest castles, for admins only (owner, 2026-10-23: "keep the leaderboard only for admin"): the top players by
   * gold earned (all time) or gems held, so the team can see who earns a lot and look for a loop. The server refuses
   * anyone else (server/api-worker src/social.ts), and shows these only under their own name: it never falls back to
   * another board (a Gems tab once showed CC Ratings when the site and the server were a deploy apart).
   */
  import { boardOf } from '$lib/social';
  import { fmt } from './ui';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';

  type Row = { uid: string; name: string; username: string; rating: number; games: number };
  let kind = $state<'gold' | 'gems'>('gems');
  let rows = $state<Row[] | undefined>();
  let failed = $state(false);
  $effect(() => {
    const k = kind;
    rows = undefined;
    failed = false;
    boardOf(k).then(
      (r) => {
        if (kind === k) rows = r as Row[];
      },
      () => {
        if (kind === k) failed = true;
      },
    );
  });
</script>

<section class="ab" aria-labelledby="ab-h">
  <div class="head">
    <h2 id="ab-h" class="title">Richest castles <span class="only">admins only</span></h2>
    <div class="tabs" role="tablist" aria-label="Richest castles">
      <button role="tab" aria-selected={kind === 'gold'} class:on={kind === 'gold'} onclick={() => (kind = 'gold')}><Coin size={14} />Gold earned</button>
      <button role="tab" aria-selected={kind === 'gems'} class:on={kind === 'gems'} onclick={() => (kind = 'gems')}><Gem size={13} />Gems</button>
    </div>
  </div>
  {#if failed}
    <p class="muted">Could not load.</p>
  {:else if !rows}
    <p class="muted">Loading…</p>
  {:else if !rows.length}
    <p class="muted">Nobody yet.</p>
  {:else}
    <ol>
      {#each rows.slice(0, 15) as r, i (r.uid)}
        <li>
          <span class="m">{i + 1}</span>
          <a class="n" href="/players/{encodeURIComponent(r.uid)}">{r.name}</a>
          <span class="s">{r.games} items</span>
          <strong class="v num">{#if kind === 'gold'}<Coin size={13} />{:else}<Gem size={12} />{/if}{fmt.format(r.rating)}</strong>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .ab {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: 20px;
    border: 1px dashed color-mix(in srgb, var(--gold) 45%, var(--border));
    background: var(--card);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  h2 {
    margin: 0;
    font-size: 17px;
  }
  .only {
    font: 700 11px var(--font-body);
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 7px;
    margin-left: 6px;
    vertical-align: middle;
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--muted);
    border-radius: 999px;
    padding: 4px 10px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--action);
    color: var(--on-action);
    border-color: transparent;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 2px;
  }
  .m {
    width: 22px;
    text-align: center;
    color: var(--muted);
    font-weight: 800;
  }
  .n {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
    font-weight: 700;
    text-decoration: none;
  }
  .s {
    color: var(--muted);
    font-size: 12px;
  }
  .v {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
  }
  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
