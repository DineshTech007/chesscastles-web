<script lang="ts">
  /**
   * The home page's "Playing now on Chess Castles": the strongest game being played by Chess Castles players, moving
   * on a small board (its moves come in every few seconds), the next ones, and Watch (the watch pages have the engine
   * and the games database). Nobody playing: the top Chess Castles game of the last 24 hours, replaying itself move
   * by move, to open and replay. Only games of players here, whatever their rating.
   */
  import { onDestroy, onMount } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import Board from './Board.svelte';
  import TitleBadge from './TitleBadge.svelte';
  import { t } from '$lib/i18n';
  import { poll } from '$lib/poll';
  import { playingNow, watchHref, watchLive, type PlayingGame } from '$lib/social';
  import { fenOf, keyOf, positionFromFen, uciToMove } from '$lib/chess/position';
  import type { Key } from '@lichess-org/chessground/types';

  let games = $state<PlayingGame[]>([]);
  let now = $state(Date.now());
  let loaded = $state(false);
  /** The featured game's moves (its uid), and how far the board shows them. */
  let line = $state<{ uid: string; start: Chess; moves: NormalMove[] } | undefined>();
  let ply = $state(0);

  const strength = (g: PlayingGame) => Math.max(g.rating ?? 0, g.opponentRating ?? 0);
  const byStrength = (a: PlayingGame, b: PlayingGame) => strength(b) - strength(a) || b.updated - a.updated;
  /** Being played: not over, and a move shared in the last two minutes. */
  const isLive = (g: PlayingGame) => !g.over && now - g.updated < 2 * 60_000;
  const playing = $derived(games.filter(isLive).sort(byStrength));
  /** Nobody playing: the strongest game finished in the last 24 hours. */
  const today = $derived(games.filter((g) => g.over).sort(byStrength));
  const top = $derived(playing[0] ?? today[0]);
  const topLive = $derived(!!playing[0]);
  const tc = (g: PlayingGame) => (g.minutes || g.increment ? `${g.minutes}+${g.increment}` : '');
  /** The opponent's rating, unless the name already says it ("FIDE 1900"). */
  const oppRating = (g: PlayingGame) => (g.opponentRating && !g.opponent.includes(String(g.opponentRating)) ? g.opponentRating : undefined);

  const board = $derived.by(() => {
    if (!line || !top || line.uid !== top.uid) return undefined;
    const pos = line.start.clone();
    const shown = Math.min(ply, line.moves.length);
    for (const m of line.moves.slice(0, shown)) pos.play(m);
    const last = shown ? line.moves[shown - 1] : undefined;
    return { fen: fenOf(pos), orientation: top.color, lastMove: last ? ([keyOf(last.from), keyOf(last.to)] as Key[]) : undefined };
  });

  /** The featured game's moves (a game on Lichess is shown on its own watch page, not here). */
  async function loadLine(g: PlayingGame) {
    if (g.lichess) return void (line = undefined);
    const w = await watchLive(g.uid);
    const start = positionFromFen(w.game.start);
    const pos = start.clone();
    const moves: NormalMove[] = [];
    for (const u of w.game.uci) {
      const m = uciToMove(u);
      if (!m || !pos.isLegal(m)) break;
      pos.play(m);
      moves.push(m);
    }
    const fresh = line?.uid !== g.uid;
    line = { uid: g.uid, start, moves };
    // A game going on shows its latest move; a finished one replays from the start.
    if (isLive(g)) ply = moves.length;
    else if (fresh) ply = 0;
  }

  async function load() {
    const r = await playingNow(true);
    games = r.games;
    now = r.now;
    loaded = true;
    if (top && (line?.uid !== top.uid || topLive)) await loadLine(top).catch(() => (line = undefined));
    else if (!top) line = undefined;
    return true;
  }

  // A game going on: its moves every 5 seconds. A finished one: replayed, a move every 1.1 s, a pause at the end.
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let replay: ReturnType<typeof setInterval> | undefined;
  let pause = 0;
  onMount(() => {
    const stopList = poll(load, 30_000);
    const stopMoves = poll(async () => (topLive && top && !top.lichess ? loadLine(top).then(() => true) : true), 5_000, { now: false });
    replay = setInterval(() => {
      if (topLive || !line || document.visibilityState !== 'visible') return;
      if (still) return void (ply = line.moves.length);
      if (ply < line.moves.length) ply++;
      else if (++pause > 3) (pause = 0), (ply = 0);
    }, 1100);
    return () => {
      stopList();
      stopMoves();
    };
  });
  onDestroy(() => clearInterval(replay));
</script>

{#if loaded}
  <section class="card cc" aria-labelledby="cc-h">
    <div class="head">
      <h2 id="cc-h" class="title">{$t('home.cc.h')}</h2>
      {#if playing.length}<span class="pill"><span class="dot"></span>{playing.length}</span>{/if}
    </div>
    {#if top}
      <div class="top">
        {#if board}
          <a class="mini" href={watchHref(top)} aria-label={topLive ? $t('home.cc.watch') : $t('home.cc.replay')}>
            <Board fen={board.fen} orientation={board.orientation} lastMove={board.lastMove} viewOnly coordinates={false} label="{top.name} vs {top.opponent}" />
          </a>
        {/if}
        <div class="info">
          <span class="label eyebrow">{topLive ? $t('home.cc.top') : $t('home.cc.today')}</span>
          <strong class="players">
            <TitleBadge title={top.title} size={13} />{top.name}{#if top.rating}<span class="num r">{top.rating}</span>{/if}
            <span class="vs">vs</span>
            {top.opponent}{#if oppRating(top)}<span class="num r">{oppRating(top)}</span>{/if}
          </strong>
          <span class="label">{tc(top) ? `${tc(top)} · ` : ''}{$t('home.cc.moves', { n: Math.ceil(top.moves / 2) })}{#if !topLive && top.result} · {top.result}{/if}</span>
          <a class="btn primary watch" href={watchHref(top)}>{#if topLive}<span class="pulse"></span>{$t('home.cc.watch')}{:else}{$t('home.cc.replay')}{/if}</a>
        </div>
      </div>
      {#if topLive && playing.length > 1}
        <ul class="more">
          {#each playing.slice(1, 4) as g (g.uid)}
            <li>
              <a href={watchHref(g)}>
                <span class="g">{g.name}{#if g.rating} <span class="num label">{g.rating}</span>{/if} <span class="label">vs</span> {g.opponent}</span>
                <span class="label">{tc(g)}</span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
      {#if !topLive}<p class="label">{$t('home.cc.nonenow')}</p>{/if}
      <a class="all" href="/live">{$t('home.cc.all')} →</a>
    {:else}
      <p class="label">{$t('home.cc.none')}</p>
      <a class="btn primary go" href="/play">{$t('home.cc.play')}</a>
    {/if}
  </section>
{/if}

<style>
  .cc {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .head h2 {
    margin: 0;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 13px;
    color: var(--live);
    background: color-mix(in srgb, var(--live) 14%, transparent);
  }
  .dot,
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--live);
    flex: none;
    animation: blink 1.4s ease-in-out infinite;
  }
  .pulse {
    background: currentColor;
  }
  @keyframes blink {
    50% {
      opacity: 0.3;
    }
  }
  .top {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .mini {
    width: 160px;
    flex: none;
    border-radius: 8px;
    overflow: hidden;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 800;
    font-size: 11px;
    color: var(--gold);
  }
  .players {
    font-size: 17px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .r {
    margin-left: 5px;
    font-size: 14px;
    color: var(--text-2);
  }
  .vs {
    margin: 0 6px;
    font-weight: 500;
    color: var(--muted);
  }
  .watch {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .more {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .more a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
  }
  .g {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .all,
  .go {
    align-self: flex-start;
  }
  .all {
    font-weight: 700;
  }
  p {
    margin: 0;
  }
  @media (max-width: 480px) {
    .mini {
      width: 124px;
    }
    .players {
      font-size: 15px;
    }
  }
</style>
