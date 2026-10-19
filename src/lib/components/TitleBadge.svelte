<script lang="ts">
  /** A Chess Castles title before a player's name ("CGM"), coloured by tier. */
  import { isTitle, TITLE_NAME, TITLE_TIER } from '$lib/titles';

  let { title, size = 13 }: { title?: string; size?: number } = $props();
</script>

{#if isTitle(title)}
  <abbr class="tb t{TITLE_TIER[title]}" title={TITLE_NAME[title]} style="font-size: {size}px">{title}</abbr>
{/if}

<style>
  .tb {
    display: inline-block;
    padding: 0.08em 0.42em;
    border-radius: 0.35em;
    font-family: var(--font-title);
    font-weight: 800;
    letter-spacing: 0.03em;
    line-height: 1.3;
    text-decoration: none;
    vertical-align: 0.12em;
    margin-right: 0.35em;
    white-space: nowrap;
  }
  .t1 {
    background: linear-gradient(135deg, #f7d27a, #c8902a);
    color: #2b1a02;
  }
  .t2 {
    background: linear-gradient(135deg, #e6ebf3, #9aa7bd);
    color: #1b2332;
  }
  .t3 {
    background: linear-gradient(135deg, #e3a777, #a5622e);
    color: #2a1406;
  }
  .t4 {
    background: linear-gradient(135deg, #63d1c0, #23887a);
    color: #04201c;
  }
</style>
