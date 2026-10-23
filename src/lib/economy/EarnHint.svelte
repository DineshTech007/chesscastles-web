<script lang="ts">
  /**
   * "What you earn here" (owner, 2026-10-23: "in each section show how much gems or diamonds you can earn by solving this
   * puzzle or study"): the gold and gems each thing pays, from the Treasury's own rules (core.ts), with how many of the
   * day's are done and what happens at the limit. Short, one line each, never in the way.
   */
  import { t, type Key } from '$lib/i18n';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import { EARN, GEM_EVERY, OVER_CAP_TIMES, type EarnKind } from './core';
  import { today, wallet } from './wallet';

  let { kinds, note = '' }: { kinds: EarnKind[]; note?: string } = $props();
  const rows = $derived(
    kinds.map((k) => {
      const rule = EARN[k];
      const used = $wallet.today.day === today() ? ($wallet.today.counts[k] ?? 0) : 0;
      return { k, gold: rule.gold, cap: rule.cap, used, gem: GEM_EVERY[k], full: used >= rule.cap, over: rule.cap >= 10 };
    }),
  );
</script>

<aside class="earn" aria-label={$t('eco.earn.here')}>
  <strong class="h"><Coin size={15} /><Gem size={14} /> {$t('eco.earn.here')}</strong>
  <ul>
    {#each rows as r (r.k)}
      <li>
        <span class="what">{$t(`eco.why.${r.k}` as Key)}</span>
        <span class="amt"><Coin size={13} />{r.gold}</span>
        {#if r.gem}<span class="amt gem"><Gem size={12} />{r.gem.gems} {r.gem.every === 1 ? $t('eco.earn.each') : $t('eco.earn.per', { every: r.gem.every })}</span>{/if}
        <span class="used" class:done={r.full}>{r.full ? (r.over && r.used < r.cap * OVER_CAP_TIMES ? $t('eco.earn.limit') : $t('eco.earn.done')) : $t('eco.earn.today', { used: r.used, cap: r.cap })}</span>
      </li>
    {/each}
  </ul>
  {#if note}<p class="note">{note}</p>{/if}
</aside>

<style>
  .earn {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 9px 12px;
    margin: 0 0 12px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--gold) 28%, var(--border));
    background: color-mix(in srgb, var(--gold) 6%, var(--card));
    font-size: 13px;
  }
  .h {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }
  .what {
    font-weight: 700;
    min-width: 0;
  }
  .amt {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #b98a14;
    font-weight: 800;
  }
  .amt.gem {
    color: #2a9db8;
  }
  :global(:root:not([data-theme='light'])) .amt {
    color: #ffd76a;
  }
  :global(:root:not([data-theme='light'])) .amt.gem {
    color: #8fe6f5;
  }
  .used {
    margin-left: auto;
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .used.done {
    color: var(--text-2);
    font-weight: 700;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }
</style>
