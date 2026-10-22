<script lang="ts">
  /**
   * The home page's "Today": the puzzle of the day (its position), puzzles with the player's puzzle rating, and
   * today's lesson (the study plan's step, or Chess Guru's lessons) with the study streak, and the awards won (the
   * profile's trophy cabinet, new 2026-10-22). Cards side by side, as on chess.com; on a phone they scroll sideways.
   */
  import { onMount } from 'svelte';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { t } from '$lib/i18n';
  import { fenOf, keyOf } from '$lib/chess/position';
  import { dailyPuzzle, type DailyPuzzle } from '$lib/lichess';
  import { puzzleProvisional, puzzleRating } from '$lib/puzzles/rating';
  import { dayOf, streak, study } from '$lib/study/progress';
  import { hasPlan, loadPlan, nextStep, topicOn, TOPICS } from '$lib/study/plan';

  let puzzle = $state<DailyPuzzle | undefined>();
  let lesson = $state<{ label: string; title: string; href: string } | undefined>();
  let awards = $state<{ won: number; total: number } | undefined>();
  onMount(() => {
    dailyPuzzle().then((p) => (puzzle = p), () => {});
    // Counted after the page shows (the awards read every kind of progress).
    import('$lib/awards/awards').then((m) => (awards = { won: m.earnedNow().size, total: m.AWARDS.length }), () => {});
    if (!hasPlan()) return;
    const topic = topicOn(loadPlan(), new Date());
    if (topic === 'rest') return;
    const step = nextStep(topic);
    lesson = { label: TOPICS[topic].label, title: step.title, href: step.href };
  });
  const days = $derived(streak($study, Date.now()));
  const studiedToday = $derived($study.some((a) => dayOf(a.at) === dayOf(Date.now())));
</script>

<section class="today" aria-labelledby="today-h">
  <h2 id="today-h" class="sec-h">{$t('home.today')}</h2>
  <div class="row">
    <a class="tcard daily" href="/puzzles">
      <div class="mini">
        {#if puzzle}
          <Board fen={fenOf(puzzle.start)} orientation={puzzle.start.turn} lastMove={puzzle.lastMove?.map(keyOf)} viewOnly coordinates={false} label="Puzzle of the day" />
        {:else}
          <div class="mini-skel"></div>
        {/if}
      </div>
      <div class="txt">
        <strong>{$t('home.puzzle')}</strong>
        <span class="sub">{puzzle ? (puzzle.start.turn === 'white' ? $t('home.white') : $t('home.black')) : ' '}</span>
        <span class="cta">{$t('home.solve')}</span>
      </div>
    </a>

    <a class="tcard art-card" href="/puzzles">
      <img src="/art/puzzles-256.webp" alt="" width="256" height="245" loading="lazy" />
      <div class="txt">
        <strong>{$t('home.puzzles.h')}</strong>
        <span class="big num">{$puzzleRating}{$puzzleProvisional ? '?' : ''}</span>
        <span class="sub">{$t('home.puzzles.rating')}</span>
        <span class="cta">{$t('home.solve')}</span>
      </div>
    </a>

    <a class="tcard art-card" href={lesson?.href ?? '/learn'}>
      <img src="/art/learn-256.webp" alt="" width="256" height="243" loading="lazy" />
      <div class="txt">
        <strong>{$t('home.learn.h')}</strong>
        <span class="sub two-lines">{lesson ? $t('home.learn.today', { title: lesson.title }) : $t('home.learn.sub')}</span>
        {#if days > 0}<span class="streak" class:done={studiedToday}><Icon name="flame" size={14} />{$t('home.streak.short', { n: days })}</span>{/if}
        <span class="cta">{$t('home.start')}</span>
      </div>
    </a>

    <a class="tcard art-card awards" href="/awards">
      <img src="/art/trophy-256.webp" alt="" width="256" height="256" loading="lazy" />
      <div class="txt">
        <strong>{$t('home.awards.h')} <span class="newpill">{$t('nav.new')}</span></strong>
        <span class="big num">{awards?.won ?? '–'}</span>
        <span class="sub">{$t('home.awards.won', { total: awards?.total ?? 0 })}</span>
        <span class="cta">{$t('home.awards.cta')}</span>
      </div>
    </a>
  </div>
</section>

<style>
  .today {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
  }
  .tcard {
    position: relative;
    overflow: hidden;
    display: flex;
    gap: 12px;
    min-height: 150px;
    padding: 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background:
      radial-gradient(90% 90% at 100% 100%, color-mix(in srgb, var(--gold) 14%, transparent), transparent 70%),
      var(--card);
    color: var(--text);
    text-decoration: none;
    transition: border-color 0.15s, transform 0.15s;
  }
  .tcard:hover {
    border-color: var(--gold);
    text-decoration: none;
    transform: translateY(-2px);
  }
  .mini {
    flex: none;
    width: 112px;
    align-self: center;
  }
  .mini-skel {
    aspect-ratio: 1;
    border-radius: 8px;
    background: var(--raised);
  }
  .txt {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }
  .txt strong {
    font-family: var(--font-title);
    font-size: 19px;
    line-height: 1.15;
  }
  .sub {
    font-size: 13px;
    color: var(--text-2);
  }
  .two-lines {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .big {
    font-family: var(--font-display);
    font-size: 32px;
    line-height: 1;
    color: var(--gold);
  }
  .cta {
    margin-top: auto;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--action);
    color: var(--on-action);
    font-weight: 800;
    font-size: 14px;
  }
  /* The text keeps clear of the picture in the card's corner. */
  .art-card .txt {
    max-width: calc(100% - 58px);
    height: 100%;
  }
  .art-card img {
    position: absolute;
    right: -10px;
    bottom: -8px;
    width: 104px;
    height: auto;
    filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35));
    pointer-events: none;
  }
  .newpill {
    vertical-align: middle;
    padding: 1px 7px;
    border-radius: 999px;
    background: #f43f5e;
    color: #fff;
    font: 800 10.5px var(--font-body);
    letter-spacing: 0.04em;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 16%, transparent);
    color: var(--gold);
    font-size: 12px;
    font-weight: 800;
  }
  .streak.done {
    background: color-mix(in srgb, var(--win) 16%, transparent);
    color: var(--win);
  }
  /* Wider screens: the awards as a slim strip under the three cards (a fourth card squeezed them all). */
  @media (min-width: 768px) {
    .tcard.awards {
      grid-column: 1 / -1;
      min-height: 0;
      padding: 8px 16px;
      align-items: center;
    }
    .tcard.awards img {
      position: static;
      order: -1;
      width: 48px;
      flex: none;
    }
    .tcard.awards .txt {
      flex: 1;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      max-width: none;
      height: auto;
    }
    .tcard.awards .big {
      font-size: 26px;
    }
    .tcard.awards .cta {
      margin: 0 0 0 auto;
    }
  }
  /* Phones: the cards scroll sideways, the next one peeking in. */
  @media (max-width: 767px) {
    .row {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      margin: 0 -16px;
      padding: 2px 16px 4px;
      scroll-padding: 0 16px;
    }
    .row::-webkit-scrollbar {
      display: none;
    }
    .tcard {
      flex: 0 0 76%;
      scroll-snap-align: start;
    }
    .tcard.daily {
      flex-basis: 82%;
    }
  }
</style>
