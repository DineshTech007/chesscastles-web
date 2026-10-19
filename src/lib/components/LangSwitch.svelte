<script lang="ts">
  /** English / हिन्दी / मराठी, for the Chess Guide and the Blog (one choice for both, English by default). */
  import { LANGS } from '$lib/coach/i18n';
  import { contentLang, setContentLang } from '$lib/contentLang';
</script>

<div class="segmented" role="group" aria-label="Language">
  {#each LANGS as l (l.id)}
    <button aria-pressed={$contentLang === l.id} lang={l.id} onclick={() => setContentLang(l.id)}>{l.name}</button>
  {/each}
</div>
