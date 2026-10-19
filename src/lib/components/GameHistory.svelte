<script lang="ts">
  import Icon from './Icon.svelte';
  import { formatDate } from '$lib/format';
  import { KIND_LABEL, myGames, opponentOf, outcome, type SavedGame } from '$lib/stores/myGames';
  import { kfideAll, shownGames } from '$lib/stores/me';
  import { gameRating, ratingText } from '$lib/stores/gameRatings';

  let { limit = 10, title = 'Game history' }: { limit?: number; title?: string } = $props();
  const games = $derived($shownGames.slice(0, limit));
  const LETTER = { won: 'W', lost: 'L', draw: 'D', unfinished: '–' } as const;
  const moves = (g: SavedGame) => Math.ceil(g.uci.length / 2);
</script>

<section class="history card" aria-labelledby="history-h">
  <div class="head">
    <h2 id="history-h" class="title">{title}</h2>
    {#if $shownGames.length > limit}<a href="/games">All {$shownGames.length} games</a>{/if}
  </div>
  {#if !games.length}
    <p class="label empty">No games yet. Your games appear here as soon as you play.</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Result</th>
            <th scope="col">You</th>
            <th scope="col">Opponent</th>
            <th scope="col" class="hide-s">Type</th>
            <th scope="col" class="hide-s">Time</th>
            <th scope="col" class="num-col">Moves</th>
            <th scope="col" class="hide-s">Date</th>
            <th scope="col"><span class="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {#each games as g (g.id)}
            {@const o = outcome(g)}
            {@const gr = gameRating(g, $kfideAll)}
            <tr>
              <td><span class="res {o}" title={o}>{LETTER[o]}</span></td>
              <td class="you num" title={gr.label ? `Your ${gr.label} rating in this game` : ''}>{ratingText(gr) || '—'}</td>
              <td class="who">
                <span class="side {g.userSide === 'white' ? 'black' : 'white'}" aria-hidden="true"></span>
                {opponentOf(g)}
                {#if g.opponentRating && g.kind !== 'computer'}<span class="label">({g.opponentRating})</span>{/if}
              </td>
              <td class="hide-s label">{KIND_LABEL[g.kind]}</td>
              <td class="hide-s label">{g.timeControl || '—'}</td>
              <td class="num-col num">{moves(g)}</td>
              <td class="hide-s label">{formatDate(g.playedAt)}</td>
              <td class="go">
                <a class="btn small" href="/analysis?game={g.id}"><Icon name="analyse" size={16} />Analyse</a>
                <a class="btn small guru" href="/coach/review/{g.id}"><Icon name="coach" size={16} />Review with Guru</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .go {
    white-space: nowrap;
  }
  .you {
    white-space: nowrap;
    color: var(--text-2);
  }
  .go .guru {
    margin-left: 6px;
  }
  .history {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px 18px 8px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .title {
    font-size: 19px;
  }
  .empty {
    margin: 0 0 10px;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14.5px;
  }
  th {
    text-align: left;
    font-weight: 500;
    font-size: 12.5px;
    color: var(--muted);
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 8px;
    border-bottom: 1px solid var(--border-soft);
    white-space: nowrap;
  }
  tr:last-child td {
    border-bottom: 0;
  }
  tbody tr:hover {
    background: var(--raised);
  }
  .res {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid currentColor;
    font-family: var(--font-title);
    font-weight: 700;
  }
  .res.won {
    color: var(--win);
  }
  .res.lost {
    color: var(--loss);
  }
  .res.draw {
    color: var(--accent);
  }
  .res.unfinished {
    color: var(--muted);
  }
  .who {
    font-weight: 600;
  }
  .side {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1px solid var(--muted);
    margin-right: 6px;
    vertical-align: -1px;
  }
  .side.white {
    background: #eef3ff;
  }
  .side.black {
    background: #0e1525;
  }
  .num-col {
    text-align: right;
  }
  .go {
    text-align: right;
  }
  .btn.small {
    min-height: 34px;
    padding: 0 10px;
    font-size: 14px;
  }
  @media (max-width: 640px) {
    .hide-s {
      display: none;
    }
  }
</style>
