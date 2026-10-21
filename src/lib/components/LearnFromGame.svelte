<script lang="ts">
  /**
   * Under a watched game: Guru's lessons for what is on the board (an endgame: the endgames with the masters; an
   * opening: the opening courses; else tactics), in the language the player picks (मराठी, हिंदी or English: the
   * site switches to it).
   */
  import { goto } from '$app/navigation';
  import type { PgnGame } from '$lib/chess/pgn';
  import { contentLang, setContentLang } from '$lib/contentLang';
  import { t } from '$lib/i18n';
  import { phaseOf } from '$lib/insights/analysis';

  let { game }: { game: PgnGame } = $props();

  const phase = $derived(phaseOf(game.plies.at(-1)?.after ?? game.start));
  const target = $derived(phase === 'endgame' ? '/learn?tab=endgames' : phase === 'opening' ? '/learn?tab=openings' : '/learn?tab=tactics');
  const text = $derived(phase === 'endgame' ? $t('learn.cta.endgame') : phase === 'opening' ? $t('learn.cta.opening') : $t('learn.cta.middle'));
  const LANGS = [
    ['mr', 'मराठी'],
    ['hi', 'हिंदी'],
    ['en', 'English'],
  ] as const;
  function learn(l: 'mr' | 'hi' | 'en') {
    setContentLang(l);
    void goto(target);
  }
</script>

<section class="card learn" aria-labelledby="learn-h">
  <div>
    <h2 id="learn-h" class="title">{$t('learn.cta.h')}</h2>
    <p>{text}</p>
  </div>
  <div class="langs">
    <span class="label">{$t('learn.cta.lang')}</span>
    {#each LANGS as [id, name] (id)}
      <button class="btn" class:primary={$contentLang === id} lang={id} onclick={() => learn(id)}>{name}</button>
    {/each}
  </div>
</section>

<style>
  .learn {
    max-width: 1100px;
    margin: 16px auto 0;
    padding: 16px 18px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--border));
  }
  h2 {
    margin: 0 0 4px;
  }
  p {
    margin: 0;
    color: var(--text-2);
  }
  .langs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
</style>
