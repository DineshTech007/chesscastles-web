<script lang="ts">
  /**
   * A player's awards (src/lib/awards/awards.ts), like a trophy cabinet: their puzzle level and Puzzle Rush title on
   * top, then the medals. Owner, 2026-10-22: "they have to scroll so much, show them nicely":
   * - compact (profiles): one shelf of what was won (best first, the rest on demand) and, for the player's own, the
   *   next awards to win, with a link to the whole cabinet (/awards);
   * - full (/awards): a tab for what was won and one per group, so only one group shows at a time.
   */
  import Medal from '$lib/puzzles/Medal.svelte';
  import { RUSH_TITLES } from '$lib/puzzles/rewards';
  import { levelOf } from '$lib/puzzles/bank';
  import { placeMedal, type Trophy } from '$lib/tournament/tournament';
  import { AWARDS, GROUPS, type Award, type AwardGroup } from './awards';

  let {
    earned,
    mine = false,
    full = false,
    name = '',
    rating = 0,
    rushBest = 0,
    stars = 0,
    trophies = [],
  }: {
    earned: Set<string>;
    mine?: boolean;
    /** The whole cabinet with a tab per group (the /awards page); else the compact shelf. */
    full?: boolean;
    /** Whose (another player's page). */
    name?: string;
    /** Puzzle rating (the level on top). */
    rating?: number;
    rushBest?: number;
    /** Puzzle stars (the player's own). */
    stars?: number;
    trophies?: Trophy[];
  } = $props();

  /** Best first on the shelf: ratings and levels, Rush, games and tournaments… the welcome last. */
  const SHELF: AwardGroup[] = ['ratings', 'levels', 'rush', 'games', 'tournaments', 'masters', 'puzzles', 'study', 'lessons', 'start'];
  const SHELF_MAX = 12;

  const won = $derived(AWARDS.filter((a) => earned.has(a.id)));
  const shelf = $derived(SHELF.flatMap((g) => won.filter((a) => a.group === g).reverse()));
  const nextUp = $derived(GROUPS.map((g) => AWARDS.find((a) => a.group === g.id && !earned.has(a.id))).filter((a): a is Award => !!a).slice(0, 6));
  const level = $derived(rating ? levelOf(rating) : undefined);
  const rush = $derived([...RUSH_TITLES].reverse().find((t) => rushBest >= t.min));
  const rushAward = $derived(rush ? AWARDS.find((a) => a.id === rush.badge) : undefined);
  const count = (g: AwardGroup) => AWARDS.filter((a) => a.group === g && earned.has(a.id)).length;
  const total = (g: AwardGroup) => AWARDS.filter((a) => a.group === g).length;

  let more = $state(false);
  // svelte-ignore state_referenced_locally
  let tab = $state<'won' | AwardGroup>(earned.size > 1 ? 'won' : 'games');
  const tabList = $derived(tab === 'won' ? shelf : AWARDS.filter((a) => a.group === tab));
  const firstLocked = $derived(tab === 'won' ? undefined : tabList.find((a) => !earned.has(a.id))?.id);

  const when = (t: number) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
</script>

{#snippet tile(a: Award, size: number, peek = false)}
  {@const got = earned.has(a.id)}
  <div class="aw" class:locked={!got} title={got ? `${a.name}: ${a.hint}` : `To win: ${a.hint}`}>
    <Medal badge={a} art={a.art} {got} peek={!got && peek} {size} />
    <span class="nm">{a.name}</span>
    {#if !got}<span class="hint">{a.hint}</span>{/if}
  </div>
{/snippet}

<section class="card awards" class:full id="awards" aria-labelledby="awards-h">
  <header class="ah">
    <h2 id="awards-h" class="title">🏆 {mine ? 'My awards' : name ? `${name}'s awards` : 'Awards'}</h2>
    <span class="count num">{won.length} <span class="muted">of {AWARDS.length}</span></span>
  </header>
  <div class="bar" role="progressbar" aria-label="Awards won" aria-valuemin="0" aria-valuemax={AWARDS.length} aria-valuenow={won.length}>
    <span style="width: {Math.round((won.length / AWARDS.length) * 100)}%"></span>
  </div>

  {#if level || rushAward || stars || trophies.length}
    <div class="tops">
      {#if level}
        <div class="top">
          <img src={level.level.image} alt="" width="44" height="44" loading="lazy" />
          <span><b>{level.level.name} level</b><span class="muted small">Puzzles {rating}{level.next ? ` · ${level.next.name} at ${level.next.from}` : ''}</span></span>
        </div>
      {/if}
      {#if rushAward}
        <div class="top">
          <Medal badge={rushAward} size={44} />
          <span><b>{rushAward.name}</b><span class="muted small">Rush best {rushBest}</span></span>
        </div>
      {/if}
      {#if stars}
        <div class="top"><span class="big" aria-hidden="true">⭐</span><span><b class="num">{stars}</b><span class="muted small">puzzle stars</span></span></div>
      {/if}
      {#if trophies.length}
        <div class="top"><span class="big" aria-hidden="true">🏆</span><span><b class="num">{trophies.length}</b><span class="muted small">{trophies.length === 1 ? 'tournament' : 'tournaments'}</span></span></div>
      {/if}
    </div>
  {/if}

  {#if !full}
    {#if shelf.length}
      <h3>Won</h3>
      <div class="shelf">
        {#each more ? shelf : shelf.slice(0, SHELF_MAX) as a (a.id)}{@render tile(a, 46)}{/each}
        {#if !more && shelf.length > SHELF_MAX}
          <button class="aw more" onclick={() => (more = true)}><span class="plus">+{shelf.length - SHELF_MAX}</span><span class="nm">more</span></button>
        {/if}
      </div>
    {/if}
    {#if mine && nextUp.length}
      <h3>Next to win</h3>
      <div class="shelf">
        {#each nextUp as a (a.id)}{@render tile(a, 46, true)}{/each}
      </div>
    {/if}
    {#if mine}<a class="all" href="/awards">See all {AWARDS.length} awards →</a>{/if}
  {:else}
    <div class="tabs" role="tablist" aria-label="Award groups">
      <button role="tab" aria-selected={tab === 'won'} class:on={tab === 'won'} onclick={() => (tab = 'won')}>Won <span class="num">{won.length}</span></button>
      {#each GROUPS as g (g.id)}
        <button role="tab" aria-selected={tab === g.id} class:on={tab === g.id} onclick={() => (tab = g.id)}>{g.name} <span class="num">{count(g.id)}/{total(g.id)}</span></button>
      {/each}
    </div>
    <div class="grid">
      {#each tabList as a (a.id)}{@render tile(a, 60, a.id === firstLocked)}{:else}<p class="muted">Nothing won here yet: pick a group to see what to win.</p>{/each}
    </div>
    {#if tab === 'tournaments' && mine && trophies.length}
      <h3>Tournament trophies</h3>
      {#each trophies.slice(0, 10) as t (t.id)}
        <div class="trow">
          <span class="medal">{placeMedal(t.place) || '🏅'}</span>
          <span class="tname">{t.name}</span>
          <span class="muted small">{ordinal(t.place)} of {t.players} · {t.score}/{t.rounds} · {when(t.at)}</span>
        </div>
      {/each}
    {/if}
  {/if}
</section>

<style>
  .awards {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
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
    font-size: 12px;
    font-weight: 600;
  }
  .bar {
    height: 7px;
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
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .top {
    flex: 1 1 140px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--raised);
    min-width: 0;
  }
  .top img {
    width: 44px;
    height: 44px;
    object-fit: contain;
    flex: none;
  }
  .top > span:last-child {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .top b {
    font: 700 15px var(--font-title);
  }
  .big {
    font-size: 28px;
    width: 44px;
    text-align: center;
    flex: none;
  }
  h3 {
    margin: 2px 0 -2px;
    font: 700 15px var(--font-title);
  }
  /* The compact shelf: small medals in rows (about four or five on a phone). */
  .shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
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
    gap: 2px;
    text-align: center;
    padding: 6px 2px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--gold) 7%, transparent);
    min-width: 0;
  }
  .aw.locked {
    background: transparent;
    border: 1px dashed var(--border);
  }
  .nm {
    font-size: 11.5px;
    font-weight: 700;
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hint {
    font-size: 10.5px;
    color: var(--muted);
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .full .nm {
    font-size: 12.5px;
  }
  .full .hint {
    font-size: 11px;
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
    font: 800 20px var(--font-title);
    color: var(--gold);
  }
  .all {
    align-self: flex-start;
    font-weight: 700;
    font-size: 14px;
  }
  .tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tabs button {
    flex: none;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text-2);
    border-radius: 999px;
    padding: 6px 12px;
    font: 700 13px var(--font-body);
    cursor: pointer;
    white-space: nowrap;
  }
  .tabs button .num {
    color: var(--muted);
    font-weight: 600;
  }
  .tabs button.on {
    background: var(--gold);
    border-color: var(--gold);
    color: #1b1300;
  }
  .tabs button.on .num {
    color: #4a3300;
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
