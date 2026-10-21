<script lang="ts" module>
  import { puzzleLeaders } from '$lib/leaderboard';

  /** The leaderboard, read once for 10 minutes (each read costs a database read per player). */
  let cached: { at: number; rows: Promise<{ uid: string; name: string; rating: number }[]> } | undefined;
  function readLeaders() {
    if (!cached || Date.now() - cached.at > 10 * 60_000) {
      const rows = puzzleLeaders(TOP).then((list) => list.map((p) => ({ uid: p.uid, name: p.name, rating: p.ratings.puzzle })));
      rows.catch(() => (cached = undefined));
      cached = { at: Date.now(), rows };
    }
    return cached.rows;
  }
  const TOP = 50;
</script>

<script lang="ts">
  /**
   * Where the player stands among Chess Castles' puzzle solvers (the owner, 2026-10-21: "how they can reach the
   * ladder"): their place, the players just above and below, and the points to pass the next one. It follows the
   * rating after every puzzle without asking the database again (the list is read at most every 10 minutes). A
   * visitor is asked to sign in; a new player sees that the ladder opens once their level is found.
   */
  import { session, startSignIn } from '$lib/auth';
  import { PLACEMENT, puzzlePlaced, puzzleProvisional, puzzleRating, puzzleStats } from './rating';

  type Row = { uid: string; name: string; rating: number };

  let others = $state<Row[] | undefined>();
  /** Whether the list read was full (players below it are not on the ladder's first page). */
  let full = false;
  const uid = $derived($session.status === 'in' ? $session.uid : undefined);

  $effect(() => {
    if (uid && !$puzzleProvisional) void load(uid);
  });
  async function load(me: string) {
    try {
      const all = await readLeaders();
      full = all.length >= TOP;
      others = all.filter((r) => r.uid !== me);
    } catch {
      others = undefined;
    }
  }

  /** The player's place, with the rows around it. */
  const place = $derived.by(() => {
    if (!others || !uid) return undefined;
    const mine: Row = { uid, name: 'You', rating: $puzzleRating };
    // Ties: the player first.
    const list = [...others, mine].sort((a, b) => b.rating - a.rating || (a.uid === uid ? -1 : b.uid === uid ? 1 : 0));
    const i = list.findIndex((r) => r.uid === uid);
    // Under a full first page: the points to get onto it.
    if (full && i >= TOP) return { rank: undefined, toTop: list[TOP - 1].rating - mine.rating + 1, above: undefined, pass: 0, near: [] };
    const near = list.slice(Math.max(0, i - 1), i + 2).map((r) => ({ ...r, at: list.indexOf(r) + 1, me: r.uid === uid }));
    const above: Row | undefined = list[i - 1];
    return { rank: i + 1, toTop: 0, above, pass: above ? above.rating - mine.rating + 1 : 0, near };
  });
</script>

<section class="card plad">
  <h3 class="title h"><img src="/puzzles/medal-crown.webp" alt="" width="34" height="34" />Puzzle ladder</h3>
  {#if $session.status !== 'in'}
    <p class="label">See your place among Chess Castles' puzzle solvers and climb past them, one puzzle at a time.</p>
    <button class="btn primary" onclick={() => startSignIn()}>Sign in free to join</button>
  {:else if $puzzleProvisional}
    <p class="label">Your place on the ladder appears when your level is found: <b class="num">{$puzzlePlaced}</b> of {PLACEMENT} puzzles done.</p>
  {:else if place}
    {#if place.rank}
      <div class="rank">
        <strong class="display num">#{place.rank}</strong>
        <span>{place.rank === 1 ? 'Top of the ladder! Keep your crown.' : place.above ? `${place.pass} point${place.pass === 1 ? '' : 's'} to pass ${place.above.name}` : ''}</span>
      </div>
      <ol class="near">
        {#each place.near as r (r.uid)}
          <li class:me={r.me}><span class="at num">{r.at}</span><span class="nm">{r.me ? 'You' : r.name}</span><span class="num">{r.rating}</span></li>
        {/each}
      </ol>
      <p class="label small">Every first-try solve moves you up. A miss moves you down a little.</p>
    {:else}
      <div class="rank">
        <strong class="display num">{place.toTop}</strong>
        <span>points to enter the top {TOP}</span>
      </div>
    {/if}
    <a class="more" href="/ratings?tab=chesscastles&board=puzzle">See the whole ladder →</a>
  {:else}
    <a class="more" href="/ratings?tab=chesscastles&board=puzzle">See the puzzle ladder →</a>
  {/if}
</section>

<style>
  .plad {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .h {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .h img {
    object-fit: contain;
  }
  .rank {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .rank strong {
    font-size: 40px;
    line-height: 1;
    color: var(--gold);
  }
  .rank span {
    font-weight: 700;
    color: var(--text-2);
  }
  .near {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .near li {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--text) 5%, transparent);
    font-size: 14.5px;
  }
  .near li.me {
    background: color-mix(in srgb, var(--gold) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 55%, transparent);
    font-weight: 800;
  }
  .at {
    color: var(--muted);
    font-weight: 700;
  }
  .nm {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .more {
    font-weight: 700;
    color: var(--gold);
    text-decoration: none;
  }
  .small {
    font-size: 12.5px;
  }
</style>
