<script lang="ts">
  /**
   * A Chess Castles title before a player's name, the way FIDE titles are
   * shown ("CGM Prutha"): a bold badge coloured by tier (gold for the
   * grandmasters, silver, bronze, teal). `full`: the profile's banner, with the
   * title's name ("Castle Grandmaster").
   */
  import { isTitle, TITLE_NAME, TITLE_TIER } from '$lib/titles';

  let { title, size = 13, full = false }: { title?: string; size?: number; full?: boolean } = $props();
</script>

{#if isTitle(title)}
  {#if full}
    <span class="banner t{TITLE_TIER[title]}" style="font-size: {size}px">
      <span class="tb t{TITLE_TIER[title]}">{title}</span>
      <span class="what">{TITLE_NAME[title]}</span>
      <span class="label by">Chess Castles title</span>
    </span>
  {:else}
    <abbr class="tb t{TITLE_TIER[title]}" title="{TITLE_NAME[title]} (a Chess Castles title)" style="font-size: {size}px">{title}</abbr>
  {/if}
{/if}

<style>
  .tb {
    display: inline-block;
    padding: 0.12em 0.45em 0.1em;
    border-radius: 0.3em;
    font-family: var(--font-title);
    font-weight: 900;
    letter-spacing: 0.04em;
    line-height: 1.2;
    text-decoration: none;
    vertical-align: 0.1em;
    margin-right: 0.4em;
    white-space: nowrap;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.35) inset,
      0 1px 3px rgba(0, 0, 0, 0.35);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
  }
  .tb.t1 {
    background: linear-gradient(180deg, #ffe28a, #e0a531 55%, #b97c16);
    color: #3a2300;
  }
  .tb.t2 {
    background: linear-gradient(180deg, #f4f7fb, #bfc8d6 55%, #8d99ad);
    color: #1b2332;
  }
  .tb.t3 {
    background: linear-gradient(180deg, #f2c29b, #c97b43 55%, #9a5524);
    color: #2a1406;
  }
  .tb.t4 {
    background: linear-gradient(180deg, #8ae6d7, #33a796 55%, #1f7a6d);
    color: #03201c;
  }
  .banner {
    display: inline-flex;
    align-items: center;
    gap: 0.6em;
    flex-wrap: wrap;
    padding: 0.4em 0.8em 0.4em 0.45em;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
  }
  .banner.t1 {
    border-color: color-mix(in srgb, #e0a531 60%, var(--border));
    background: color-mix(in srgb, #e0a531 14%, var(--raised));
  }
  .banner.t2 {
    border-color: color-mix(in srgb, #bfc8d6 50%, var(--border));
  }
  .banner.t3 {
    border-color: color-mix(in srgb, #c97b43 55%, var(--border));
  }
  .banner.t4 {
    border-color: color-mix(in srgb, #33a796 55%, var(--border));
  }
  .banner .tb {
    margin-right: 0;
    font-size: 1.15em;
  }
  .what {
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 1.05em;
    color: var(--text);
  }
  .by {
    font-size: 0.85em;
  }
</style>
