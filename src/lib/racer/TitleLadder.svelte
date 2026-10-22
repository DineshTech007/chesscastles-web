<script lang="ts">
  /**
   * The Puzzle Racer titles to chase (as on the Puzzle Rush page): every medal, the ones won lit, the next framed and
   * glowing, and how many more points it needs.
   */
  import Medal from '$lib/puzzles/Medal.svelte';
  import { AWARDS } from '$lib/awards/awards';
  import { RACER_TITLES, nextRacerTitle } from './stats';

  let { best, size = 52 }: { best: number; size?: number } = $props();
  const next = $derived(nextRacerTitle(best));
</script>

<div class="titles">
  <ol class="ladder" aria-label="Puzzle Racer titles">
    {#each RACER_TITLES as t (t.min)}
      {@const a = AWARDS.find((x) => x.id === t.award)}
      {@const got = best >= t.min}
      <li class:got class:next={next?.min === t.min}>
        {#if a}<Medal badge={a} art={a.art} {got} peek={next?.min === t.min} {size} />{/if}
        <span class="tname">{t.name}</span>
        <span class="tmin num">{t.min}+</span>
      </li>
    {/each}
  </ol>
  <p class="chase">{#if next}Next title: <b>{next.name}</b>, {next.more} more than your best!{:else}You hold the highest title. Can you beat your best?{/if}</p>
</div>

<style>
  .titles {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 100%;
  }
  .ladder {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    width: 100%;
  }
  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 2px;
    border-radius: 12px;
    text-align: center;
  }
  li.next {
    outline: 2px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 10%, transparent);
  }
  .tname {
    font: 700 11.5px var(--font-body);
    line-height: 1.15;
  }
  li.got .tname {
    color: var(--gold);
  }
  .tmin {
    font-size: 11px;
    color: var(--muted);
  }
  .chase {
    margin: 0;
    font: 700 14px var(--font-body);
    text-align: center;
  }
  .chase b {
    color: var(--gold);
  }
</style>
