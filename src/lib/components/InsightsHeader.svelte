<script lang="ts">
  /**
   * Game Insights, top of the report: a simple report card (accuracy and score as rings, wins/draws/losses
   * as one bar, blunders against a target) and "Your road to improvement": three steps in order. Fix the
   * biggest problem, follow this week's plan, then check your progress against clear goals.
   */
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import { TOPICS } from '$lib/study/plan';
  import type { WeeklyPlan } from '$lib/insights/plan';
  import type { Report } from '$lib/insights/report';
  import { studyHref } from '$lib/study/fromGames';
  import Icon from './Icon.svelte';
  import ScoreRing from './ScoreRing.svelte';

  let {
    report,
    wdl,
    summary,
    plan,
    ownMistakes,
    onplan,
    onweak,
    onadd,
  }: {
    report: Report;
    wdl: { w: number; d: number; l: number };
    summary: string;
    plan?: WeeklyPlan;
    ownMistakes: number;
    onplan: () => void;
    onweak: () => void;
    onadd: () => void;
  } = $props();

  const accColor = $derived(report.accuracy >= 85 ? 'var(--win)' : report.accuracy >= 72 ? 'var(--gold)' : 'var(--loss)');
  const top = $derived(report.weaknesses[0]);
  /** Where "Train it" goes: the weakness' own tactic, a weak line of the opening study, or the player's own mistakes as puzzles. */
  const fixHref = $derived.by(() => {
    if (top?.tactic) return `/insights/mistakes?tactic=${top.tactic}`;
    const st = report.study.find((s) => s.score < 0.45);
    if (top?.kind === 'opening' && st) return studyHref(st.opening, st.line, 'games');
    return '/insights/mistakes';
  });
  const tasks = $derived(plan ? plan.days.flatMap((d) => d.tasks) : []);
  const minutes = $derived(tasks.reduce((n, t) => n + t.minutes, 0));
  const goalAcc = $derived(Math.min(98, Math.round(report.accuracy) + 3));
  const goalBlunders = $derived(Math.max(0.4, Math.round(report.blundersPerGame * 7) / 10));
  const total = $derived(Math.max(1, wdl.w + wdl.d + wdl.l));
  /** "2026-10-16" -> "F" (the first letter of the day, for the week strip). */
  const dayLetter = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2);
  };
</script>

<section class="card say">
  <GuruAvatar size={58} />
  <p>{summary}</p>
</section>

<section class="cards" aria-label="Your report card">
  <div class="card c">
    <ScoreRing value={report.accuracy} label="Accuracy" sub="{Math.round(report.acpl)} centipawns lost a move" color={accColor} />
  </div>
  <div class="card c">
    <ScoreRing value={report.score * 100} label="Score" sub="{report.games} games{report.averageRating ? ` · rated about ${report.averageRating}` : ''}" color="var(--accent)" />
    <div class="wdl" role="img" aria-label="{wdl.w} won, {wdl.d} drawn, {wdl.l} lost">
      <span class="w" style="flex: {wdl.w}"></span><span class="d" style="flex: {wdl.d}"></span><span class="l" style="flex: {wdl.l}"></span>
    </div>
    <span class="label wdl-t">{wdl.w} won · {wdl.d} drawn · {wdl.l} lost</span>
  </div>
  <div class="card c meter">
    <strong class="big num" class:bad={report.blundersPerGame > goalBlunders * 1.5}>{report.blundersPerGame.toFixed(1)}</strong>
    <strong>Blunders a game</strong>
    <div class="gauge" role="img" aria-label="{report.blundersPerGame.toFixed(1)} blunders a game, goal {goalBlunders.toFixed(1)}">
      <span class="fill" style="width: {Math.min(100, (report.blundersPerGame / 4) * 100)}%"></span>
      <span class="goal" style="left: {Math.min(100, (goalBlunders / 4) * 100)}%" title="Goal"></span>
    </div>
    <span class="label">mistakes {report.mistakesPerGame.toFixed(1)} a game · goal under {goalBlunders.toFixed(1)}</span>
  </div>
</section>

<section class="road" aria-labelledby="road-h">
  <h2 id="road-h" class="title">Your road to improvement</h2>
  <p class="label">Three simple steps. Do them in order.</p>
  <ol>
    <li class="card step">
      <span class="no">1</span>
      <div class="body">
        <span class="kick">Fix this first</span>
        {#if top}
          <strong>{top.title}</strong>
          <span class="label">{top.evidence}</span>
        {:else}
          <strong>No big weakness found</strong>
          <span class="label">Well played! Analyse more games for a sharper picture.</span>
        {/if}
      </div>
      <div class="acts">
        {#if top}<a class="btn primary" href={fixHref}><Icon name="puzzle" size={16} />Train it</a><button class="btn ghost" onclick={onweak}>See why</button>{:else if ownMistakes}<a class="btn primary" href="/insights/mistakes">Solve my mistakes</a>{/if}
      </div>
    </li>
    <li class="card step">
      <span class="no">2</span>
      <div class="body">
        <span class="kick">Follow this week's plan</span>
        <strong>{tasks.length} tasks · about {minutes} minutes</strong>
        {#if plan}
          <div class="week" aria-label="The next seven days">
            {#each plan.days as d (d.day)}
              <span class="dayc" title="{TOPICS[d.topic].label}{d.tasks.length ? '' : ' (rest)'}" style="--tc: {TOPICS[d.topic].color}"><i class:rest={!d.tasks.length}></i>{dayLetter(d.day)}</span>
            {/each}
          </div>
        {/if}
      </div>
      <div class="acts">
        <button class="btn primary" onclick={onadd}><Icon name="learn" size={16} />Add to my study plan</button>
        <button class="btn ghost" onclick={onplan}>See the plan</button>
      </div>
    </li>
    <li class="card step">
      <span class="no">3</span>
      <div class="body">
        <span class="kick">Check your progress</span>
        <strong>Play about 10 more games, then analyse again</strong>
        <ul class="goals">
          <li><Icon name="check" size={14} color="var(--win)" />Accuracy: from {Math.round(report.accuracy)}% to {goalAcc}%</li>
          <li><Icon name="check" size={14} color="var(--win)" />Blunders: from {report.blundersPerGame.toFixed(1)} to under {goalBlunders.toFixed(1)} a game</li>
        </ul>
      </div>
      <div class="acts"><a class="btn ghost" href="#ins-user" onclick={() => setTimeout(() => document.getElementById('ins-user')?.focus(), 50)}>Analyse again</a></div>
    </li>
  </ol>
</section>

<style>
  .say {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 14px 16px;
  }
  .say p {
    margin: 0;
    font-size: 16px;
    line-height: 1.5;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  .c {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 14px;
    text-align: center;
  }
  .wdl {
    width: 100%;
    max-width: 200px;
    height: 10px;
    display: flex;
    gap: 2px;
    border-radius: 5px;
    overflow: hidden;
  }
  .wdl .w {
    background: var(--win);
  }
  .wdl .d {
    background: var(--muted);
  }
  .wdl .l {
    background: var(--loss);
  }
  .wdl-t {
    font-size: 12.5px;
  }
  .meter .big {
    font-size: 54px;
    line-height: 1;
    font-family: var(--font-title);
    color: var(--win);
  }
  .meter .big.bad {
    color: var(--loss);
  }
  .gauge {
    position: relative;
    width: 100%;
    max-width: 200px;
    height: 10px;
    border-radius: 5px;
    background: var(--raised);
    margin: 4px 0;
  }
  .gauge .fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 5px;
    background: linear-gradient(90deg, var(--gold), var(--loss));
  }
  .gauge .goal {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 3px;
    margin-left: -1px;
    border-radius: 2px;
    background: var(--win);
  }
  .road {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .road h2 {
    margin: 0;
    font-size: 22px;
  }
  .road > p {
    margin: 0;
  }
  ol {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    counter-reset: none;
  }
  .step {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px 16px 14px;
  }
  /* The line that joins the steps. */
  .step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 33px;
    right: -15px;
    width: 16px;
    border-top: 3px dotted var(--gold);
  }
  .no {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #f7d27a, #edb040 55%, #c98a1b);
    color: #0b1426;
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 18px;
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .kick {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .body strong {
    font-size: 17px;
    line-height: 1.3;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .week {
    display: flex;
    gap: 5px;
    margin-top: 4px;
  }
  .dayc {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--muted);
  }
  .dayc i {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    background: var(--tc);
  }
  .dayc i.rest {
    background: var(--raised);
    border: 1px dashed var(--border);
  }
  .goals {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 14px;
  }
  .goals li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  @media (max-width: 860px) {
    ol {
      grid-template-columns: 1fr;
    }
    .step:not(:last-child)::after {
      top: auto;
      bottom: -15px;
      right: auto;
      left: 33px;
      width: 0;
      height: 16px;
      border-top: 0;
      border-left: 3px dotted var(--gold);
    }
  }
</style>
