<script lang="ts">
  /**
   * A player's Lichess side on their profile: ratings, and for friends the
   * game they are playing now (to watch live) and their latest games (to
   * review in Analyse).
   */
  import { goto } from '$app/navigation';
  import Icon from './Icon.svelte';
  import { lichessProfile, lichessStatus, type LichessProfile } from '$lib/lichess';
  import { lichessGames, type ImportedGame } from '$lib/insights/games';
  import { formatDate } from '$lib/format';

  let { id, full = false, onprofile }: { id: string; full?: boolean; onprofile?: (p: LichessProfile | undefined) => void } = $props();

  let profile = $state<LichessProfile | undefined>();
  let loaded = $state(false);
  let playing = $state<string | undefined>();
  let games = $state<ImportedGame[] | undefined>();
  let gamesError = $state('');
  let opening = $state('');

  $effect(() => {
    const who = id;
    loaded = false;
    void lichessProfile(who).then((p) => {
      profile = p;
      loaded = true;
      onprofile?.(p);
    });
    const check = () => lichessStatus([who]).then((m) => (playing = m.get(who)?.playingId)).catch(() => {});
    void check();
    const t = setInterval(check, 30_000);
    if (!full) return () => clearInterval(t);
    games = undefined;
    lichessGames(who, 8).then(
      (g) => (games = g.slice(0, 8)),
      (e) => ((gamesError = e instanceof Error ? e.message : 'Games could not be loaded.'), (games = [])),
    );
    return () => clearInterval(t);
  });

  const PERF: Record<string, string> = { classical: 'Classical', rapid: 'Rapid', blitz: 'Blitz', bullet: 'Bullet', correspondence: 'Daily', puzzle: 'Puzzles' };
  const gameId = (g: ImportedGame) => g.url.split('/').pop()!;
  const score = (g: ImportedGame) => (g.result === '1/2-1/2' ? 'draw' : (g.result === '1-0') === (g.userColor === 'white') ? 'won' : 'lost');

  async function review(g: ImportedGame) {
    opening = gameId(g);
    try {
      const res = await fetch(`https://lichess.org/game/export/${gameId(g)}?clocks=false&evals=false`, { headers: { Accept: 'application/x-chess-pgn' } });
      if (!res.ok) throw new Error();
      sessionStorage.setItem('k24.importPgn', await res.text());
      await goto('/analysis?import=1&review=1');
    } catch {
      opening = '';
    }
  }
</script>

{#if loaded && profile}
  <section class="card lp">
    <div class="lp-head">
      <h2 class="title">On Lichess</h2>
      <span class="label">@{profile.username}</span>
    </div>

    {#if playing}
      <a class="live" href="/watch/live/{playing}">
        <span class="pulse"></span>
        <span class="ltext"><strong>Playing now</strong><span class="label">Watch the game live</span></span>
        <Icon name="chevron" />
      </a>
    {/if}

    {#if profile.perfs.length}
      <div class="perfs">
        {#each profile.perfs as p (p.key)}
          <div class="perf">
            <span class="label">{PERF[p.key] ?? p.key}</span>
            <strong class="num">{p.rating}{p.provisional ? '?' : ''}</strong>
            {#if p.key !== 'puzzle'}<span class="label small">{p.games} games</span>{/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if full}
      <h3 class="sub">Latest games</h3>
      {#if !games}
        <p class="label">Loading games…</p>
      {:else if !games.length}
        <p class="label">{gamesError || 'No rated games yet.'}</p>
      {:else}
        <ul class="games">
          {#each games as g (g.url)}
            <li>
              <span class="res {score(g)}">{score(g) === 'won' ? 'W' : score(g) === 'lost' ? 'L' : '½'}</span>
              <span class="gtext">
                <strong>vs {g.userColor === 'white' ? g.black : g.white}</strong>
                <span class="label">{g.timeClass} · {g.opening ?? `${g.san.length} moves`} · {formatDate(g.endTime)}</span>
              </span>
              <button class="btn small" disabled={opening === gameId(g)} onclick={() => review(g)}>
                <Icon name="analyse" size={15} />{opening === gameId(g) ? 'Opening…' : 'Review'}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <p class="label">Become friends to see their latest games.</p>
    {/if}
  </section>
{/if}

<style>
  .lp {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .lp-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .lp-head h2 {
    margin: 0;
    font-size: 19px;
  }
  .live {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--loss);
    background: color-mix(in srgb, var(--loss) 12%, transparent);
    color: var(--text);
    text-decoration: none;
  }
  .ltext {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .pulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--loss);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
  .perfs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
  }
  .perf {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--raised);
  }
  .perf strong {
    font-size: 22px;
  }
  .small {
    font-size: 12px;
  }
  .sub {
    margin: 4px 0 0;
    font-size: 15px;
  }
  .games {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .games li {
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
  .gtext {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .gtext .label {
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
