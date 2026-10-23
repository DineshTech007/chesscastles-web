<script lang="ts">
  /**
   * A banned account (an admin suspended it; owner, 2026-10-23: "show that account as banned for playing games"): over
   * every page a short notice, and on the play pages the notice instead of the board.
   */
  import { t } from '$lib/i18n';

  let { fair = false, big = false }: { fair?: boolean; big?: boolean } = $props();
</script>

<section class="ban card" class:big role="alert">
  <strong>🚫 {$t('ban.title')}</strong>
  <p>{fair ? $t('ban.fair') : $t('ban.other')}</p>
  <p class="help">{$t('ban.help')} <a href="/help">{$t('ban.helpLink')} →</a></p>
</section>

<style>
  .ban {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
    padding: 12px 14px;
    border: 2px solid #ef4444;
    background: color-mix(in srgb, #ef4444 14%, var(--surface));
  }
  strong {
    font: 800 17px var(--font-title);
    color: #fca5a5;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.35;
  }
  .help {
    color: var(--muted);
    font-size: 13px;
  }
  .big {
    max-width: 560px;
    margin: 40px auto;
    padding: 22px 20px;
    text-align: center;
    align-items: center;
  }
  .big strong {
    font-size: 22px;
  }
</style>
