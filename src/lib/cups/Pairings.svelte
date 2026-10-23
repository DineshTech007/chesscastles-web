<script lang="ts">
  /**
   * Who played whom, round by round (owner, 2026-10-23: "after all the rounds show the pairings"): during the cup
   * the rounds so far, and at the end all of them. White first, the result between; the player's own games stand out,
   * and a tap on a name opens that player's board while the cup is on (onwatch).
   */
  import { t } from '$lib/i18n';
  import type { CupView } from './api';

  let { v, me, onwatch }: { v: CupView; me: string; onwatch?: (uid: string) => void } = $props();

  const rank = $derived(new Map(v.standings.map((r) => [r.uid, r.rank])));
  const bot = (uid: string) => !!v.players.find((p) => p.uid === uid)?.bot;
  const last = $derived(v.status === 'over' ? v.rounds : v.round);
  const rounds = $derived(Array.from({ length: last }, (_, i) => i + 1));
  const gamesOf = (r: number) =>
    v.games
      .filter((g) => g.round === r)
      .sort((a, b) => Math.min(rank.get(a.white) ?? 99, rank.get(a.black) ?? 99) - Math.min(rank.get(b.white) ?? 99, rank.get(b.black) ?? 99));
  const res = (r: string) => (r === '1/2-1/2' ? '½–½' : r === '1-0' ? '1–0' : r === '0-1' ? '0–1' : '·');
</script>

{#each rounds as r (r)}
  {@const list = gamesOf(r)}
  {#if list.length}
    <h4>{$t('cux.round', { n: r })}</h4>
    <ul>
      {#each list as g (g.id)}
        <li class:mine={g.white === me || g.black === me}>
          {#if onwatch}<button class="who w" onclick={() => onwatch(g.white)}>{g.whiteName}{#if bot(g.white)} 🤖{/if}</button>{:else}<span class="who w">{g.whiteName}{#if bot(g.white)} 🤖{/if}</span>{/if}
          <b class="res num" class:live={!g.result && !!g.black}>{g.black ? res(g.result) : '+'}</b>
          {#if g.black}{#if onwatch}<button class="who b" onclick={() => onwatch(g.black)}>{g.blackName}{#if bot(g.black)} 🤖{/if}</button>{:else}<span class="who b">{g.blackName}{#if bot(g.black)} 🤖{/if}</span>{/if}{:else}<span class="who b muted">{$t('cups.bye')}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
{/each}

<style>
  h4 {
    margin: 10px 0 4px;
    font: 800 12.5px var(--font-body);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h4:first-child {
    margin-top: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 8px;
    font-size: 13.5px;
  }
  li.mine {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
  }
  .who {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-weight: 600;
    padding: 0;
  }
  button.who {
    cursor: pointer;
  }
  button.who:hover {
    text-decoration: underline;
  }
  .w {
    text-align: right;
  }
  .b {
    text-align: left;
  }
  .res {
    font-variant-numeric: tabular-nums;
    min-width: 42px;
    text-align: center;
  }
  .res.live {
    color: #ef4444;
  }
  .muted {
    color: var(--muted);
  }
</style>
