<script lang="ts">
  /** A friend's latest games on Chess Castles, each opening in Analyse with the full review. */
  import { goto } from '$app/navigation';
  import Icon from './Icon.svelte';
  import { friendGames } from '$lib/social';
  import { KIND_LABEL, outcome, pgnOfSaved, type SavedGame } from '$lib/stores/myGames';
  import { endWordsCap } from '$lib/game/endWords';
  import { formatDate } from '$lib/format';

  let { uid, name }: { uid: string; name: string } = $props();
  let games = $state<SavedGame[] | undefined>();

  $effect(() => {
    games = undefined;
    friendGames(uid).then(
      (g) => (games = g),
      () => (games = []),
    );
  });

  /** A player's own saved games call them "You": their name instead. */
  const theirs = (g: SavedGame): SavedGame => ({ ...g, white: g.white === 'You' ? name : g.white, black: g.black === 'You' ? name : g.black });

  function review(g: SavedGame) {
    sessionStorage.setItem('k24.importPgn', pgnOfSaved(theirs(g)));
    goto('/analysis?import=1&review=1');
  }
  const LETTER = { won: 'W', lost: 'L', draw: '½', unfinished: '–' } as const;
</script>

<section class="card fg">
  <h2 class="title">Games on Chess Castles</h2>
  {#if !games}
    <p class="label">Loading games…</p>
  {:else if !games.length}
    <p class="label">{name} has no finished games on Chess Castles yet.</p>
  {:else}
    <ul>
      {#each games as g (g.id)}
        {@const o = outcome(g)}
        <li>
          <span class="res {o}">{LETTER[o]}</span>
          <span class="t">
            <strong>vs {g.userSide === 'white' ? g.black : g.white}</strong>
            <span class="label">{KIND_LABEL[g.kind]}{g.timeControl ? ` · ${g.timeControl}` : ''} · {endWordsCap(g.reason)} · {formatDate(g.playedAt)}</span>
          </span>
          <button class="btn small" onclick={() => review(g)}><Icon name="analyse" size={15} />Review</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .fg {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fg h2 {
    margin: 0;
    font-size: 19px;
  }
  .fg p {
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .res {
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-weight: 800;
    background: var(--raised);
  }
  .res.won {
    background: color-mix(in srgb, var(--win) 25%, transparent);
    color: var(--win);
  }
  .res.lost {
    background: color-mix(in srgb, var(--loss) 22%, transparent);
    color: var(--loss);
  }
  .t {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .t .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .btn.small {
    min-height: 34px;
    padding: 0 12px;
    gap: 5px;
    font-size: 13.5px;
  }
</style>
