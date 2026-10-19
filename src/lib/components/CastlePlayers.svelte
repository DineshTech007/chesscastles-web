<script lang="ts">
  /**
   * Chess Castles' own players, by CC Rating (overall or one speed) or puzzle
   * rating: the top three on a podium, then everyone else, each with their
   * country and a badge of their initials (photos stay private: only friends
   * see them). A player opens their profile.
   */
  import { KFIDE_SPEEDS, SPEED_LABEL, type KfideSpeed } from '$lib/kfide';
  import { call, kfideLeaders, type KfideLeader } from '$lib/social';
  import { leaderboard } from '$lib/leaderboard';
  import { fedName } from '$lib/fideFeds';
  import Icon from './Icon.svelte';

  type BoardId = 'main' | KfideSpeed | 'puzzle';
  const BOARDS: { id: BoardId; label: string }[] = [{ id: 'main', label: 'CC Rating' }, ...KFIDE_SPEEDS.map((s) => ({ id: s as BoardId, label: SPEED_LABEL[s] })), { id: 'puzzle', label: 'Puzzles' }];

  interface Row {
    uid: string;
    name: string;
    country: string;
    rating: number;
    /** Games (CC Rating) or puzzles solved. */
    count: number;
    me: boolean;
  }

  let { me, rowsFor }: { me?: string; /** Where the rows come from (by default the leaderboards). */ rowsFor?: (b: BoardId) => Promise<Row[]> } = $props();
  let board = $state<BoardId>('main');
  let rows = $state<Row[] | undefined>();
  let error = $state('');

  /** Countries of the players (the puzzle board comes from the app's database, without them). */
  let countries: Promise<Map<string, string>> | undefined;
  const countryOf = () =>
    (countries ??= call<{ players: KfideLeader[] }>('GET', 'leaders?speed=members').then(
      (r) => new Map(r.players.map((p) => [p.uid, p.country])),
      () => new Map(),
    ));

  $effect(() => {
    const b = board;
    rows = undefined;
    error = '';
    const load: Promise<Row[]> = rowsFor
      ? rowsFor(b)
      : b === 'puzzle'
        ? Promise.all([leaderboard('puzzle', 50), countryOf()]).then(([list, c]) => list.map((p) => ({ uid: p.uid, name: p.name, country: c.get(p.uid) ?? '', rating: p.ratings.puzzle, count: p.puzzles.solved, me: p.uid === me })))
        : kfideLeaders(b).then((list) => list.map((p) => ({ uid: p.uid, name: p.name, country: p.country, rating: p.rating, count: p.games, me: !!p.me })));
    load.then(
      (r) => {
        if (board === b) rows = r;
      },
      () => {
        if (board === b) error = 'The players could not be loaded. Try again in a moment.';
      },
    );
  });

  const initials = (n: string) =>
    n
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  /** A colour of the player's own for their badge, the same every time. */
  const TINTS = ['#4d86e6', '#b98520', '#9c67d4', '#2f9e7a', '#d0603f', '#3a8fb7', '#c2477d', '#6f7fd6'];
  const tint = (uid: string) => TINTS[[...uid].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TINTS.length];
  const unit = $derived(board === 'puzzle' ? 'puzzles solved' : 'games');
  /** The podium's order on screen: 2nd, 1st, 3rd. */
  const podium = $derived(rows ? [rows[1], rows[0], rows[2]].map((r, i) => (r ? { r, place: [2, 1, 3][i] } : undefined)).filter((x) => !!x) : []);
</script>

<div class="castle">
  <div class="chips" role="group" aria-label="Leaderboard">
    {#each BOARDS as b (b.id)}<button class="chip" aria-pressed={board === b.id} onclick={() => (board = b.id)}>{b.label}</button>{/each}
  </div>

  {#if error}
    <p class="label">{error}</p>
  {:else if !rows}
    <div class="skel"></div>
  {:else if !rows.length}
    <p class="label">Nobody here yet. {board === 'puzzle' ? 'Solve rated puzzles' : 'Play FIDE-rated opponents'} and be the first!</p>
  {:else}
    <ol class="podium" aria-label="Top three">
      {#each podium as p (p.r.uid)}
        <li class="slot"><a class="step p{p.place}" class:me={p.r.me} href="/players/{p.r.uid}">
          {#if p.place === 1}<span class="crown" aria-hidden="true"><Icon name="crown" size={26} color="var(--gold)" /></span>{/if}
          <span class="av big" style="--t: {tint(p.r.uid)}">{initials(p.r.name)}</span>
          <span class="nm">{p.r.name}{p.r.me ? ' (you)' : ''}</span>
          <span class="where">
            {#if p.r.country}<img class="flag" src="/flags/{p.r.country}.svg" alt="" width="20" height="14" />{fedName(p.r.country)}{/if}
          </span>
          <strong class="display num rt">{p.r.rating}</strong>
          <span class="label">{p.r.count} {unit}</span>
          <span class="place display" aria-label="Place {p.place}">{p.place}</span>
        </a></li>
      {/each}
    </ol>

    {#if rows.length > 3}
      <ol class="list" start="4">
        {#each rows.slice(3) as r, i (r.uid)}
          <li>
            <a class="row" class:me={r.me} href="/players/{r.uid}">
              <span class="pos num">{i + 4}</span>
              <span class="av" style="--t: {tint(r.uid)}">{initials(r.name)}</span>
              <span class="who">
                <span class="nm">{r.name}{r.me ? ' (you)' : ''}</span>
                <span class="label">{#if r.country}<img class="flag" src="/flags/{r.country}.svg" alt="" width="18" height="12" />{`${fedName(r.country)} · `}{/if}{r.count} {unit}</span>
              </span>
              <strong class="num rt">{r.rating}</strong>
              <Icon name="chevron" size={16} color="var(--muted)" />
            </a>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</div>

<style>
  .castle {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .skel {
    height: 280px;
    border-radius: var(--r-card);
    background: var(--raised);
  }
  .podium {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    align-items: end;
  }
  .slot {
    display: flex;
    align-items: flex-end;
    min-width: 0;
  }
  .slot .step {
    flex: 1;
  }
  .step {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 18px 10px 14px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    text-decoration: none;
    text-align: center;
    min-width: 0;
  }
  .step:hover {
    border-color: var(--brand);
    text-decoration: none;
  }
  .step.p1 {
    padding-top: 30px;
    padding-bottom: 26px;
    border-color: color-mix(in srgb, var(--gold) 60%, var(--border));
    background: color-mix(in srgb, var(--gold) 10%, var(--raised));
  }
  .crown {
    position: absolute;
    top: 6px;
  }
  .place {
    position: absolute;
    top: 8px;
    left: 12px;
    font-size: 22px;
    color: var(--muted);
  }
  .p1 .place {
    color: var(--gold);
  }
  .p2 .place {
    color: #b8c2d6;
  }
  .p3 .place {
    color: #c9864a;
  }
  .av {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--t) 85%, #000);
    color: #fff;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.02em;
  }
  .av.big {
    width: 64px;
    height: 64px;
    font-size: 22px;
    box-shadow: 0 0 0 3px var(--card);
  }
  .p1 .av.big {
    width: 76px;
    height: 76px;
    box-shadow: 0 0 0 3px var(--gold);
  }
  .nm {
    font-weight: 700;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .where {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--text-2);
    min-height: 16px;
  }
  .flag {
    border-radius: 2px;
    vertical-align: -2px;
  }
  .rt {
    font-size: 28px;
    line-height: 1.1;
  }
  .p1 .rt {
    color: var(--gold);
    font-size: 34px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: 34px 40px minmax(0, 1fr) auto 16px;
    gap: 12px;
    align-items: center;
    padding: 8px 12px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    text-decoration: none;
  }
  .row:hover {
    border-color: var(--brand);
    text-decoration: none;
  }
  .row.me,
  .step.me {
    outline: 2px solid var(--brand);
  }
  .pos {
    color: var(--muted);
    font-weight: 700;
    text-align: center;
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .who .label {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    font-size: 13px;
  }
  .row .rt {
    font-size: 20px;
  }
  @media (max-width: 560px) {
    .podium {
      gap: 6px;
    }
    .step {
      padding: 14px 4px 10px;
    }
    .av.big {
      width: 48px;
      height: 48px;
      font-size: 17px;
    }
    .p1 .av.big {
      width: 58px;
      height: 58px;
    }
    .rt {
      font-size: 22px;
    }
    .p1 .rt {
      font-size: 26px;
    }
    .where {
      font-size: 11px;
    }
    .row {
      grid-template-columns: 26px 36px minmax(0, 1fr) auto;
      gap: 8px;
    }
    .row :global(svg:last-child) {
      display: none;
    }
  }
</style>
