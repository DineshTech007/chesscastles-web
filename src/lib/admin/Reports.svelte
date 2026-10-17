<script lang="ts">
  /** Admin: reports about players (fair play, abuse…) and messages to support, and what was done. */
  import { reports, resolveReport, type Report } from '$lib/admin';

  let { onopen }: { onopen: (uid: string) => void } = $props();
  const STATUSES = [
    ['open', 'Open'],
    ['warned', 'Warned'],
    ['actioned', 'Action taken'],
    ['answered', 'Answered'],
    ['dismissed', 'Dismissed'],
  ] as const;
  let status = $state('open');
  let list = $state<Report[] | undefined>();
  let error = $state('');
  let notes = $state<Record<number, string>>({});
  let busy = $state<number | undefined>();
  $effect(() => {
    const st = status;
    list = undefined;
    reports(st).then(
      (r) => status === st && (list = r),
      (e) => (error = e.message),
    );
  });
  async function resolve(r: Report, to: string) {
    busy = r.id;
    try {
      await resolveReport(r.id, to, notes[r.id] ?? '');
      list = list?.filter((x) => x.id !== r.id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Not saved.';
    } finally {
      busy = undefined;
    }
  }
  const date = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<div class="segmented tabs" role="group" aria-label="Status">
  {#each STATUSES as [k, label] (k)}<button aria-pressed={status === k} onclick={() => (status = k)}>{label}</button>{/each}
</div>
{#if error}<p class="error">{error}</p>{/if}
{#if !list}
  <div class="card skel"></div>
{:else if !list.length}
  <p class="label">{status === 'open' ? 'Nothing waiting. 🎉' : 'None.'}</p>
{:else}
  <ul class="list">
    {#each list as r (r.id)}
      <li class="card item">
        <div class="head">
          <span class="kind" class:support={r.kind === 'support'}>{r.kind === 'support' ? 'Support message' : 'Report'}</span>
          <strong>{r.reason}</strong>
          <span class="label">{date(r.created)}</span>
        </div>
        <p class="who">
          From <button class="link" onclick={() => onopen(r.reporter)}>{r.reporterName ?? r.reporter}</button>
          {#if r.reported}· about <button class="link" onclick={() => onopen(r.reported)}>{r.reportedName ?? r.reported}</button>{/if}
        </p>
        {#if r.details}<p class="details">{r.details}</p>{/if}
        {#if r.game}<p class="label">Game: {#if /^(https:\/\/|\/)/.test(r.game)}<a href={r.game} target="_blank" rel="noopener">{r.game}</a>{:else}{r.game}{/if}</p>{/if}
        {#if r.resolution}<p class="label">Done: {r.resolution}</p>{/if}
        {#if status === 'open'}
          <input bind:value={notes[r.id]} placeholder="What you did or answered (kept in the log)" aria-label="Note" />
          <div class="acts">
            {#if r.kind === 'support'}
              <button class="btn primary" disabled={busy === r.id} onclick={() => resolve(r, 'answered')}>Answered</button>
            {:else}
              <button class="btn" disabled={busy === r.id} onclick={() => resolve(r, 'warned')}>Warned</button>
              <button class="btn primary" disabled={busy === r.id} onclick={() => resolve(r, 'actioned')}>Action taken</button>
            {/if}
            <button class="btn" disabled={busy === r.id} onclick={() => resolve(r, 'dismissed')}>Dismiss</button>
          </div>
        {:else}
          <button class="btn small" disabled={busy === r.id} onclick={() => resolve(r, 'open')}>Reopen</button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .tabs {
    max-width: 620px;
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
  .item p {
    margin: 0;
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .kind {
    font-size: 12px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--loss) 18%, transparent);
  }
  .kind.support {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .details {
    white-space: pre-wrap;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--raised);
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
  input {
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 10px;
    font: inherit;
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .btn.small {
    align-self: flex-start;
    min-height: 32px;
  }
  .error {
    color: var(--loss);
  }
  .skel {
    height: 160px;
  }
</style>
