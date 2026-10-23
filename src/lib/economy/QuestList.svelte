<script lang="ts">
  /** Today's three quests: progress bars, a Claim button when done, and the bonus for all three. */
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import { QUEST_BONUS, questProgress, questsFor } from './core';
  import { claimQuestReward, today, wallet } from './wallet';
  import { t, type Key } from '$lib/i18n';
  import Icon from '$lib/components/Icon.svelte';

  let { compact = false }: { compact?: boolean } = $props();
  const day = $derived(today());
  const quests = $derived(questsFor(day));
  const claimedIds = $derived($wallet.today.day === day ? $wallet.today.quests : []);
  const allDone = $derived(quests.every((q) => claimedIds.includes(q.id)));
  const GO: Record<string, string> = { play: '/play', puzzles: '/puzzles', learn: '/learn' };
  const ICON: Record<string, string> = { play: '♞', puzzles: '🧩', learn: '📖' };
  let busy = $state('');
  async function claim(id: string) {
    busy = id;
    await claimQuestReward(id);
    busy = '';
  }
</script>

<ul class="quests" class:compact>
  {#each quests as q (q.id)}
    {@const n = Math.min(q.need, questProgress($wallet, q, day))}
    {@const done = n >= q.need}
    {@const got = claimedIds.includes(q.id)}
    <li class:got class:ready={done && !got}>
      <span class="qi" aria-hidden="true">{ICON[q.group]}</span>
      <span class="qt">
        <span class="qn">{$t(`eco.q.${q.id}` as Key)}</span>
        <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={q.need} aria-valuenow={n}><span style="width: {(n / q.need) * 100}%"></span></span>
      </span>
      <span class="qr">
        {#if got}
          <span class="ok"><Icon name="check" size={16} />{$t('eco.quests.done')}</span>
        {:else if done}
          <button class="btn primary claim" onclick={() => claim(q.id)} disabled={busy === q.id}><Coin size={15} />{q.gold}</button>
        {:else}
          <a class="go" href={GO[q.group]}><span class="num">{n}/{q.need}</span><span class="pay"><Coin size={14} />{q.gold}</span></a>
        {/if}
      </span>
    </li>
  {/each}
</ul>
<p class="bonus" class:won={allDone}>
  {allDone ? '🏆' : '🎯'}
  {allDone ? $t('eco.quests.bonusWon') : $t('eco.quests.bonus')}
  <span class="bi"><Coin size={14} />{QUEST_BONUS.gold} <Gem size={13} />{QUEST_BONUS.gems}</span>
</p>

<style>
  .quests {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid var(--border-soft);
    background: color-mix(in srgb, var(--raised) 70%, transparent);
  }
  li.ready {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 12%, var(--raised));
  }
  li.got {
    opacity: 0.7;
  }
  .qi {
    width: 36px;
    height: 36px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 11px;
    background: var(--card);
    border: 1px solid var(--border);
    font-size: 18px;
  }
  .qt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .qn {
    font-weight: 700;
    font-size: 14.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar {
    height: 7px;
    border-radius: 999px;
    background: var(--bg);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f7d27a, #edb040);
    transition: width 0.5s cubic-bezier(0.3, 1.2, 0.5, 1);
  }
  .got .bar span {
    background: var(--win);
  }
  .qr {
    flex: none;
  }
  .go {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    color: var(--text-2);
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
  }
  .go:hover {
    text-decoration: none;
    color: var(--text);
  }
  .pay {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--gold);
    font-family: var(--font-title);
  }
  .claim {
    min-height: 36px;
    padding: 0 12px;
    gap: 5px;
    font-size: 15px;
    animation: ready 1.4s ease-in-out infinite;
  }
  @keyframes ready {
    50% {
      transform: scale(1.06);
    }
  }
  .ok {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--win);
    font-weight: 800;
    font-size: 13.5px;
  }
  .bonus {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin: 10px 2px 0;
    font-size: 13px;
    color: var(--muted);
  }
  .bonus.won {
    color: var(--gold);
    font-weight: 700;
  }
  .bi {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
    font-weight: 800;
    color: var(--text-2);
  }
  .compact li {
    padding: 8px 10px;
  }
  .compact .qi {
    width: 32px;
    height: 32px;
  }
</style>
