<script lang="ts">
  /** "Made in India" with the flag, on the home page: Chess Castles is an Indian chess platform. */
  import { t } from '$lib/i18n';
</script>

<p class="india">
  <img src="/flags/IND.svg" alt="" width="24" height="16" />
  <strong>{$t('india.made')}</strong>
  <span>{$t('india.support')}</span>
</p>

<style>
  .india {
    display: inline-flex;
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
</style>
