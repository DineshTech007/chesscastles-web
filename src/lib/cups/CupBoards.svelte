<script lang="ts">
  /**
   * Every board of the round being played, small, beside the main board (owner, 2026-10-23: "we should be able to see
   * all the boards on the right side; click on a username and see that player's board"). A tap on a board puts it on the
   * big board; games between computer players are not here (they are played out at once).
   */
  import { t } from '$lib/i18n';
  import Board from '$lib/components/Board.svelte';
  import EvalBar from './EvalBar.svelte';
  import { lineAt } from '$lib/classroom/tasks';
  import type { CupGame, CupView } from './api';

  let { v, me, selected, onpick }: { v: CupView; me: string; selected: string; onpick: (g: CupGame) => void } = $props();

  const rank = $derived(new Map(v.standings.map((r) => [r.uid, r.rank])));
  const player = (uid: string) => v.players.find((p) => p.uid === uid);
  const games = $derived(
    v.games
      .filter((g) => g.round === v.round && g.black && !g.reason.startsWith('Played'))
      .sort((a, b) => Number(!!a.result) - Number(!!b.result) || Math.min(rank.get(a.white) ?? 99, rank.get(a.black) ?? 99) - Math.min(rank.get(b.white) ?? 99, rank.get(b.black) ?? 99)),
  );
  const result = (g: CupGame) => (g.result === '1/2-1/2' ? '½–½' : g.result === '1-0' ? '1–0' : g.result === '0-1' ? '0–1' : '');
  const tag = (uid: string) => (player(uid)?.bot ? ' 🤖' : '');
</script>

{#if !games.length}
  <p class="muted">{$t('cux.noBoards')}</p>
{:else}
  <p class="hint">{$t('cux.tapName')}</p>
  <div class="grid">
    {#each games as g (g.id)}
      {@const at = lineAt(g.root, g.moves, g.moves.length)}
      {@const mine = g.white === me || g.black === me}
      <button class="card" class:on={g.id === selected} class:mine onclick={() => onpick(g)} aria-pressed={g.id === selected}>
        <span class="nm">{g.blackName}{tag(g.black)}<i class="rk">{rank.get(g.black) ?? ''}</i></span>
        {#if !g.result && !mine}<EvalBar fen={at.fen} thin />{/if}
        <span class="mini"><Board fen={at.fen} lastMove={at.last as never} orientation="white" viewOnly coordinates={false} label={`${g.whiteName} vs ${g.blackName}`} /></span>
        <span class="nm">{g.whiteName}{tag(g.white)}<i class="rk">{rank.get(g.white) ?? ''}</i></span>
        <span class="foot">
          {#if g.result}<b class="res">{result(g)}</b>{:else}<span class="live">● {$t('cux.live')}</span>{/if}
          {#if mine}<span class="you">{$t('cux.mine')}</span>{/if}
        </span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .hint {
    margin: 0 0 6px;
    font-size: 12.5px;
    color: var(--muted);
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .card.on {
    border-color: var(--gold);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--gold) 40%, transparent);
  }
  .card.mine:not(.on) {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  }
  .nm {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    font-size: 12px;
    font-weight: 700;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rk {
    font-style: normal;
    font-weight: 600;
    color: var(--muted);
  }
  .mini {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    pointer-events: none;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11.5px;
    min-height: 16px;
  }
  .res {
    font-variant-numeric: tabular-nums;
  }
  .live {
    color: #ef4444;
    font-weight: 800;
  }
  .you {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--gold);
    color: #1b1300;
    font-weight: 800;
  }
</style>
