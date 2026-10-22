<script lang="ts">
  /**
   * A player's awards (src/lib/awards/awards.ts), like a trophy cabinet: their puzzle level and Puzzle Rush title on
   * top, then every group's medals. `mine`: the player's own, with the next award to win in each group (in colour,
   * locked) and the rest on demand, and their tournament trophies; on a friend's page only what they won.
   */
  import Medal from '$lib/puzzles/Medal.svelte';
  import { RUSH_TITLES } from '$lib/puzzles/rewards';
  import { levelOf } from '$lib/puzzles/bank';
  import { placeMedal, type Trophy } from '$lib/tournament/tournament';
  import { AWARDS, GROUPS, type Award } from './awards';

  let {
    earned,
    mine = false,
    name = '',
    rating = 0,
    rushBest = 0,
    stars = 0,
    trophies = [],
  }: {
    earned: Set<string>;
    mine?: boolean;
    /** Whose (a friend's page). */
    name?: string;
    /** Puzzle rating (the level on top). */
    rating?: number;
    rushBest?: number;
    /** Puzzle stars (the player's own). */
    stars?: number;
    trophies?: Trophy[];
  } = $props();

  const won = $derived(AWARDS.filter((a) => earned.has(a.id)).length);
  const level = $derived(rating ? levelOf(rating) : undefined);
  const rush = $derived([...RUSH_TITLES].reverse().find((t) => rushBest >= t.min));
  const rushAward = $derived(rush ? AWARDS.find((a) => a.id === rush.badge) : undefined);
  let open = $state<Record<string, boolean>>({});
  /** A group's medals: what was won, then (mine) the next one to win and, opened, the rest. */
  function shown(group: string): { list: Award[]; more: number } {
    const all = AWARDS.filter((a) => a.group === group);
    const got = all.filter((a) => earned.has(a.id));
    if (!mine) return { list: got, more: 0 };
    const left = all.filter((a) => !earned.has(a.id));
    if (open[group]) return { list: [...got, ...left], more: 0 };
    return { list: [...got, ...left.slice(0, 1)], more: Math.max(0, left.length - 1) };
  }
  const when = (t: number) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
</script>

<section class="card awards" id="awards" aria-labelledby="awards-h">
  <header class="ah">
    <h2 id="awards-h" class="title">🏆 {mine ? 'My awards' : name ? `${name}'s awards` : 'Awards'}</h2>
    <span class="count num">{won} <span class="muted">of {AWARDS.length}</span></span>
  </header>
  <div class="bar" role="progressbar" aria-label="Awards won" aria-valuemin="0" aria-valuemax={AWARDS.length} aria-valuenow={won}>
    <span style="width: {Math.round((won / AWARDS.length) * 100)}%"></span>
  </div>

  {#if level || rushAward || stars || trophies.length}
    <div class="tops">
      {#if level}
        <div class="top">
          <img src={level.level.image} alt="" width="56" height="56" loading="lazy" />
          <span><b>{level.level.name} level</b><span class="muted small">Puzzle rating {rating}{level.next ? ` · ${level.next.name} at ${level.next.from}` : ' · the top level'}</span></span>
        </div>
      {/if}
      {#if rushAward}
        <div class="top">
          <Medal badge={rushAward} size={56} />
          <span><b>{rushAward.name}</b><span class="muted small">Puzzle Rush best: {rushBest}</span></span>
        </div>
      {/if}
      {#if stars}
        <div class="top">
          <span class="big" aria-hidden="true">⭐</span>
          <span><b class="num">{stars}</b><span class="muted small">puzzle stars</span></span>
        </div>
      {/if}
      {#if trophies.length}
        <div class="top">
          <span class="big" aria-hidden="true">🏆</span>
          <span><b class="num">{trophies.length}</b><span class="muted small">{trophies.length === 1 ? 'tournament' : 'tournaments'} played</span></span>
        </div>
      {/if}
    </div>
  {/if}

  {#each GROUPS as g (g.id)}
    {@const s = shown(g.id)}
    {@const total = AWARDS.filter((a) => a.group === g.id).length}
    {#if s.list.length}
      <div class="group">
        <h3>{g.name} <span class="muted small">{AWARDS.filter((a) => a.group === g.id && earned.has(a.id)).length}/{total}</span></h3>
        <div class="grid">
          {#each s.list as a (a.id)}
            {@const got = earned.has(a.id)}
            <div class="aw" class:locked={!got} title={got ? `${a.name}: ${a.hint}` : `To win: ${a.hint}`}>
              <Medal badge={a} art={a.art} {got} peek={!got} size={60} />
              <span class="nm">{a.name}</span>
              {#if !got}<span class="hint">{a.hint}</span>{/if}
            </div>
          {/each}
          {#if s.more}
            <button class="aw more" onclick={() => (open = { ...open, [g.id]: true })}>
              <span class="plus">+{s.more}</span>
              <span class="nm">more to win</span>
            </button>
          {/if}
        </div>
      </div>
    {/if}
  {/each}

  {#if mine && trophies.length}
    <div class="group">
      <h3>Tournament trophies</h3>
      {#each trophies.slice(0, 6) as t (t.id)}
        <div class="trow">
          <span class="medal">{placeMedal(t.place) || '🏅'}</span>
          <span class="tname">{t.name}</span>
          <span class="muted small">{ordinal(t.place)} of {t.players} · {t.score}/{t.rounds} · {when(t.at)}</span>
        </div>
      {/each}
    </div>
  {/if}
  {#if mine && !won}
    <p class="muted small">Solve puzzles, play Puzzle Rush, finish lessons and tournaments: every award you win shows here.</p>
  {/if}
</section>

<style>
  .awards {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 18px;
  }
  .ah {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .ah h2 {
    margin: 0;
  }
  .count {
    font-weight: 800;
    font-size: 18px;
    color: var(--gold);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12.5px;
    font-weight: 600;
  }
  .bar {
    height: 8px;
    border-radius: 999px;
    background: var(--raised);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f7d27a, #edb040 60%, #c98a1b);
  }
  .tops {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--raised);
  }
  .top img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    flex: none;
  }
  .top > span:last-child {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .top b {
    font: 700 16px var(--font-title);
  }
  .big {
    font-size: 34px;
    width: 56px;
    text-align: center;
    flex: none;
  }
  .group h3 {
    margin: 6px 0;
    font: 700 16px var(--font-title);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 8px;
  }
  .aw {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    text-align: center;
    padding: 8px 4px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--gold) 7%, transparent);
  }
  .aw.locked {
    background: transparent;
    border: 1px dashed var(--border);
  }
  .nm {
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.2;
  }
  .hint {
    font-size: 11px;
    color: var(--muted);
    line-height: 1.2;
  }
  .more {
    justify-content: center;
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--text);
    cursor: pointer;
    font: inherit;
  }
  .plus {
    font: 800 22px var(--font-title);
    color: var(--gold);
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
    border-top: 1px solid var(--border-soft);
    flex-wrap: wrap;
  }
  .trow .medal {
    font-size: 20px;
  }
  .tname {
    font-weight: 700;
    flex: 1;
    min-width: 0;
  }
</style>
