<script lang="ts">
  /**
   * How you and your friends are studying this week: study points, puzzles solved, streak and the days
   * studied, with a bar per person (most points first). Friends' numbers are what they last shared; a
   * friend who has not opened Chess Castles this week shows as not studied yet.
   */
  import { session } from '$lib/auth';
  import { puzzleRating } from '$lib/puzzles/rating';
  import { study, weekOf } from '$lib/study/progress';
  import { weekProgress } from '$lib/study/shareProgress';
  import { initialsOf, playerPhoto, type Player } from '$lib/social';
  import { myName } from '$lib/stores/me';
  import Icon from './Icon.svelte';

  let { friends, limit = 50, title = 'Study this week', scroll = false }: { friends: Player[]; limit?: number; title?: string; /** A list that scrolls on its own (many friends). */ scroll?: boolean } = $props();

  interface Row {
    uid: string;
    name: string;
    me: boolean;
    photo?: string;
    points: number;
    puzzlesWeek: number;
    puzzleRating?: number;
    streak: number;
    days: number;
    /** Nothing shared yet, or not studied this week. */
    quiet: boolean;
  }
  const week = weekOf(Date.now());
  const rows = $derived.by<Row[]>(() => {
    const solved = $session.status === 'in' && $session.profile ? $session.profile.puzzles.solved : 0;
    const mine = weekProgress($study, $puzzleRating, solved, Date.now());
    const list: Row[] = [
      { uid: 'me', name: $myName || 'You', me: true, points: mine.points, puzzlesWeek: mine.puzzlesWeek, puzzleRating: mine.puzzleRating, streak: mine.streak, days: mine.studyDays, quiet: false },
      ...friends.map((p): Row => {
        const fresh = p.studyWeek === week;
        return {
          uid: p.uid,
          name: p.name,
          me: false,
          photo: playerPhoto(p),
          points: fresh ? (p.studyPoints ?? 0) : 0,
          puzzlesWeek: fresh ? (p.progress?.puzzlesWeek ?? 0) : 0,
          puzzleRating: p.progress?.puzzleRating || undefined,
          streak: fresh ? (p.progress?.streak ?? 0) : 0,
          days: fresh ? (p.progress?.studyDays ?? 0) : 0,
          quiet: !fresh,
        };
      }),
    ];
    return list.sort((a, b) => b.points - a.points || Number(b.me) - Number(a.me)).slice(0, limit);
  });
  const max = $derived(Math.max(1, ...rows.map((r) => r.points)));
</script>

<section class="card fp" aria-labelledby="fp-h">
  <div class="head">
    <h2 id="fp-h" class="title">{title}</h2>
    <a class="label" href="/leaderboard">Leaderboard →</a>
  </div>
  <ul class:scroll>
    {#each rows as r (r.uid)}
      <li class:me={r.me}>
        <span class="av">{#if r.photo}<img src={r.photo} alt="" />{:else}{initialsOf(r.name)}{/if}</span>
        <div class="main">
          <div class="line">
            <strong class="nm">{r.me ? 'You' : r.name}</strong>
            {#if r.quiet}<span class="label">not studied yet this week</span>{:else}<span class="pts num">{r.points} pts</span>{/if}
          </div>
          <div class="bar" role="img" aria-label="{r.points} study points this week"><span style="width: {(100 * r.points) / max}%"></span></div>
          <div class="chips">
            <span class="chip" title="Puzzles solved this week"><Icon name="puzzle" size={13} color="var(--accent)" />{r.puzzlesWeek} puzzles</span>
            <span class="chip" title="Days studied in a row"><Icon name="flame" size={13} color="var(--gold)" />{r.streak}-day streak</span>
            {#if r.puzzleRating}<span class="chip" title="Puzzle rating">Puzzle rating {r.puzzleRating}</span>{/if}
            <span class="days" title="{r.days} of 7 days studied this week" aria-label="{r.days} of 7 days studied this week">
              {#each [0, 1, 2, 3, 4, 5, 6] as d (d)}<i class:on={d < r.days}></i>{/each}
            </span>
          </div>
        </div>
      </li>
    {/each}
  </ul>
  {#if !friends.length}<p class="label">Add friends to see how they study, and cheer each other on.</p>{/if}
</section>

<style>
  .fp {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-size: 19px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  ul.scroll {
    max-height: 430px;
    overflow-y: auto;
    padding-right: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .av {
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: var(--raised);
    font-weight: 800;
    font-size: 13px;
  }
  li.me .av {
    box-shadow: 0 0 0 2px var(--gold);
  }
  .av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: baseline;
  }
  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pts {
    font-weight: 800;
    color: var(--gold);
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--raised);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--gold), var(--accent));
    min-width: 2px;
  }
  li.me .bar span {
    background: linear-gradient(90deg, var(--win), var(--gold));
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--raised);
    font-size: 12px;
    color: var(--text-2);
  }
  .days {
    display: inline-flex;
    gap: 3px;
    margin-left: auto;
  }
  .days i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--raised);
    border: 1px solid var(--border);
  }
  .days i.on {
    background: var(--win);
    border-color: var(--win);
  }
  p {
    margin: 0;
  }
</style>
