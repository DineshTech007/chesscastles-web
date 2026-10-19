<script lang="ts">
  /**
   * Opening check-up (Learn → Openings → Your games): the player's last 100
   * rapid (and slower) games on chess.com and on Lichess, and their rapid and
   * classical games against FIDE-level opponents here; the lines where their results drop, what
   * strong players play there, and how to fix each line: learn it in the
   * trainer, explore it, play it against a FIDE-level opponent. The next
   * check-up shows what improved.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { lichessToken } from '$lib/auth';
  import { fetchOnline, loadOnline, ONLINE_COUNT, SITE_NAME, type OnlineSite } from './myOnlineGames';
  import { loadInsights } from '$lib/insights/store';
  import { shownGames, kfideAll } from '$lib/stores/me';
  import { outcome, type SavedGame } from '$lib/stores/myGames';
  import { speedOf } from '$lib/kfide';
  import { moveToUci, playSans, positionFromFen, sanOf, START_FEN } from '$lib/chess/position';
  import { parseSan } from 'chessops/san';
  import { CloudBook, movesInRange } from '$lib/book/book';
  import { addCustomOpening } from '$lib/customOpenings';
  import { savedAsImported, studyHref, studyLineOf } from './fromGames';
  import { bestLines, fromOnline, loadCheckups, movesText, problemLines, saveCheckup, type CheckupGame, type ProblemLine, type SavedCheckup } from './checkup';
  import { track } from '$lib/analytics';
  import { loadLibrary } from '$lib/coach/content/openings';

  const GAMES_KEY = 'cc.openingCheckup.games';

  let username = $state('');
  let lichessName = $state('');
  let withCc = $state(true);
  let busy = $state(false);
  let found = $state(0);
  /** The Lichess login, which Lichess needs to share a player's games. */
  const lichessLogin = typeof window !== 'undefined' ? lichessToken() : undefined;
  let error = $state('');
  let games = $state<CheckupGame[] | undefined>();
  let checkedAt = $state(0);
  /** The check-up before this one, to show what changed. */
  let last = $state<SavedCheckup | undefined>();
  let open = $state<string | undefined>();

  onMount(() => {
    const saved = loadCheckups();
    try {
      const g = JSON.parse(localStorage.getItem(GAMES_KEY) ?? 'null');
      if (g && Array.isArray(g.games)) {
        games = g.games;
        checkedAt = g.at;
        username = g.username ?? '';
        lichessName = g.lichess ?? '';
        last = saved.find((c) => c.at < g.at);
      }
    } catch {
      /* none saved */
    }
    const online = loadOnline();
    if (!username) {
      const ins = loadInsights();
      username = online.chesscom?.username || saved[0]?.username || (ins?.site === 'chesscom' ? ins.username : '');
    }
    if (!lichessName && !games) lichessName = online.lichess?.username || lichessLogin?.username || '';
  });

  /** Chess Castles games against FIDE-level opponents, rapid and classical only. */
  const ccGames = $derived(
    $shownGames
      .filter((g) => g.kind === 'fide' && (speedOf(g.timeControl) === 'rapid' || speedOf(g.timeControl) === 'standard'))
      .map(ccGame)
      .filter((g): g is CheckupGame => !!g),
  );

  function ccGame(g: SavedGame): CheckupGame | undefined {
    const o = outcome(g);
    const imp = savedAsImported(g);
    if (!imp || o === 'unfinished' || imp.san.length < 6) return undefined;
    return { source: 'chesscastles', ref: g.id, at: g.playedAt, color: g.userSide, score: o === 'won' ? 1 : o === 'draw' ? 0.5 : 0, san: imp.san, opponent: g.userSide === 'white' ? g.black : g.white };
  }

  async function run(e?: Event) {
    e?.preventDefault();
    error = '';
    const user = username.trim();
    const lich = lichessName.trim();
    if (!user && !lich && !(withCc && ccGames.length)) {
      error = 'Type your chess.com or Lichess username.';
      return;
    }
    busy = true;
    found = 0;
    try {
      // Both sites at once; a site that fails doesn't stop the other.
      const notes: string[] = [];
      const read = async (site: OnlineSite, name: string) => {
        if (!name) return [];
        if (site === 'lichess' && !lichessLogin) {
          notes.push('Connect your Lichess account (Play → Online) to include your Lichess games.');
          return [];
        }
        try {
          return (await fetchOnline(site, name, lichessLogin?.token, (n) => (found = n))).map(fromOnline);
        } catch (err) {
          notes.push(`${SITE_NAME[site]}: ${err instanceof Error ? err.message : 'the games could not be read.'}`);
          return [];
        }
      };
      const [cc, li] = await Promise.all([read('chesscom', user), read('lichess', lich)]);
      const all = [...cc, ...li, ...(withCc ? ccGames : [])].sort((a, b) => b.at - a.at);
      error = notes.join(' ');
      if (!all.length) throw new Error(error || 'No rapid or slower games found to check.');
      last = loadCheckups()[0];
      games = all;
      checkedAt = Date.now();
      try {
        localStorage.setItem(GAMES_KEY, JSON.stringify({ at: checkedAt, username: user, lichess: lich, games: all }));
      } catch {
        /* storage full: this visit only */
      }
      saveCheckup({ at: checkedAt, username: user, games: all.length, lines: problemLines(all).map((l) => ({ key: l.key, games: l.games, score: l.score })) });
      track('feature', 'opening_checkup');
    } catch (err) {
      error = err instanceof Error ? err.message : 'The games could not be read. Try again.';
    } finally {
      busy = false;
    }
  }

  const problems = $derived(games ? problemLines(games) : []);
  const best = $derived(games ? bestLines(games) : []);
  const shown = $derived(problems.slice(0, 8));
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const scoreOf = (list: CheckupGame[]) => (list.length ? list.reduce((a, g) => a + g.score, 0) / list.length : 0);
  const asWhite = $derived(games?.filter((g) => g.color === 'white') ?? []);
  const asBlack = $derived(games?.filter((g) => g.color === 'black') ?? []);
  /** How many of the games came from each place. */
  const bySource = $derived(
    (['chesscom', 'lichess', 'chesscastles'] as const)
      .map((src) => ({ src, n: games?.filter((g) => g.source === src).length ?? 0 }))
      .filter((x) => x.n),
  );
  const SOURCE_NAME = { chesscom: 'chess.com', lichess: 'Lichess', chesscastles: 'Chess Castles (FIDE-level opponents)' };
  /** Lines that were a problem last time and no longer are. */
  const fixed = $derived(last && games ? last.lines.filter((l) => !problems.some((p) => p.key === l.key)) : []);
  const before = (l: ProblemLine) => last?.lines.find((x) => x.key === l.key);
  const keyText = (key: string) => {
    const [color, moves] = key.split(':');
    return `${movesText(moves.split(' '))} (as ${color === 'white' ? 'White' : 'Black'})`;
  };
  const dateText = (at: number) => new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // What strong players play: at the line's end when it's the player's move, else instead of their last move.
  const book = new CloudBook();
  let advice = $state<Record<string, { moves: { san: string; games: number; score: number; mine: boolean }[]; top: string } | null>>({});
  async function loadAdvice(l: ProblemLine) {
    if (advice[l.key] !== undefined) return;
    advice[l.key] = null;
    try {
      const sans = l.yourMove ? l.sans.slice(0, -1) : l.sans;
      const pos = playSans(sans.join(' '));
      const entries = await book.entries(pos);
      let list = movesInRange(entries, 2000).filter((m) => pos.isLegal(m.move));
      if (list.reduce((a, m) => a + m.games, 0) < 20) list = movesInRange(entries, 0).filter((m) => pos.isLegal(m.move));
      const total = list.reduce((a, m) => a + m.games, 0);
      if (!total) return;
      const mineSans = new Set(l.yourMove ? [l.sans[l.sans.length - 1]] : l.next.map((n) => n.san));
      const moves = list.slice(0, 4).map((m) => {
        const san = sanOf(pos, m.move);
        return { san, games: m.games, score: (m.wins + m.draws / 2) / m.games, mine: mineSans.has(san) };
      });
      advice[l.key] = { moves, top: moves[0]?.san ?? '' };
    } catch {
      /* no database answer */
    }
  }
  $effect(() => {
    for (const l of shown.slice(0, 4)) void loadAdvice(l);
  });

  // Lines are named from the opening library (3,865 named lines): the longest one the moves follow.
  let library = $state<Map<string, string> | undefined>();
  $effect(() => {
    if (games && !library)
      void loadLibrary()
        .then((rows) => {
          const m = new Map<string, string>();
          for (const [, name, line] of rows) if (!m.has(line)) m.set(line, name);
          library = m;
        })
        .catch(() => {});
  });
  const lineName = (l: Pick<ProblemLine, 'name' | 'sans'>) => {
    for (let k = l.sans.length; k > 0 && library; k--) {
      const name = library.get(l.sans.slice(0, k).join(' '));
      if (name) return name;
    }
    return 'Your line';
  };
  /** The player already plays strong players' main move here: the trouble comes later in the game. */
  const mainAlready = (l: ProblemLine) => {
    const a = advice[l.key];
    if (!a?.moves.length) return false;
    const theirs = l.yourMove ? l.sans[l.sans.length - 1] : l.next[0]?.san;
    return a.moves.slice(0, 2).some((m) => m.san === theirs);
  };
  /** The line and, when it is the player's move, strong players' choice: what the trainer teaches. */
  const lineToLearn = (l: ProblemLine) => {
    const a = advice[l.key];
    if (l.yourMove) return a?.top ? [...l.sans.slice(0, -1), a.top] : l.sans;
    return a?.top ? [...l.sans, a.top] : l.sans;
  };

  function learn(l: ProblemLine) {
    const r = addCustomOpening(lineToLearn(l).join(' '), l.color, `Fix: ${lineName(l)} (from your games)`);
    if (typeof r === 'string') error = r;
    else goto(`/learn/openings/${r.id}`);
  }
  function explore(l: ProblemLine) {
    try {
      sessionStorage.setItem('k24.importPgn', `[White "${lineName(l).replace(/"/g, '')}"]\n[Black "your line"]\n\n${movesText(l.sans)} *\n`);
    } catch {
      return;
    }
    goto(`/analysis?import=1&tab=database`);
  }
  function review(g: CheckupGame) {
    if (g.source === 'chesscastles') return goto(`/analysis?game=${encodeURIComponent(g.ref)}&review`);
    try {
      const me = g.source === 'lichess' ? lichessName : username;
      sessionStorage.setItem('k24.importPgn', `[Site "${g.ref}"]\n[White "${g.color === 'white' ? me : g.opponent}"]\n[Black "${g.color === 'black' ? me : g.opponent}"]\n\n${movesText(g.san)} *\n`);
    } catch {
      return;
    }
    goto('/analysis?import=1&review');
  }
  /** A FIDE-level opponent near the player's rapid rating, from the line's position, 15+10. */
  const playHref = (l: ProblemLine) => {
    const r = Math.min(2800, Math.max(1400, Math.round(($kfideAll.rapid.games ? $kfideAll.rapid.rating : 1500) / 100) * 100));
    const q = new URLSearchParams({ r: String(r), tc: '2', c: l.color, o: 'line', moves: l.sans.join(' '), start: 'line', name: lineName(l) });
    return `/play/fide?${q}`;
  };
  /** The opening course for the line, when there is one (the Caro-Kann's Advance Variation…). */
  const courseOf = (l: ProblemLine) => {
    const pos = positionFromFen(START_FEN);
    const uci: string[] = [];
    for (const san of l.sans) {
      const m = parseSan(pos, san);
      if (!m || !('from' in m)) return undefined;
      uci.push(moveToUci(m));
      pos.play(m);
    }
    return studyLineOf(uci, l.color);
  };
</script>

<section class="checkup" aria-label="Your opening check-up">
  <form class="card head" onsubmit={run}>
    <div class="h-text">
      <h2 class="title"><Icon name="search" size={20} color="var(--accent)" />Your opening check-up</h2>
      <p class="label">
        Your last {ONLINE_COUNT} rapid games on chess.com and on Lichess{withCc ? ', and your rapid and classical games against FIDE-level opponents here' : ''}: the lines where your results drop, what strong players play there, and how to fix them. Bullet and blitz don't count: fast games say more about the clock than about the opening.
      </p>
    </div>
    <div class="h-row">
      <input bind:value={username} placeholder="chess.com username" aria-label="chess.com username" autocomplete="off" disabled={busy} />
      <input bind:value={lichessName} placeholder="Lichess username (optional)" aria-label="Lichess username" autocomplete="off" disabled={busy} />
      <button class="btn primary" type="submit" disabled={busy}>
        {busy ? `Reading your games… ${found}` : games ? 'Check again' : 'Check my openings'}
      </button>
    </div>
    <label class="cc"><input type="checkbox" bind:checked={withCc} disabled={busy} />Also my games against FIDE-level opponents here ({ccGames.length} rapid or classical)</label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </form>

  {#if games}
    <div class="card summary">
      <span><strong class="num">{games.length}</strong> <span class="label">games checked · {dateText(checkedAt)}</span></span>
      <span class="sources">
        {#each bySource as b (b.src)}<span class="src-chip"><strong class="num">{b.n}</strong> {SOURCE_NAME[b.src]}</span>{/each}
      </span>
      <span><span class="dot white"></span>As White <strong class="num">{pct(scoreOf(asWhite))}</strong> <span class="label">in {asWhite.length}</span></span>
      <span><span class="dot black"></span>As Black <strong class="num">{pct(scoreOf(asBlack))}</strong> <span class="label">in {asBlack.length}</span></span>
      {#if last}<span class="label">Last check-up: {dateText(last.at)}, {last.lines.length} problem {last.lines.length === 1 ? 'line' : 'lines'}</span>{/if}
    </div>

    {#if fixed.length}
      <div class="card fixed">
        <h3 class="title"><Icon name="check" size={18} color="var(--good, #22c55e)" />Fixed since your last check-up</h3>
        <ul>
          {#each fixed as f (f.key)}<li>{keyText(f.key)}: was {pct(f.score)} in {f.games} games</li>{/each}
        </ul>
      </div>
    {/if}

    {#if !problems.length}
      <div class="card empty">
        <strong>No problem lines!</strong>
        <span class="label">In these games no line lost at least 2 of 3 games or more. Keep playing rapid games and check again in a few weeks.</span>
      </div>
    {:else}
      <h3 class="title list-h">Lines to fix ({problems.length})</h3>
      <ol class="lines">
        {#each shown as l, i (l.key)}
          {@const a = advice[l.key]}
          {@const prev = before(l)}
          {@const course = courseOf(l)}
          {@const lastMove = movesText(l.sans).split(' ').slice(-1)[0]}
          <li class="card line">
            <div class="l-top">
              <span class="rank num">{i + 1}</span>
              <span class="dot {l.color}" title="You play {l.color}"></span>
              <span class="l-name">
                <strong>{lineName(l)}</strong>
                <span class="moves num">{movesText(l.sans)}</span>
              </span>
              <span class="score num" class:bad={l.score <= 0.25}>{pct(l.score)}</span>
            </div>
            <p class="why">
              {#if l.yourMove}
                After your move <strong>{l.sans[l.sans.length - 1]}</strong> you scored {pct(l.score)} ({l.wins}W {l.draws}D {l.losses}L in {l.games} games), against {pct(l.before.score)} one move earlier.
              {:else}
                When your opponent plays <strong>{l.sans[l.sans.length - 1]}</strong> you scored {pct(l.score)} ({l.wins}W {l.draws}D {l.losses}L in {l.games} games), against {pct(l.before.score)} one move earlier.{#if !mainAlready(l)}
                  Learn the best answer to it.{/if}
              {/if}
              {#if mainAlready(l)}<span class="tip">You already play one of strong players' main moves here, so the trouble comes a little later: open your games below and see where they went wrong.</span>{/if}
              {#if prev}<span class="trend">Last check-up: {pct(prev.score)} in {prev.games} games.</span>{/if}
            </p>
            {#if l.next.length}
              <div class="next">
                <span class="label">{l.yourMove ? 'Their answers:' : 'What you played next:'}</span>
                {#each l.next.slice(0, 4) as n (n.san)}<span class="pill-s">{n.san} <span class="label">{n.games}× · {pct(n.score)}</span></span>{/each}
              </div>
            {/if}
            {#if a}
              <div class="next strong">
                <span class="label">{l.yourMove ? `Instead of ${lastMove}, strong players play:` : 'Strong players play here:'}</span>
                {#each a.moves as m (m.san)}<span class="pill-s" class:mine={m.mine}>{m.san} <span class="label">{m.games.toLocaleString('en-IN')} games · {pct(m.score)}</span></span>{/each}
              </div>
            {:else if a === undefined}
              <button class="btn small ghost" onclick={() => loadAdvice(l)}>What do strong players play?</button>
            {/if}
            <div class="acts">
              <button class="btn primary small" onclick={() => learn(l)}><Icon name="tree" size={15} />Learn the line</button>
              {#if course}<a class="btn small" href={studyHref(course.opening, course.line, 'plans')}><Icon name="learn" size={15} />Course</a>{/if}
              <button class="btn small" onclick={() => explore(l)}><Icon name="database" size={15} />Explore</button>
              <a class="btn small" href={playHref(l)}><Icon name="knight" size={15} />Play it</a>
              <button class="btn small ghost" onclick={() => (open = open === l.key ? undefined : l.key)} aria-expanded={open === l.key}>Your games ({l.games})</button>
            </div>
            {#if open === l.key}
              <ul class="games">
                {#each l.list as g (g.ref)}
                  <li>
                    <span class="res {g.score === 1 ? 'w' : g.score === 0 ? 'l' : 'd'}">{g.score === 1 ? 'W' : g.score === 0 ? 'L' : '½'}</span>
                    <span class="g-who">vs {g.opponent} <span class="label">· {g.source === 'chesscastles' ? 'Chess Castles' : SITE_NAME[g.source]} · {dateText(g.at)}</span></span>
                    <button class="btn small" onclick={() => review(g)}>Review</button>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    {#if best.length}
      <div class="card best">
        <h3 class="title"><Icon name="star" size={18} color="var(--accent)" />Your best lines</h3>
        <ul>
          {#each best as b (b.color + b.sans.join(' '))}
            <li><span class="dot {b.color}"></span><strong>{lineName(b)}</strong> <span class="moves num">{movesText(b.sans)}</span> <span class="label">{pct(b.score)} in {b.games} games</span></li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</section>

<style>
  .checkup {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }
  .head h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 19px;
  }
  .head p {
    margin: 4px 0 0;
    max-width: 760px;
  }
  .h-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .h-row input {
    flex: 1 1 200px;
    min-height: 44px;
  }
  .sources {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex-basis: 100%;
  }
  .src-chip {
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-size: 13.5px;
    color: var(--text-2);
  }
  .src-chip strong {
    color: var(--text);
  }
  .cc {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 14px;
    color: var(--text-2);
  }
  .error {
    margin: 0;
    color: var(--bad, #ef4444);
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 22px;
    align-items: center;
    padding: 12px 16px;
  }
  .dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid var(--border);
    vertical-align: -1px;
    margin-right: 6px;
    flex: none;
  }
  .dot.white {
    background: #f4f1ea;
  }
  .dot.black {
    background: #1b1b1b;
  }
  .fixed,
  .best,
  .empty {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fixed h3,
  .best h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }
  .fixed ul,
  .best ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .list-h {
    margin: 6px 0 0;
    font-size: 17px;
  }
  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .line {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .l-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .rank {
    width: 26px;
    height: 26px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--raised);
    font-weight: 800;
    font-size: 13px;
  }
  .l-name {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .moves {
    color: var(--text-2);
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .score {
    font-weight: 800;
    font-size: 20px;
    color: var(--warn, #f59e0b);
  }
  .score.bad {
    color: var(--bad, #ef4444);
  }
  .why {
    margin: 0;
    line-height: 1.45;
  }
  .tip {
    display: block;
    margin-top: 4px;
    font-size: 14px;
    color: var(--text-2);
  }
  .trend {
    display: block;
    color: var(--text-2);
    font-size: 13.5px;
    margin-top: 2px;
  }
  .next {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .pill-s {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-weight: 700;
    font-size: 14px;
  }
  .pill-s.mine {
    border-style: dashed;
  }
  .strong .pill-s:first-of-type {
    border-color: var(--accent);
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .acts :global(svg) {
    margin-right: 4px;
  }
  .games {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--border-soft);
    padding-top: 10px;
  }
  .games li {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .res {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 13px;
    color: #fff;
    background: #64748b;
  }
  .res.w {
    background: #16a34a;
  }
  .res.l {
    background: #dc2626;
  }
  .g-who {
    flex: 1;
    min-width: 0;
  }
</style>
