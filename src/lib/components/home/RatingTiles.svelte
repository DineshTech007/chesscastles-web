<script lang="ts">
  /**
   * The home page's ratings, as tiles (chess.com's "Stats"): the player's CC Rating at each speed they have played
   * (then the others, to play for), and their puzzle rating. A tile opens its rating history.
   */
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { t } from '$lib/i18n';
  import { KFIDE_SPEEDS, SPEED_LABEL, type KfideSpeed } from '$lib/kfide';
  import { kfideAll } from '$lib/stores/me';
  import { puzzleProvisional, puzzleRating } from '$lib/puzzles/rating';

  const ICON: Record<KfideSpeed, IconName> = { bullet: 'flame', blitz: 'puzzle', rapid: 'history', standard: 'crown' };
  /** Fastest first, the speeds played before the others. */
  const speeds = $derived([...KFIDE_SPEEDS].reverse().sort((a, b) => Number($kfideAll[b].games > 0) - Number($kfideAll[a].games > 0)));
</script>

<section class="ratings" aria-labelledby="rt-h">
  <h2 id="rt-h" class="sec-h">{$t('home.ratings')} <a href="/profile#cc-ratings">{$t('home.seeall')}</a></h2>
  <div class="tiles">
    {#each speeds as s (s)}
      {@const k = $kfideAll[s]}
      <a class="tile" class:none={!k.games} href={k.games ? `/profile?speed=${s}#cc-ratings` : '/play?mode=fide'}>
        <span class="ic {s}"><Icon name={ICON[s]} size={18} /></span>
        {#if k.games}<strong class="num">{k.rating}{#if k.provisional}<small>?</small>{/if}</strong>{:else}<strong class="dash">–</strong>{/if}
        <span class="lb">{SPEED_LABEL[s]}</span>
      </a>
    {/each}
    <a class="tile" href="/puzzles">
      <span class="ic puz"><Icon name="puzzle" size={18} /></span>
      <strong class="num">{$puzzleRating}{$puzzleProvisional ? '?' : ''}</strong>
      <span class="lb">{$t('rs.puzzles')}</span>
    </a>
  </div>
</section>

<style>
  .ratings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px 4px 10px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    text-decoration: none;
  }
  .tile:hover {
    border-color: var(--gold);
    text-decoration: none;
  }
  .ic {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    margin-bottom: 2px;
    color: #0b1426;
  }
  .ic.bullet {
    background: linear-gradient(135deg, #ffd27a, #f59e0b);
  }
  .ic.blitz {
    background: linear-gradient(135deg, #fde68a, #eab308);
  }
  .ic.rapid {
    background: linear-gradient(135deg, #86efac, #22c55e);
  }
  .ic.standard {
    background: linear-gradient(135deg, #a5b4fc, #6366f1);
  }
  .ic.puz {
    background: linear-gradient(135deg, #7dd3fc, #0ea5e9);
  }
  strong {
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 1.05;
  }
  strong small {
    font-size: 14px;
    color: var(--muted);
  }
  .dash {
    color: var(--muted);
  }
  .lb {
    font-size: 12px;
    color: var(--text-2);
    font-weight: 600;
  }
  .tile.none {
    opacity: 0.72;
  }
  @media (max-width: 767px) {
    .tiles {
      display: flex;
      overflow-x: auto;
      scrollbar-width: none;
      margin: 0 -16px;
      padding: 0 16px 2px;
    }
    .tiles::-webkit-scrollbar {
      display: none;
    }
    .tile {
      flex: 0 0 92px;
    }
  }
</style>
