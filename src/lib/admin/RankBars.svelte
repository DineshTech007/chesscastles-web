<script lang="ts">
  /** A ranked list with bars (top pages, features, countries…): the label, a bar for scale, the count. */
  let { title, rows, name = (k: string) => k, empty = 'Nothing yet.', note }: { title: string; rows: { key: string; count: number }[]; name?: (k: string) => string; empty?: string; note?: string } = $props();
  const max = $derived(Math.max(1, ...rows.map((r) => r.count)));
  const total = $derived(rows.reduce((s, r) => s + r.count, 0));
</script>

<section class="card ranks">
  <h3 class="title">{title}</h3>
  {#if note}<p class="label note">{note}</p>{/if}
  {#if !rows.length}
    <p class="label">{empty}</p>
  {:else}
    <ol>
      {#each rows as r (r.key)}
        <li title="{name(r.key)}: {r.count.toLocaleString()} ({Math.round((100 * r.count) / total)}%)">
          <span class="name">{name(r.key)}</span>
          <span class="track"><span class="fill" style="width: {(100 * r.count) / max}%"></span></span>
          <span class="num n">{r.count.toLocaleString()}</span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .ranks {
    padding: 14px 16px;
    min-width: 0;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .note {
    margin: -4px 0 8px;
    font-size: 12.5px;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(40px, 1fr) auto;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    padding: 2px 0;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .track {
    height: 8px;
    border-radius: 4px;
    background: var(--raised);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--accent);
  }
  .n {
    font-weight: 700;
    min-width: 32px;
    text-align: right;
  }
</style>
