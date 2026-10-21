<script lang="ts">
  /**
   * The owner's WhatsApp list: players who gave a number (their own, or a parent's) with their latest Guru summary,
   * the message written for each (where they lose the most points, the link back to their report), and "Send on
   * WhatsApp", which opens WhatsApp with it ready and marks it sent. Longest-waiting first.
   */
  import { onMount } from 'svelte';
  import { formatDate } from '$lib/format';
  import { markSent, waLink, waMessage, whatsappList, type WaPlayer } from '$lib/whatsapp';

  let players = $state<WaPlayer[] | undefined>();
  let error = $state('');
  const WEEK = 7 * 86_400_000;
  onMount(async () => {
    try {
      players = await whatsappList();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load.';
    }
  });
  const due = $derived((players ?? []).filter((p) => Date.now() - p.sentAt > WEEK).length);

  function sent(p: WaPlayer) {
    p.sentAt = Date.now();
    void markSent(p.uid).catch(() => {});
  }
</script>

<section class="card pad">
  <h3 class="title">WhatsApp reports</h3>
  <p class="label">
    Players who gave a WhatsApp number after signing in, with consent (under 18: a parent's). Each message says where they lose the most points and links back to their
    report and study plan. <strong>Send on WhatsApp</strong> opens WhatsApp with the message ready (your own WhatsApp, free); it is marked sent when you click.
    The summary updates each time the player runs Guru's Insights.
  </p>
  {#if players}<p><strong class="num">{players.length}</strong> players · <strong class="num">{due}</strong> not messaged this week</p>{/if}
</section>

{#if error}<p class="label">{error}</p>{:else if !players}<p class="label">Loading…</p>{:else if !players.length}<p class="card pad label">Nobody has given a number yet.</p>{/if}

{#each players ?? [] as p (p.uid)}
  {@const text = waMessage(p)}
  <article class="card row" class:recent={Date.now() - p.sentAt <= WEEK}>
    <div class="who">
      <strong>{p.name}</strong>
      <span class="label">{p.username} · {p.whose === 'parent' ? "parent's number" : 'own number'} · <span class="num">{p.phone}</span></span>
      {#if p.report?.games}
        <span class="label">Guru: {p.report.games} games · score {p.report.score}% · accuracy {p.report.accuracy}%{#if p.report.weak[0]} · weakest: {p.report.weak[0].title}{/if} · {formatDate(p.reportAt)}</span>
      {:else}
        <span class="label">No Guru report yet: the message invites them to run one.</span>
      {/if}
      <span class="label">{p.sentAt ? `Last sent ${formatDate(p.sentAt)}` : 'Never sent'}</span>
      <details><summary class="label">The message</summary><pre>{text}</pre></details>
    </div>
    <a class="btn primary" href={waLink(p.phone, text)} target="_blank" rel="noopener" onclick={() => sent(p)}>Send on WhatsApp</a>
  </article>
{/each}

<style>
  .pad {
    padding: 16px;
    margin-bottom: 12px;
  }
  .pad p {
    margin: 6px 0 0;
  }
  .row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12px 14px;
    margin-bottom: 8px;
  }
  .row.recent {
    opacity: 0.65;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  pre {
    white-space: pre-wrap;
    font: inherit;
    font-size: 13.5px;
    margin: 6px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--raised);
  }
  @media (max-width: 600px) {
    .row {
      flex-direction: column;
    }
  }
</style>
