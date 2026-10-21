<script lang="ts">
  /**
   * Home page: your ratings without the clutter. The one that matters (your main CC Rating), your puzzle
   * rating and your games stay in view; "All ratings" opens the rest (every CC Rating speed and your
   * Lichess ratings) in a tidy panel.
   */
  import { session } from '$lib/auth';
  import { kfideAll } from '$lib/stores/me';
  import { shownGames } from '$lib/stores/me';
  import { outcome } from '$lib/stores/myGames';
  import { KFIDE_SPEEDS, SPEED_LABEL, kfideText } from '$lib/kfide';
  import { LICHESS_LABEL, lichessRatings, type LichessRating } from '$lib/lichessRatings';
  import { puzzleProvisional, puzzleRating } from '$lib/puzzles/rating';
  import { t } from '$lib/i18n';
  import Icon from './Icon.svelte';

  let open = $state(false);
  const main = $derived($kfideAll[$kfideAll.main]);
  const stats = $derived.by(() => {
    const done = $shownGames.filter((g) => outcome(g) !== 'unfinished');
    const won = done.filter((g) => outcome(g) === 'won').length;
    const drawn = done.filter((g) => outcome(g) === 'draw').length;
    return { played: done.length, won, drawn, lost: done.length - won - drawn };
  });
  /** Signed in with Lichess: the player's real Lichess ratings (the speeds they play most there). */
  let lichess = $state<LichessRating[]>([]);
  $effect(() => {
    const s = $session;
    lichess = [];
    if (s.status !== 'in' || !s.uid.startsWith('lichess:') || !s.username) return;
    lichessRatings(s.username).then(
      (list) => (lichess = [...list].sort((a, b) => b.games - a.games).slice(0, 3)),
      () => {},
    );
  });
</script>

<div class="rs" aria-label="Your ratings and games">
  <div class="row">
    <a class="big" href={main.games ? `/profile?speed=${$kfideAll.main}#cc-ratings` : '/play?mode=fide'} title="Your Chess Castles rating from games against FIDE-level opponents. See how it changed.">
      <span class="label">{$t('rs.cc', { speed: SPEED_LABEL[$kfideAll.main] })}</span>
      {#if main.games}<strong class="num">{kfideText(main)}</strong>{:else}<strong class="none">{$t('rs.playget')}</strong>{/if}
    </a>
    <a class="small" href="/puzzles" title="Your puzzle rating: a solved puzzle raises it, a missed one (or a hint) lowers it"><span class="label">{$t('rs.puzzles')}</span><strong class="num">{$puzzleRating}{$puzzleProvisional ? '?' : ''}</strong></a>
    <a class="small" href="/games" title="Finished games you played on Chess Castles: won {stats.won}, drawn {stats.drawn}, lost {stats.lost}"><span class="label">{$t('rs.games')}</span><strong class="num">{stats.played}</strong></a>
    <button class="all" aria-expanded={open} aria-controls="all-ratings" onclick={() => (open = !open)}>
      {$t('rs.all')} <span class="chev" class:open><Icon name="chevron" size={14} /></span>
    </button>
  </div>
  {#if open}
    <div id="all-ratings" class="panel card">
      <p class="label">{$t('rs.panel')}</p>
      <div class="grid">
        {#each KFIDE_SPEEDS as s (s)}
          {@const k = $kfideAll[s]}
          <a class="cell" class:main={$kfideAll.main === s && k.games > 0} href={k.games ? `/profile?speed=${s}#cc-ratings` : '/play?mode=fide'}>
            <span class="label">{SPEED_LABEL[s]}</span>
            {#if k.games}<strong class="num">{kfideText(k)}</strong>{:else}<strong class="none">{$t('rs.play')}</strong>{/if}
          </a>
        {/each}
      </div>
      {#if lichess.length}
        <p class="label">{$t('rs.lichess')}</p>
        <div class="grid">
          {#each lichess as l (l.speed)}
            <a class="cell" href="/insights" title="{l.games} games"><span class="label">{LICHESS_LABEL[l.speed]}</span><strong class="num">{l.rating}{l.provisional ? '?' : ''}</strong></a>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .rs {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: stretch;
    justify-content: flex-end;
  }
  a,
  .all {
    color: inherit;
    text-decoration: none;
  }
  .big,
  .small {
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-control);
    padding: 7px 14px;
    transition: border-color 0.15s;
  }
  .big {
    border-color: var(--gold);
    min-width: 130px;
  }
  .big strong {
    font-size: 26px;
    color: var(--gold);
    line-height: 1.1;
  }
  .small strong {
    font-size: 20px;
    line-height: 1.2;
  }
  .none {
    color: var(--muted);
    font-size: 16px;
  }
  .big:hover,
  .small:hover {
    border-color: var(--brand);
  }
  .all {
    border: 1px dashed var(--border);
    border-radius: var(--r-control);
    background: none;
    padding: 0 14px;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    font-size: 13.5px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .chev {
    display: inline-flex;
    transition: transform 0.15s;
  }
  .chev.open {
    transform: rotate(90deg);
  }
  .panel {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 280px;
  }
  .panel p {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
    gap: 8px;
  }
  .cell {
    display: flex;
    flex-direction: column;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
  }
  .cell.main {
    border-color: var(--gold);
  }
  .cell strong {
    font-size: 18px;
  }
  @media (max-width: 767px) {
    .rs {
      align-items: stretch;
    }
    .row {
      justify-content: flex-start;
    }
    .big {
      flex: 1 1 140px;
    }
  }
</style>
