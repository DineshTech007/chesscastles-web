<script lang="ts">
  /**
   * Game Insights: Guru's deep analysis of the player's own games (chess.com or Lichess):
   * every move checked by the engine, then a report of strengths and
   * weaknesses with evidence, and a tailored weekly plan that joins the
   * daily study plan.
   */
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import { analyzeGame, moveLabel, TACTICS, type AnalyzedGame } from '$lib/insights/analysis';
  import { chessComGames, lichessGames, opponentOf, pgnOf, userScore, type ImportedGame, type Site } from '$lib/insights/games';
  import { buildReport, gameSummary, mistakesToTrain, type Report } from '$lib/insights/report';
  import { TOPICS } from '$lib/study/plan';
  import { formatDate } from '$lib/format';
  import { applyToStudyPlan, buildWeeklyPlan, saveWeeklyPlan } from '$lib/insights/plan';
  import { loadInsights, saveInsights, type InsightsData } from '$lib/insights/store';
  import { isWeak, resultText, studyHref, studyLineName } from '$lib/study/fromGames';
  import { lichessToken, session, startLichessSignIn } from '$lib/auth';
  import { PLANS, PLANS_ON, PLAN_INFO, planSettings, currentPlan, useFeature } from '$lib/plans';
  import InsightsHeader from '$lib/components/InsightsHeader.svelte';
  import { t } from '$lib/i18n';
  import { saveGuruSummary } from '$lib/social';
  import { guruSummary } from '$lib/whatsapp';
  import { noteGuruReport } from '$lib/study/reminders';

  let site = $state<Site>('chesscom');
  let username = $state('');
  let count = $state(20);
  let data = $state<InsightsData | undefined>();
  let phase = $state<'idle' | 'fetching' | 'analysing'>('idle');
  let progress = $state({ done: 0, total: 0 });
  let error = $state('');
  /** Lichess chosen without a Lichess login. */
  let needsLichess = $state(false);
  let stop = false;
  type Tab = 'overview' | 'weak' | 'openings' | 'games' | 'plan';
  let tab = $state<Tab>('overview');

  onMount(() => {
    data = loadInsights();
    if (data) {
      site = data.site;
      username = data.username;
    }
    // From the home page's Guru card or a WhatsApp message: whose games (?site=…&user=…), and with &auto=1 Guru starts
    // at once (games analysed before are kept; only new ones go to the engine).
    const q = new URLSearchParams(location.search);
    const qs = q.get('site');
    const qu = q.get('user')?.trim();
    if ((qs === 'lichess' || qs === 'chesscom') && qu) {
      site = qs;
      username = qu;
      history.replaceState(history.state, '', location.pathname);
      if (q.get('auto') === '1') void run();
    }
  });
  onDestroy(() => (stop = true));

  /** How many games a report may have on your plan, and the lowest plan allowing more. */
  const maxGames = $derived($planSettings.config.quotas.insights_games[$currentPlan]);
  const planFor = (n: number) => PLANS.find((p) => $planSettings.config.quotas.insights_games[p] >= n) ?? 'premium';

  async function run() {
    error = '';
    stop = false;
    if (count > maxGames) count = maxGames;
    // Lichess shares game archives only with a Lichess login: ask first (before a report is counted).
    needsLichess = site === 'lichess' && !lichessToken();
    if (needsLichess) return;
    // One report of the plan's reports (the same player again in the same period is free).
    if (!(await useFeature('insights', `${site}:${username.trim().toLowerCase()}`))) return;
    phase = 'fetching';
    try {
      const fetched = site === 'chesscom' ? await chessComGames(username, count) : await lichessGames(username, count, lichessToken()?.token);
      if (!fetched.length) throw new Error('No standard games found for this player yet.');
      // Games analysed before are kept; only new ones go to the engine.
      const known = new Map((data?.username.toLowerCase() === username.toLowerCase() && data.site === site ? data.games : []).map((g) => [g.game.url, g]));
      const out: AnalyzedGame[] = [];
      phase = 'analysing';
      progress = { done: 0, total: fetched.length };
      for (const g of fetched) {
        if (stop) break;
        out.push(known.get(g.url) ?? (await analyzeGame(g, 10, () => stop)));
        progress = { done: progress.done + 1, total: fetched.length };
        data = { site, username: username.trim(), at: Date.now(), games: out };
      }
      if (data) {
        saveInsights(data);
        // The short summary for the player's WhatsApp report (kept only if they gave a number), and for the free
        // personal reminders on this phone (Guru's focus; the weekly check of new games).
        if (data.games.length) {
          const report = buildReport(data.games);
          if ($session.status === 'in') void saveGuruSummary(guruSummary(report, data)).catch(() => {});
          noteGuruReport({ site: data.site, user: data.username, weak: report.weaknesses[0]?.title, at: Date.now() });
        }
      }
    } catch (e) {
      if (!stop) error = e instanceof Error ? e.message : 'The games could not be analysed.';
    } finally {
      phase = 'idle';
    }
  }

  const report = $derived<Report | undefined>(data && data.games.length ? buildReport(data.games) : undefined);
  /** Wins, draws and losses of the analysed games. */
  const wdl = $derived.by(() => {
    const sc = (data?.games ?? []).map((g) => userScore(g.game));
    return { w: sc.filter((x) => x === 1).length, d: sc.filter((x) => x === 0.5).length, l: sc.filter((x) => x === 0).length };
  });
  const ownMistakes = $derived(data ? mistakesToTrain(data.games).length : 0);
  const summary = $derived.by(() => {
    if (!report) return '';
    const top = report.weaknesses[0];
    return $t('ins.summary', { games: report.games, score: Math.round(report.score * 100), acc: report.accuracy }) + (top ? $t('ins.summary.top', { top: top.title.toLowerCase() }) : $t('ins.summary.none')) + $t('ins.summary.end');
  });

  function makePlan() {
    if (!report || !data) return;
    const plan = buildWeeklyPlan(report, `${data.site === 'chesscom' ? 'chess.com' : 'Lichess'} · ${data.username}`);
    saveWeeklyPlan(plan);
    applyToStudyPlan(plan);
    goto('/learn#guru-plan');
  }

  /** Opens a game in Analyse with the full move-by-move review, at `ply` (the end if not given). */
  function review(g: ImportedGame, ply?: number) {
    sessionStorage.setItem('k24.importPgn', pgnOf(g));
    goto(`/analysis?import=1&review=1${ply !== undefined ? `&ply=${ply}` : ''}`);
  }
  /** The weekly plan Guru would make from this report, shown before it is added. */
  const preview = $derived(report && data ? buildWeeklyPlan(report, `${data.site === 'chesscom' ? 'chess.com' : 'Lichess'} · ${data.username}`) : undefined);
  /** "2026-10-16" -> "Fri 16 Oct" (today: "Today"). */
  const dayName = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.toDateString() === new Date().toDateString()) return 'Today';
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const games = $derived(
    (data?.games ?? []).map((g) => ({ g, s: userScore(g.game), sum: gameSummary(g) })).sort((a, b) => b.g.game.endTime - a.g.game.endTime),
  );
  const TABS = $derived<[Tab, string][]>([
    ['overview', 'Overview'],
    ['weak', `Weaknesses${report?.weaknesses.length ? ` (${report.weaknesses.length})` : ''}`],
    ['openings', 'Openings'],
    ['games', `Games (${data?.games.length ?? 0})`],
    ['plan', 'Weekly plan'],
  ]);
  const PHASE_NAME = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };
</script>

<svelte:head><title>Game Insights · Chess Castles</title></svelte:head>

<div class="page">
  <section class="card hero">
    <GuruAvatar size={84} talking={phase !== 'idle'} />
    <div class="intro">
      <span class="kicker">{$t('ins.kicker')}</span>
      <h1 class="display">{$t('ins.h1')}</h1>
      <p>{$t('ins.intro')}</p>
    </div>
  </section>

  <form class="card connect" onsubmit={(e) => (e.preventDefault(), run())}>
    <div class="segmented" role="group" aria-label="Site">
      <button type="button" aria-pressed={site === 'chesscom'} onclick={() => (site = 'chesscom')}>chess.com</button>
      <button type="button" aria-pressed={site === 'lichess'} onclick={() => (site = 'lichess')}>Lichess</button>
    </div>
    <input id="ins-user" bind:value={username} placeholder={site === 'chesscom' ? $t('ins.ph.chesscom') : $t('ins.ph.lichess')} required autocomplete="off" />
    <select id="ins-count" bind:value={count} aria-label="How many games">
      {#each [10, 20, 30, 40, 50, 100, 200] as n (n)}
        <option value={n} disabled={n > maxGames}>{$t('ins.last', { n })}{n > maxGames && PLANS_ON ? ` · ${PLAN_INFO[planFor(n)].name}` : ''}</option>
      {/each}
    </select>
    {#if phase === 'idle'}
      <button class="btn primary" type="submit"><Icon name="analyse" size={18} />{data ? $t('ins.again') : $t('ins.analyse')}</button>
    {:else}
      <button class="btn" type="button" onclick={() => (stop = true)}>{$t('ins.stop')}</button>
    {/if}
  </form>
  {#if phase === 'fetching'}<p class="label">{$t('ins.fetching')}</p>{/if}
  {#if phase === 'analysing'}
    <div class="prog"><span style="width: {(100 * progress.done) / Math.max(1, progress.total)}%"></span></div>
    <p class="label">{$t('ins.checking', { a: Math.min(progress.done + 1, progress.total), b: progress.total })}</p>
  {/if}
  {#if error}<p class="err">{error}</p>{/if}
  {#if needsLichess && site === 'lichess'}
    <div class="card lich-need" role="note">
      <p>Lichess shares game archives only with apps you have signed in to. Connect your free Lichess account once, then analyse any player’s Lichess games.</p>
      <button class="btn primary" onclick={() => startLichessSignIn($session.status === 'in')}>{$session.status === 'in' ? 'Connect your Lichess account' : 'Sign in with Lichess'}</button>
    </div>
  {/if}

  {#if !report && phase === 'idle' && !error}
    <section class="how">
      {#each ['1', '2', '3'] as n (n)}
        <div class="card step"><span class="step-no">{n}</span><strong>{$t(`ins.s${n}t` as 'ins.s1t')}</strong><span class="label">{$t(`ins.s${n}d` as 'ins.s1d')}</span></div>
      {/each}
    </section>
  {/if}

  {#if report}
    <InsightsHeader {report} {wdl} {summary} plan={preview} {ownMistakes} onplan={() => (tab = 'plan')} onweak={() => (tab = 'weak')} onadd={makePlan} />

    <div class="tabs" role="tablist" aria-label="Report">
      {#each TABS as [k, label] (k)}
        <button role="tab" aria-selected={tab === k} class:on={tab === k} onclick={() => (tab = k)}>{label}</button>
      {/each}
    </div>

    {#if tab === 'overview'}
      {#each report.study.filter(isWeak).slice(0, 2) as st (st.opening + st.line)}
        <section class="card block study-call">
          <h2 class="title">You keep losing in the {studyLineName(st)}</h2>
          <p class="label">{resultText(st)}{st.firstSlip ? `. Your first mistake usually came around move ${st.firstSlip}.` : '.'} The opening study has this line ready for you:</p>
          <div class="study-acts">
            <a class="btn primary" href={studyHref(st.opening, st.line, 'games')}>Model games</a>
            <a class="btn" href={studyHref(st.opening, st.line, 'puzzles')}>Puzzles from this line</a>
            <a class="btn" href={studyHref(st.opening, st.line, 'plans')}>The plans</a>
          </div>
        </section>
      {/each}
      <section class="card block">
        <h2 class="title">Where you lose points</h2>
        <p class="label">Centipawns lost per move in each part of the game. Shorter is better; red is your weakest phase.</p>
        {#each report.phases as p (p.phase)}
          <div class="phase">
            <span class="ph-name">{PHASE_NAME[p.phase]}</span>
            <div class="bar"><span style="width: {Math.min(100, p.acpl / 1.5)}%; background: {p.acpl > report.acpl * 1.15 ? 'var(--loss)' : p.acpl < report.acpl * 0.85 ? 'var(--win)' : 'var(--gold)'}"></span></div>
            <span class="label num">{Math.round(p.acpl)} cp · {p.errors} mistakes</span>
          </div>
        {/each}
      </section>
      <div class="two">
        <section class="card block">
          <h2 class="title">Fix these first</h2>
          {#if !report.weaknesses.length}<p class="label">No clear weakness in these games. Analyse more games for a sharper picture.</p>{/if}
          <ol class="top3">
            {#each report.weaknesses.slice(0, 3) as w (w.title)}
              <li><button class="link-row" onclick={() => (tab = 'weak')}><strong>{w.title}</strong><span class="label">{w.evidence}</span></button></li>
            {/each}
          </ol>
        </section>
        <section class="card block">
          <h2 class="title">Your strengths</h2>
          {#if report.strengths.length}
            <ul class="strengths">{#each report.strengths as st (st)}<li>✓ {st}</li>{/each}</ul>
          {:else}
            <p class="label">Your strengths show up after a few more games.</p>
          {/if}
        </section>
      </div>
    {:else if tab === 'weak'}
      <section class="block-list">
        {#if !report.weaknesses.length}
          <p class="card pad">No clear weakness in these games. Analyse more games for a sharper picture.</p>
        {/if}
        {#each report.weaknesses as w, i (w.title)}
          <article class="card weak">
            <div class="w-head"><span class="w-no display">{i + 1}</span><h3 class="title">{w.title}</h3>{#if w.tactic}<a class="btn small-btn" href="/insights/mistakes?tactic={w.tactic}"><Icon name="puzzle" size={15} />Train it</a>{/if}</div>
            <p>{w.evidence}</p>
            {#if w.examples.length}
              <p class="label ex-h">From your games: tap one to see the move on the board, with the full review.</p>
              <div class="examples">
                {#each w.examples as ex (ex.game.url + ex.move.ply)}
                  <button class="ex" onclick={() => review(ex.game, ex.move.ply)}>
                    <span class="ex-move num"><span class="dotc {ex.move.cls}"></span>{moveLabel(ex.move)}</span>
                    <span class="label">vs {opponentOf(ex.game)}{ex.move.bestSan ? ` · better was ${ex.move.bestSan}` : ''}{ex.move.tactic && ex.move.tactic !== 'other' ? ` · ${TACTICS[ex.move.tactic].label.toLowerCase()} ${ex.move.tacticMissed ? 'missed' : 'allowed'}` : ''}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </article>
        {/each}
      </section>
    {:else if tab === 'openings'}
      <section class="card block">
        <h2 class="title">Your openings</h2>
        <p class="label">Green: you score well. Red: this opening is costing you points; it's a good one to study.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Opening</th><th>As</th><th class="r">Games</th><th class="r">Score</th><th class="r">W · D · L</th></tr></thead>
            <tbody>
              {#each report.openings.slice(0, 12) as o (o.name + o.color)}
                <tr><td>{o.name}</td><td>{o.color === 'white' ? 'White' : 'Black'}</td><td class="r num">{o.games}</td><td class="r num" class:good={o.score >= 0.55} class:poor={o.score < 0.45}>{Math.round(o.score * 100)}%</td><td class="r num">{o.wins} · {o.draws} · {o.losses}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
      {#if report.study.length}
        <section class="card block">
          <h2 class="title">Your lines in the opening study</h2>
          <p class="label">Your games in the openings of the study section, line by line, found from the moves (any move order).</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Line</th><th class="r">Games</th><th class="r">Score</th><th class="r">W · D · L</th><th></th></tr></thead>
              <tbody>
                {#each report.study as st (st.opening + st.line)}
                  <tr>
                    <td>{studyLineName(st)}</td>
                    <td class="r num">{st.games}</td>
                    <td class="r num" class:good={st.score >= 0.55} class:poor={st.score < 0.45}>{Math.round(st.score * 100)}%</td>
                    <td class="r num">{st.wins} · {st.draws} · {st.losses}</td>
                    <td class="r"><a href={studyHref(st.opening, st.line, isWeak(st) ? 'games' : 'plans')}>{isWeak(st) ? 'Fix it' : 'Study'} →</a></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}
    {:else if tab === 'games'}
      <section class="card block">
        <h2 class="title">Games analysed</h2>
        <p class="label">Tap <strong>Review</strong> for the full move-by-move review: accuracy, and every brilliant, best, mistake and blunder move.</p>
        <ul class="games">
          {#each games as { g, s, sum } (g.game.url)}
            <li>
              <span class="res" class:win={s === 1} class:loss={s === 0}>{s === 1 ? 'Won' : s === 0 ? 'Lost' : 'Draw'}</span>
              <span class="g-main">
                <strong>vs {opponentOf(g.game)}</strong>
                <span class="label">{g.game.timeClass} · {g.game.opening ?? `${g.game.san.length} moves`}{g.game.endTime ? ` · ${formatDate(g.game.endTime)}` : ''}</span>
              </span>
              <span class="g-stats">
                <span class="acc num" title="Your accuracy">{sum.accuracy}%</span>
                {#if sum.blunders}<span class="pill blunder" title="Blunders">{sum.blunders} ??</span>{/if}
                {#if sum.mistakes}<span class="pill mistake" title="Mistakes">{sum.mistakes} ?</span>{/if}
              </span>
              <button class="btn small-btn" onclick={() => review(g.game)}><Icon name="analyse" size={15} />Review</button>
            </li>
          {/each}
        </ul>
      </section>
    {:else if preview}
      <section class="card block">
        <h2 class="title">Your plan for the next 7 days</h2>
        <p class="label">Built from these games, for a player rated about {preview.rating}. It goes into your daily study plan on Learn, with reminders, and ticks itself off as you do each task.</p>
        {#if preview.focus.length}
          <div class="focus">
            {#each preview.focus as f, i (f.title)}
              <div class="focus-item"><span class="w-no display">{i + 1}</span><span><strong>{f.title}</strong><span class="label">{f.evidence}</span></span></div>
            {/each}
          </div>
        {/if}
        <div class="week">
          {#each preview.days as d (d.day)}
            <div class="day-card" style="--tc: {TOPICS[d.topic].color}">
              <span class="day-h"><strong>{dayName(d.day)}</strong><span class="topic">{TOPICS[d.topic].label}</span></span>
              {#if !d.tasks.length}<span class="label">Rest day</span>{/if}
              {#each d.tasks as t (t.id)}
                <span class="task"><span>{t.title}</span><span class="label">{t.minutes} min</span></span>
              {/each}
            </div>
          {/each}
        </div>
        <div class="row">
          <button class="btn primary" onclick={makePlan}><Icon name="learn" size={18} />Add to my study plan</button>
          {#if ownMistakes}<a class="btn" href="/insights/mistakes"><Icon name="puzzle" size={18} />Solve my own mistakes</a>{/if}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .lich-need {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .lich-need p {
    margin: 0;
  }
  .page {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .hero {
    padding: 18px 20px;
    display: flex;
    gap: 18px;
    align-items: center;
  }
  .hero h1 {
    margin: 0 0 4px;
    font-size: 34px;
  }
  .hero p {
    margin: 0;
  }
  .kicker {
    display: inline-block;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 2px;
  }
  .how {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .step-no {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--action);
    color: var(--on-action);
    font-weight: 800;
    margin-bottom: 4px;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
    scrollbar-width: none;
  }
  .tabs button {
    flex: none;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-weight: 700;
    padding: 10px 14px;
    border-bottom: 3px solid transparent;
    cursor: pointer;
  }
  .tabs button.on {
    color: var(--text);
    border-bottom-color: var(--gold);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
    gap: 14px;
  }
  .top3 {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .link-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: none;
    border: 0;
    padding: 0;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .strengths {
    list-style: none;
    padding: 0;
    color: var(--win);
  }
  .strengths li {
    padding: 3px 0;
  }
  .ex-h {
    margin: 0;
    font-size: 13px;
  }
  .ex-move {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }
  .dotc {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--gold);
  }
  .dotc.blunder {
    background: var(--loss);
  }
  .dotc.mistake {
    background: #f97316;
  }
  .g-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .g-main .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .g-stats {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .acc {
    font-weight: 800;
    min-width: 42px;
    text-align: right;
  }
  .pill {
    font-size: 12px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 999px;
  }
  .pill.blunder {
    background: color-mix(in srgb, var(--loss) 22%, transparent);
    color: var(--loss);
  }
  .pill.mistake {
    background: color-mix(in srgb, #f97316 22%, transparent);
    color: #f97316;
  }
  .focus {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .focus-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .focus-item > span:last-child {
    display: flex;
    flex-direction: column;
  }
  .week {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 8px;
  }
  .day-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--raised);
    border-top: 4px solid var(--tc);
  }
  .day-h {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    align-items: baseline;
  }
  .topic {
    font-size: 12px;
    font-weight: 700;
    color: var(--tc);
  }
  .task {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 13.5px;
    line-height: 1.3;
  }
  .task .label {
    flex: none;
    font-size: 12px;
  }
  .connect {
    padding: 12px 14px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  .connect input,
  .connect select {
    font: inherit;
    padding: 9px 11px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
  }
  .connect input {
    flex: 1 1 200px;
    min-width: 0;
  }
  .prog {
    height: 10px;
    border-radius: 5px;
    background: var(--border);
    overflow: hidden;
  }
  .prog span {
    display: block;
    height: 100%;
    background: var(--brand);
    transition: width 0.3s;
  }
  .err {
    color: var(--loss);
    margin: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .study-call {
    border-color: color-mix(in srgb, var(--loss) 45%, var(--border));
  }
  .study-acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .block {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .block h2 {
    margin: 0;
    font-size: 19px;
  }
  .block p,
  .block ul {
    margin: 0;
  }
  .phase {
    display: grid;
    grid-template-columns: 100px 1fr auto;
    gap: 10px;
    align-items: center;
  }
  .bar {
    height: 10px;
    border-radius: 5px;
    background: var(--raised);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
  }
  .block-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pad {
    padding: 16px;
    margin: 0;
  }
  .weak {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .weak p {
    margin: 0;
  }
  .w-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .w-head h3 {
    margin: 0;
    flex: 1;
    font-size: 18px;
  }
  .w-no {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--loss);
    color: #fff;
    font-size: 16px;
  }
  .small-btn {
    padding: 5px 12px;
    min-height: 0;
  }
  .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ex {
    display: flex;
    flex-direction: column;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--raised);
    color: var(--text);
    text-decoration: none;
    font: inherit;
    font-size: 14px;
    border: 0;
    text-align: left;
    cursor: pointer;
    gap: 2px;
  }
  .ex:hover {
    outline: 1px solid var(--brand);
    text-decoration: none;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 6px;
    text-align: left;
    border-top: 1px solid var(--border);
  }
  th {
    font-size: 13px;
    color: var(--text-2);
    border-top: 0;
  }
  .r {
    text-align: right;
  }
  .good {
    color: var(--win);
    font-weight: 700;
  }
  .poor {
    color: var(--loss);
    font-weight: 700;
  }
  .games {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .games li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
  .games .res {
    width: 44px;
    flex: none;
    font-weight: 700;
  }
  .games .small-btn {
    flex: none;
    gap: 5px;
  }
  @media (max-width: 560px) {
    .games li {
      flex-wrap: wrap;
    }
    .g-main {
      flex-basis: calc(100% - 60px);
    }
    .g-stats {
      margin-left: 56px;
      flex: 1;
    }
  }
  .res.win {
    color: var(--win);
  }
  .res.loss {
    color: var(--loss);
  }
</style>
