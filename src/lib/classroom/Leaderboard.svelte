<script lang="ts">
  /** A class leaderboard: the first three on a podium (gold, silver, bronze), then everyone else; mine highlighted. */
  import { took } from './tasks';
  import { t } from '$lib/i18n';

  let {
    rows,
    me = '',
    total = 0,
    empty = '',
  }: {
    rows: { uid: string; name: string; points: number; solved: number; ms: number; wrong?: number; done?: boolean }[];
    me?: string;
    /** How many puzzles there were (for "3/5 solved"). */
    total?: number;
    empty?: string;
  } = $props();
  const MEDALS = ['🥇', '🥈', '🥉'];
</script>

{#if !rows.length}
  <p class="empty">{empty || $t('kidsclass.lb.empty')}</p>
{:else}
  <div class="podium">
    {#each rows.slice(0, 3) as r, i (r.uid)}
      <div class="step p{i + 1}" class:me={r.uid === me}>
        <span class="medal" aria-hidden="true">{MEDALS[i]}</span>
        <b class="name">{r.name}</b>
        <span class="pts num">{r.points} <small>pts</small></span>
        <span class="sub">{$t('kidsclass.lb.solved', { n: `${r.solved}${total ? `/${total}` : ''}` })} · {took(r.ms)}</span>
      </div>
    {/each}
  </div>
  {#if rows.length > 3}
    <table>
      <thead><tr><th>#</th><th>{$t('kidsclass.lb.name')}</th><th>Points</th><th>{$t('kidsclass.lb.solvedCol')}</th><th>{$t('kidsclass.lb.time')}</th></tr></thead>
      <tbody>
        {#each rows.slice(3) as r, i (r.uid)}
          <tr class:me={r.uid === me}>
            <td class="num">{i + 4}</td>
            <td>{r.name}</td>
            <td class="num">{r.points}</td>
            <td class="num">{r.solved}{total ? `/${total}` : ''}</td>
            <td class="num">{took(r.ms)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<style>
  .empty {
    color: var(--muted);
    margin: 8px 0;
  }
  .podium {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    align-items: end;
  }
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 6px;
    border-radius: 12px;
    background: var(--raised);
    border: 1px solid var(--border);
    text-align: center;
    min-width: 0;
  }
  .step.p1 {
    order: 2;
    background: linear-gradient(180deg, rgba(237, 176, 64, 0.32), var(--raised));
    border-color: var(--gold);
    padding-top: 16px;
  }
  .step.p2 {
    order: 1;
  }
  .step.p3 {
    order: 3;
  }
  .step.me {
    box-shadow: 0 0 0 2px var(--live);
  }
  .medal {
    font-size: 30px;
    line-height: 1;
  }
  .p1 .medal {
    font-size: 38px;
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .pts {
    font: 800 20px var(--font-title);
    color: var(--gold);
  }
  .pts small {
    font-size: 12px;
    color: var(--muted);
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
  }
  table {
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    text-align: left;
    color: var(--muted);
    font-weight: 600;
    font-size: 12px;
    padding: 4px 6px;
  }
  td {
    padding: 6px;
    border-top: 1px solid var(--border-soft);
  }
  tr.me td {
    background: rgba(56, 210, 255, 0.12);
  }
</style>
