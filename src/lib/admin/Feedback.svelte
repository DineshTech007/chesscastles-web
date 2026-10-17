<script lang="ts">
  /** Admin: feedback from /feedback, newest first, with the average rating; mark it read or done. */
  import { call } from '$lib/social';

  interface Item {
    id: number;
    uid: string;
    name?: string;
    username?: string;
    kind: string;
    rating: number;
    area: string;
    message: string;
    contact: number;
    created: number;
    status: string;
    note: string;
  }
  let { onopen }: { onopen: (uid: string) => void } = $props();
  let status = $state('new');
  let list = $state<Item[] | undefined>();
  let stats = $state<{ total: number; fresh: number; avg: number | null; rated: number } | undefined>();
  let error = $state('');
  const KIND: Record<string, string> = { idea: '💡 Idea', bug: '🐞 Broken', love: '❤️ Love', other: '💬 Other' };
  const FACES = ['', '😞', '🙁', '😐', '🙂', '😍'];

  $effect(() => {
    const st = status;
    list = undefined;
    call<{ feedback: Item[]; stats: typeof stats }>('GET', `admin/feedback?status=${st}`).then(
      (r) => status === st && ((list = r.feedback), (stats = r.stats)),
      (e) => (error = e.message),
    );
  });
  async function mark(f: Item, to: string) {
    await call('POST', 'admin/feedback', { id: f.id, status: to }).catch((e) => (error = e.message));
    list = list?.filter((x) => x.id !== f.id);
  }
  const date = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

{#if stats}
  <div class="stats">
    <div class="card s"><span class="label">Last 30 days</span><strong class="num">{stats.total ?? 0}</strong><span class="label">messages</span></div>
    <div class="card s"><span class="label">Not read yet</span><strong class="num">{stats.fresh ?? 0}</strong></div>
    <div class="card s"><span class="label">Average rating</span><strong class="num">{stats.avg ? `${stats.avg.toFixed(1)} / 5` : '—'}</strong><span class="label">{stats.rated ?? 0} ratings</span></div>
  </div>
{/if}
<div class="segmented tabs" role="group" aria-label="Status">
  {#each [['new', 'New'], ['read', 'Read'], ['done', 'Done']] as [k, label] (k)}<button aria-pressed={status === k} onclick={() => (status = k)}>{label}</button>{/each}
</div>
{#if error}<p class="error">{error}</p>{/if}
{#if !list}
  <div class="card skel"></div>
{:else if !list.length}
  <p class="label">{status === 'new' ? 'No new feedback.' : 'None.'}</p>
{:else}
  <ul class="list">
    {#each list as f (f.id)}
      <li class="card item">
        <div class="head">
          <span class="kind">{KIND[f.kind] ?? f.kind}</span>
          {#if f.rating}<span class="face" title="{f.rating} of 5">{FACES[f.rating]}</span>{/if}
          {#if f.area}<span class="pill">{f.area}</span>{/if}
          <span class="label">{date(f.created)}</span>
        </div>
        {#if f.message}<p class="msg">{f.message}</p>{/if}
        <p class="label who">
          {#if f.uid}From <button class="link" onclick={() => onopen(f.uid)}>{f.name ?? f.username ?? f.uid}</button>{f.contact ? ' · happy to be contacted' : ''}{:else}Anonymous{/if}
        </p>
        <div class="acts">
          {#if status !== 'read'}<button class="btn small" onclick={() => mark(f, 'read')}>Mark read</button>{/if}
          {#if status !== 'done'}<button class="btn small primary" onclick={() => mark(f, 'done')}>Done</button>{/if}
          {#if status !== 'new'}<button class="btn small" onclick={() => mark(f, 'new')}>Back to new</button>{/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }
  .s {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
  }
  .s strong {
    font-size: 26px;
  }
  .tabs {
    max-width: 360px;
    margin-bottom: 12px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .item {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .kind {
    font-weight: 800;
  }
  .face {
    font-size: 22px;
  }
  .msg {
    margin: 0;
    white-space: pre-wrap;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--raised);
  }
  .who {
    margin: 0;
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    color: var(--accent);
    font-weight: 700;
    cursor: pointer;
  }
  .acts {
    display: flex;
    gap: 6px;
  }
  .btn.small {
    min-height: 32px;
    padding: 0 12px;
  }
  .error {
    color: var(--loss);
  }
  .skel {
    height: 140px;
  }
  @media (max-width: 560px) {
    .stats {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
