<script lang="ts">
  /** Home page: work your coach set you (shown only when you have a coach). */
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import Icon from './Icon.svelte';
  import { session } from '$lib/auth';
  import { leaveCoach, markDone, myCoaches, type Assignment } from '$lib/students';
  import type { Player } from '$lib/social';

  let { manage = false }: { manage?: boolean } = $props();
  let coaches = $state<Player[]>([]);
  let work = $state<Assignment[]>([]);
  const load = () =>
    myCoaches().then(
      (r) => ((coaches = r.coaches), (work = r.assignments)),
      () => {},
    );
  $effect(() => {
    if ($session.status === 'in') void load();
  });
  const nameOf = (uid: string) => coaches.find((c) => c.uid === uid)?.name ?? 'Your coach';
  const open = $derived(work.filter((w) => !w.done));
  async function done(w: Assignment) {
    await markDone(w.id).catch(() => {});
    await load();
  }
</script>

{#if coaches.length && (open.length || manage)}
  <section class="card cw" aria-labelledby="cw-h">
    <h2 id="cw-h" class="title">From your coach</h2>
    {#if !open.length}
      <p class="label">No work waiting.</p>
    {:else}
      <ul>
        {#each open as w (w.id)}
          <li>
            <span class="txt">
              {#if w.ref.startsWith('/')}<a href={w.ref}>{w.title}</a>{:else}<strong>{w.title}</strong>{/if}
              <span class="label">{nameOf(w.coach)}{w.note ? ` · ${w.note}` : ''}</span>
            </span>
            <button class="btn small" onclick={() => done(w)}><Icon name="check" size={14} />Done</button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if manage}
      <h3 class="title">Your coaches</h3>
      <ul>
        {#each coaches as c (c.uid)}
          <li><span class="txt"><strong><TitleBadge title={c.title} size={11} />{c.name}</strong><span class="label">@{c.username}</span></span><button class="btn small" onclick={() => leaveCoach(c.uid).then(load)}>Leave</button></li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .cw {
    padding: 16px 18px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  h3 {
    margin: 12px 0 6px;
    font-size: 15px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--raised);
  }
  .txt {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .txt a {
    font-weight: 700;
  }
  .btn.small {
    min-height: 32px;
    padding: 0 10px;
    gap: 4px;
    font-size: 13px;
  }
</style>
