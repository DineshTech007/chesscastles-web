<script lang="ts">
  /**
   * Fair play review (admin): players the server's checks flagged (server/api-worker/src/fairplay.ts), most
   * urgent first. For each: why (the signals and how often), their recent games against FIDE-level opponents
   * with each game's signals, the flagged games to open in the analysis board (the engine shows how close to
   * it they played), and the decision: clear, warn, or judged cheating (their games stop counting and they
   * leave the leaderboards). Nobody is punished automatically: from 70 points a player is only held off the
   * leaderboards until someone looks.
   */
  import { goto } from '$app/navigation';
  import { call } from '$lib/social';
  import { pgnOfSaved, type SavedGame } from '$lib/stores/myGames';
  import type { Can } from '$lib/admin';

  let { can }: { can: Can[] } = $props();

  interface Flagged {
    uid: string;
    score: number;
    reasons: string;
    updated: number;
    status: string;
    note: string;
    name?: string;
    username?: string;
    kfide?: number;
    kfide_games?: number;
  }
  interface RatedGame {
    id: string;
    speed: string;
    played: number;
    opp: number;
    score: number;
    counted: number;
    flags: string;
    plies: number;
    user_secs: number;
    blurs: number;
    acc: number;
  }

  let list = $state<Flagged[] | undefined>();
  let error = $state('');
  let open = $state<{ uid: string; fairPlay?: Flagged; games: RatedGame[]; data: Record<string, string> } | undefined>();
  let note = $state('');
  let busy = $state(false);
  let done = $state('');

  const load = () =>
    call<{ players: Flagged[] }>('GET', 'admin/fairplay').then(
      (r) => (list = r.players),
      (e) => (error = e instanceof Error ? e.message : 'Could not load.'),
    );
  $effect(() => void load());

  async function show(uid: string) {
    done = '';
    note = '';
    open = { uid, ...(await call<{ fairPlay?: Flagged; games: RatedGame[]; data: Record<string, string> }>('GET', `admin/fairplay/${encodeURIComponent(uid)}`)) };
    note = open.fairPlay?.note ?? '';
  }
  async function act(action: 'clear' | 'warn' | 'cheater' | 'reopen') {
    if (!open) return;
    busy = true;
    try {
      await call('POST', 'admin/fairplay', { uid: open.uid, action, note });
      done = { clear: 'Cleared: the signals so far are set aside.', warn: 'Warned.', cheater: 'Marked as cheating: their games no longer count and they are off the leaderboards.', reopen: 'Open again.' }[action];
      await load();
      await show(open.uid);
    } catch (e) {
      done = e instanceof Error ? e.message : 'Could not save.';
    } finally {
      busy = false;
    }
  }
  function analyse(id: string) {
    const raw = open?.data[id];
    if (!raw) return;
    try {
      sessionStorage.setItem('k24.importPgn', pgnOfSaved(JSON.parse(raw) as SavedGame));
      void goto('/analysis?import=1&review=1');
    } catch {
      done = 'That game could not be opened.';
    }
  }

  /** The signals, as words. */
  const SIGNAL: Record<string, string> = {
    illegal: 'illegal moves',
    result: 'result does not follow from the moves',
    clock: 'more time than the clock allowed',
    fast: 'very fast moves, strong result',
    steady: 'machine-like steady move times',
    tab: 'left the tab during their turn (4+)',
    tab2: 'left the tab during their turn (8+)',
    accuracy: 'accuracy 93%+ vs 1900+',
    accuracy2: 'accuracy 97%+ vs 1900+',
    upset: 'win vs a much stronger opponent',
    noclock: 'win on time without move times',
    climb: 'big rating climb in a day',
    perf: '80%+ against 2400+',
  };
  const reasonText = (r: string) =>
    r
      .split(' ')
      .filter(Boolean)
      .map((x) => {
        const [k, n] = x.split('×');
        return x.startsWith('climb') ? `rating climb ${x.slice(5)}` : x === 'perf2400' ? SIGNAL.perf : `${SIGNAL[k] ?? k}${n ? ` ×${n}` : ''}`;
      })
      .join(' · ');
  const STATUS: Record<string, [string, string]> = {
    hold: ['Held (off leaderboards)', 'var(--loss)'],
    open: ['To review', 'var(--gold)'],
    warned: ['Warned', '#c084fc'],
    cheater: ['Cheating', 'var(--loss)'],
    cleared: ['Cleared', 'var(--win)'],
  };
  const date = (t: number) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const res = (s: number) => (s === 1 ? 'Won' : s === 0.5 ? 'Draw' : 'Lost');
</script>

<div class="fp">
  <p class="label intro">
    Every game against a FIDE-level opponent is replayed and checked on the server. Players whose recent games add up to 30 points of signals are listed here; from 70
    they are kept off the leaderboards until someone looks. Open the flagged games in the analysis board to judge them.
  </p>
  {#if error}
    <p class="err">{error}</p>
  {:else if !list}
    <div class="card skel"></div>
  {:else if !list.length}
    <p class="card ok">No player flagged. Every checked game looks fair.</p>
  {:else}
    <div class="cols">
      <ul class="list card">
        {#each list as p (p.uid)}
          <li>
            <button class="row" class:on={open?.uid === p.uid} onclick={() => show(p.uid)}>
              <span class="who"><strong>{p.name ?? p.uid}</strong><span class="label">@{p.username ?? ''} · CC {p.kfide ?? '–'}</span></span>
              <span class="st" style="--c: {STATUS[p.status]?.[1] ?? 'var(--muted)'}">{STATUS[p.status]?.[0] ?? p.status}</span>
              <strong class="num score">{p.score}</strong>
            </button>
          </li>
        {/each}
      </ul>
      {#if open}
        <section class="card detail">
          <h3 class="title">{open.fairPlay?.name ?? list.find((x) => x.uid === open!.uid)?.name ?? open.uid}</h3>
          {#if open.fairPlay}
            <p><span class="st" style="--c: {STATUS[open.fairPlay.status]?.[1]}">{STATUS[open.fairPlay.status]?.[0]}</span> <strong class="num">{open.fairPlay.score}</strong> points</p>
            <p class="label">{reasonText(open.fairPlay.reasons) || 'No signals since the last review.'}</p>
          {/if}
          {#if can.includes('suspend')}
            <label class="note"><span class="label">Note (kept with the decision)</span><input bind:value={note} maxlength="300" placeholder="What you saw in the games" /></label>
            <div class="acts">
              <button class="btn" disabled={busy} onclick={() => act('clear')}>Clear</button>
              <button class="btn" disabled={busy} onclick={() => act('warn')}>Warn</button>
              <button class="btn danger" disabled={busy} onclick={() => act('cheater')}>Cheating</button>
              <button class="btn ghost" disabled={busy} onclick={() => act('reopen')}>Reopen</button>
            </div>
          {/if}
          {#if done}<p class="done">{done}</p>{/if}
          <h4>Recent games against FIDE-level opponents</h4>
          <div class="tw">
            <table>
              <thead><tr><th>When</th><th>Speed</th><th>Opp.</th><th>Result</th><th>Counts</th><th>Moves</th><th>Tab</th><th>Acc.</th><th>Signals</th><th></th></tr></thead>
              <tbody>
                {#each open.games as g (g.id)}
                  <tr class:flag={!!g.flags}>
                    <td class="nowrap">{date(g.played)}</td>
                    <td>{g.speed}</td>
                    <td class="num">{g.opp}</td>
                    <td>{res(g.score)}</td>
                    <td>{g.counted === 1 ? 'Yes' : g.counted === -1 ? 'Waiting' : 'No'}</td>
                    <td class="num">{Math.ceil(g.plies / 2)}</td>
                    <td class="num">{g.blurs}</td>
                    <td class="num">{g.acc >= 0 ? `${g.acc}%` : '–'}</td>
                    <td class="sig">{g.flags ? g.flags.split(',').map((f) => SIGNAL[f] ?? f).join(', ') : ''}</td>
                    <td>{#if open.data[g.id]}<button class="btn small" onclick={() => analyse(g.id)}>Analyse</button>{/if}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .fp {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .intro {
    margin: 0;
  }
  .skel {
    height: 200px;
  }
  .ok {
    color: var(--win);
    font-weight: 700;
  }
  .err {
    color: var(--loss);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 4px;
    max-height: 70vh;
    overflow: auto;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row.on,
  .row:hover {
    background: var(--raised);
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .score {
    font-size: 18px;
  }
  .st {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    white-space: nowrap;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, transparent);
  }
  .detail {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .detail h3,
  .detail h4,
  .detail p {
    margin: 0;
  }
  .note {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .note input {
    font: inherit;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .danger {
    background: var(--loss);
    color: #fff;
  }
  .done {
    color: var(--accent);
    font-weight: 600;
  }
  .tw {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    font-size: 12px;
    color: var(--muted);
    padding: 6px;
  }
  td {
    padding: 6px;
    border-top: 1px solid var(--border);
  }
  tr.flag td {
    background: color-mix(in srgb, var(--loss) 7%, transparent);
  }
  .sig {
    min-width: 160px;
  }
  .nowrap {
    white-space: nowrap;
  }
  @media (max-width: 800px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
</style>
