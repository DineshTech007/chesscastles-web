<script lang="ts">
  /**
   * All-time stats on the profile: results (won, drawn, lost) from the games
   * on this device, and how the player plays from their reviewed games:
   * accuracy, each part of the game and kind of position, the moves to be
   * proud of and the slips per game, each with the change in the latest games.
   */
  import { onMount } from 'svelte';
  import { keptReviews } from '$lib/coach/review';
  import { opponentOf, type SavedGame } from '$lib/stores/myGames';
  import MoveBadge from './MoveBadge.svelte';
  import { BADGES, type MoveClass } from './badges';
  import { AREAS, markOf } from './report';
  import { results, reviewedGames, style, type SideFilter } from './allTime';

  let { games }: { games: SavedGame[] } = $props();

  let side = $state<SideFilter>('all');
  let kept = $state<ReturnType<typeof keptReviews>>([]);
  onMount(() => (kept = keptReviews()));

  const res = $derived(results(games, side));
  const st = $derived(style(reviewedGames(games, kept), side));
  const pct = (n: number) => (res.games ? Math.round((100 * n) / res.games) : 0);
  const SIDES: [SideFilter, string][] = [
    ['all', 'All games'],
    ['white', 'As White'],
    ['black', 'As Black'],
  ];
  const asText = $derived(side === 'all' ? '' : side === 'white' ? ' as White' : ' as Black');
  const SLIPS: [MoveClass, string][] = [
    ['inaccuracy', 'Inaccuracies'],
    ['mistake', 'Mistakes'],
    ['miss', 'Missed wins'],
    ['blunder', 'Blunders'],
  ];
  const perGame = (k: MoveClass) => (st ? (st.classes[k] ?? 0) / st.games : 0);
</script>

{#snippet change(d: number | undefined, what: string)}
  {#if d !== undefined && d !== 0}
    <span class="chg" class:up={d > 0} class:down={d < 0} title="{what} in your last {st?.recent} games against the ones before">
      <span aria-hidden="true">{d > 0 ? '▲' : '▼'}</span>{Math.abs(d)}<span class="sr">{d > 0 ? ' up' : ' down'} in your last {st?.recent} games</span>
    </span>
  {/if}
{/snippet}

<section class="card stats" aria-labelledby="stats-h">
  <div class="top">
    <h2 id="stats-h" class="title">All-time stats</h2>
    <div class="seg" role="group" aria-label="Games played as">
      {#each SIDES as [v, l] (v)}<button class:on={side === v} aria-pressed={side === v} onclick={() => (side = v)}>{l}</button>{/each}
    </div>
  </div>

  {#if res.games}
    <div class="results">
      <div class="count"><strong class="display num">{res.games}</strong><span class="label">{res.games === 1 ? 'game' : 'games'}{asText}</span></div>
      <div class="wdl">
        <div class="bar" role="img" aria-label="Won {res.won}, drawn {res.drawn}, lost {res.lost}">
          {#if res.won}<span class="won" style="flex-grow: {res.won}"></span>{/if}
          {#if res.drawn}<span class="drawn" style="flex-grow: {res.drawn}"></span>{/if}
          {#if res.lost}<span class="lost" style="flex-grow: {res.lost}"></span>{/if}
        </div>
        <div class="wdl-legend">
          <span><i class="won"></i>Won <strong class="num">{res.won}</strong> <span class="label num">{pct(res.won)}%</span></span>
          <span><i class="drawn"></i>Drawn <strong class="num">{res.drawn}</strong> <span class="label num">{pct(res.drawn)}%</span></span>
          <span><i class="lost"></i>Lost <strong class="num">{res.lost}</strong> <span class="label num">{pct(res.lost)}%</span></span>
        </div>
      </div>
    </div>
  {:else}
    <p class="label">No finished games{asText} on this device yet. Play one and your stats start here.</p>
  {/if}

  <h3 class="sub title">How you play</h3>
  {#if st}
    <p class="label">From your {st.games} reviewed {st.games === 1 ? 'game' : 'games'}{asText}.{#if st.recent} The arrows compare your last {st.recent} games with the ones before.{/if}</p>
    <div class="tiles">
      <div class="tile">
        <span class="label">Accuracy</span>
        <span class="val"><strong class="display num">{st.accuracy}%</strong>{@render change(st.accuracyChange, 'Accuracy')}</span>
      </div>
      <div class="tile">
        <span class="label">Best game</span>
        <span class="val"><strong class="display num">{st.best.accuracy}%</strong></span>
        <span class="label small">vs {opponentOf(st.best.game)}</span>
      </div>
      <div class="tile">
        <span class="label"><MoveBadge kind="brilliant" size={16} title={false} /> Brilliant moves</span>
        <span class="val"><strong class="display num">{st.classes.brilliant ?? 0}</strong></span>
      </div>
      <div class="tile">
        <span class="label"><MoveBadge kind="only" size={16} title={false} /> Only moves found</span>
        <span class="val"><strong class="display num">{st.classes.only ?? 0}</strong></span>
      </div>
    </div>

    <div class="areas">
      {#each AREAS as a (a.id)}
        {@const v = st.areas[a.id]}
        {#if v}
          <div class="area" title={a.hint}>
            <span class="name">{a.label}{#if a.id === 'tactics'}<a class="learn" href="/puzzles/themes">Train tactics</a>{:else if a.id === 'strategy'}<a class="learn" href="/learn?tab=strategy">Learn plans</a>{/if}</span>
            <span class="track" aria-hidden="true"><span class="fill" style="width: {v.accuracy}%"></span></span>
            <span class="score"><MoveBadge kind={markOf(v.accuracy)} size={18} /><strong class="num">{v.accuracy}</strong></span>
            <span class="trend">{@render change(v.change, a.label)}</span>
          </div>
        {/if}
      {/each}
    </div>
    <p class="label note">Sharp moments: positions where one move was much better than the rest (tactics). Calm moves: positions with several fair moves, where plans decide (strategy).</p>

    <div class="slips">
      <span class="label">Per game</span>
      {#each SLIPS as [k, l] (k)}
        <span class="slip"><MoveBadge kind={k} size={18} title={false} /><span>{l}</span><strong class="num" style="color: {perGame(k) ? BADGES[k].color : 'var(--muted)'}">{perGame(k).toFixed(1)}</strong></span>
      {/each}
    </div>
  {:else}
    <p class="label">Review your games (press Review this game after a game, or open one in My games) and your accuracy in the opening, middlegame and endgame, in sharp moments and in calm moves shows here.</p>
  {/if}
</section>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .top h2,
  .sub {
    margin: 0;
  }
  .sub {
    font-size: 17px;
    margin-top: 6px;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--r-control);
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: none;
    color: var(--text-2);
    font: inherit;
    font-size: 14px;
    padding: 5px 12px;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--raised);
    color: var(--text);
    font-weight: 700;
  }
  .results {
    display: flex;
    gap: 18px;
    align-items: center;
    flex-wrap: wrap;
  }
  .count {
    display: flex;
    flex-direction: column;
    min-width: 70px;
  }
  .count strong {
    font-size: 36px;
    line-height: 1;
  }
  .wdl {
    flex: 1 1 260px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bar {
    display: flex;
    gap: 2px;
    height: 12px;
  }
  .bar span {
    flex-basis: 0;
    min-width: 4px;
  }
  .bar span:first-child {
    border-radius: 4px 0 0 4px;
  }
  .bar span:last-child {
    border-radius: 0 4px 4px 0;
  }
  .bar span:only-child {
    border-radius: 4px;
  }
  .won {
    background: var(--win);
  }
  .drawn {
    background: var(--draw);
  }
  .lost {
    background: var(--loss);
  }
  .wdl-legend {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .wdl-legend span {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  .wdl-legend i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: var(--r-control);
    background: var(--raised);
    min-width: 0;
  }
  .tile .label {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  .val {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .val strong {
    font-size: 28px;
    line-height: 1.1;
  }
  .small {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .areas {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .area {
    display: grid;
    grid-template-columns: minmax(96px, 130px) minmax(0, 1fr) 62px 44px;
    gap: 10px;
    align-items: center;
  }
  .name {
    font-weight: 600;
  }
  .learn {
    display: block;
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
  }
  .track {
    height: 10px;
    border-radius: 4px;
    background: var(--raised);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 0 4px 4px 0;
    background: var(--series-1);
  }
  .score {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .chg {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
  .chg.up {
    color: var(--win);
  }
  .chg.down {
    color: var(--loss);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .note {
    font-size: 12px;
  }
  .stats p {
    margin: 0;
  }
  .slips {
    display: flex;
    gap: 8px 16px;
    flex-wrap: wrap;
    align-items: center;
    padding-top: 10px;
    border-top: 1px solid var(--border-soft);
    font-size: 14px;
  }
  .slip {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  @media (max-width: 480px) {
    .area {
      grid-template-columns: minmax(84px, 110px) minmax(0, 1fr) 58px 36px;
      gap: 6px;
    }
  }
</style>
