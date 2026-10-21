<script lang="ts">
  /** The home page's leaderboard: the top 5 on the board picked (CC Rating first when signed in), and a link to the full boards. */
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { session } from '$lib/auth';
  import { BOARDS, loadBoard, type BoardKind, type Row } from '$lib/leaderboards';
  import Icon from './Icon.svelte';

  let kind = $state<BoardKind | undefined>();
  let rows = $state<Row[] | undefined>();

  // The board to start on: CC Rating for players signed in, the Blindfold Gym for visitors.
  $effect(() => {
    if ($session.status === 'loading' || kind) return;
    kind = $session.status === 'in' ? 'kfide' : 'vision';
  });
  const tabs = $derived(BOARDS.filter((b) => !b.signIn || $session.status === 'in'));
  $effect(() => {
    const k = kind;
    if (!k) return;
    rows = undefined;
    loadBoard(k).then(
      (r) => {
        if (kind === k) rows = r.slice(0, 5);
      },
      () => (rows = []),
    );
  });
  const medal = ['🥇', '🥈', '🥉', '4', '5'];
  const EMPTY: Record<BoardKind, string> = {
    kfide: 'No CC Ratings yet: play a FIDE-level opponent to be first.',
    lichess: 'No Lichess ratings yet.',
    puzzles: 'No puzzle ratings yet.',
    rush: 'No Puzzle Rush scores yet: be the first!',
    vision: 'No one here yet: try the Blindfold Gym.',
    study: 'No one has studied this week yet.',
    books: 'No chapters read yet.',
  };
</script>

<section class="card lb" aria-labelledby="lb-h">
  <div class="card-head">
    <h2 id="lb-h" class="title">Leaderboard</h2>
  </div>
  <div class="mini-tabs" role="tablist" aria-label="Leaderboard">
    {#each tabs as b (b.id)}
      <button role="tab" aria-selected={kind === b.id} class:on={kind === b.id} onclick={() => (kind = b.id)}>{b.label}</button>
    {/each}
  </div>
  {#if !rows}
    {#each [0, 1, 2, 3, 4] as i (i)}<div class="line skel"></div>{/each}
  {:else if !rows.length}
    <p class="label empty">{kind ? EMPTY[kind] : ''}</p>
  {:else}
    <ol>
      {#each rows as r, i (r.key)}
        <li class:me={r.me}>
          <span class="m">{medal[i]}</span>
          {#if r.uid}<a class="n" href="/players/{encodeURIComponent(r.uid)}"><TitleBadge title={r.ccTitle} size={11} />{r.name}{#if r.plan} <PlanBadge plan={r.plan} />{/if}</a>{:else}<span class="n">{r.name}</span>{/if}
          <strong class="num">{r.value}</strong>
        </li>
      {/each}
    </ol>
  {/if}
  <a class="more" href="/leaderboard#{kind ?? 'kfide'}">Full leaderboard <Icon name="chevron" size={14} /></a>
</section>

<style>
  .lb {
    flex: 1 1 280px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card-head h2 {
    margin: 0;
  }
  .mini-tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .mini-tabs button {
    flex: none;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--muted);
    border-radius: 999px;
    padding: 4px 10px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .mini-tabs button.on {
    background: var(--action);
    color: var(--on-action);
    border-color: transparent;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 6px;
    border-radius: 8px;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  li.me {
    background: color-mix(in srgb, var(--gold) 12%, transparent);
  }
  .m {
    width: 24px;
    text-align: center;
    font-weight: 800;
    color: var(--muted);
  }
  .n {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
    font-weight: 600;
    text-decoration: none;
  }
  .empty {
    margin: 8px 0;
  }
  .line {
    height: 34px;
    border-radius: 8px;
  }
  .skel {
    background: var(--raised);
  }
  .more {
    margin-top: auto;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-weight: 600;
  }
</style>
