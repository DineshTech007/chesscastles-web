<script lang="ts">
  /**
   * "Made in India" with the flag: Chess Castles is an Indian chess platform. `compact`: one small line, at the top of
   * the home page, right under the Chess Castles name (owner's request, 2026-10-21).
   */
  import { t } from '$lib/i18n';
  let { compact = false }: { compact?: boolean } = $props();
</script>

<p class="india" class:compact>
  <img src="/flags/IND.svg" alt="" width="24" height="16" />
  <strong>{$t('india.made')}</strong>
  <span>{$t('india.support')}</span>
</p>

<style>
  .india {
    display: flex;
    width: fit-content;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin: 0 0 14px;
    padding: 7px 14px 7px 10px;
    border-radius: 999px;
    border: 1px solid transparent;
    background:
      linear-gradient(var(--raised), var(--raised)) padding-box,
      linear-gradient(90deg, #ff9933, #ffffff 50%, #138808) border-box;
    font-size: 14px;
    line-height: 1.3;
  }
  img {
    border-radius: 3px;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  }
  strong {
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  span {
    color: var(--text-2);
  }
  .compact {
    flex-wrap: nowrap;
    gap: 6px;
    max-width: 100%;
    margin: 0;
    padding: 3px 12px 3px 8px;
    font-size: 12.5px;
    white-space: nowrap;
  }
  .compact img {
    width: 18px;
    height: 12px;
  }
  .compact span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
