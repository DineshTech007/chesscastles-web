<script lang="ts">
  /**
   * Friend requests waiting for an answer. `inline`: a card on the home page (always there while a request
   * waits). Otherwise a small popup that opens on any page when a new request comes in, so nobody has to
   * search for it; "Later" hides it until a different request arrives.
   */
  import { session } from '$lib/auth';
  import { friendAction, incomingRequests, initialsOf, playerPhoto, refreshBadge, type Player } from '$lib/social';
  import { t } from '$lib/i18n';
  import Icon from './Icon.svelte';

  let { inline = false }: { inline?: boolean } = $props();
  const KEY = 'cc.reqLater';
  let later = $state<string[]>([]);
  let busy = $state('');
  let error = $state('');
  try {
    later = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
  } catch {
    /* blocked */
  }
  const waiting = $derived($session.status === 'in' ? $incomingRequests : []);
  /** The popup shows requests not postponed yet. */
  const fresh = $derived(waiting.filter((p) => !later.includes(p.uid)));
  const shown = $derived<Player[]>(inline ? waiting : fresh);

  async function act(p: Player, a: 'accept' | 'remove') {
    busy = p.uid;
    error = '';
    try {
      await friendAction(p.uid, a);
      await refreshBadge();
    } catch (e) {
      error = e instanceof Error ? e.message : 'That did not work. Try again.';
    } finally {
      busy = '';
    }
  }
  function postpone() {
    later = [...new Set([...later, ...waiting.map((p) => p.uid)])];
    try {
      sessionStorage.setItem(KEY, JSON.stringify(later));
    } catch {
      /* kept for this page only */
    }
  }
</script>

{#if shown.length}
  <section class="req" class:inline class:pop={!inline} role={inline ? undefined : 'alertdialog'} aria-labelledby="req-h" aria-live="polite">
    <div class="head">
      <Icon name="user_plus" size={20} color="var(--gold)" />
      <h2 id="req-h" class="title">{shown.length === 1 ? $t('fr.one') : $t('fr.many', { n: shown.length })}</h2>
      {#if !inline}<button class="x" onclick={postpone} aria-label={$t('fr.hide')}><Icon name="close" size={16} /></button>{/if}
    </div>
    {#each shown.slice(0, inline ? 5 : 1) as p (p.uid)}
      {@const photo = playerPhoto(p)}
      <div class="one">
        <a class="who" href="/players/{encodeURIComponent(p.uid)}">
          <span class="av">{#if photo}<img src={photo} alt="" />{:else}{initialsOf(p.name)}{/if}</span>
          <span class="txt"><strong>{p.name}</strong><span class="label">{$t('fr.wants')}{p.kfide && p.kfideGames ? ` · CC Rating ${p.kfide}` : ''}</span></span>
        </a>
        <div class="btns">
          <button class="btn primary" disabled={busy === p.uid} onclick={() => act(p, 'accept')}>{$t('fr.accept')}</button>
          <button class="btn ghost" disabled={busy === p.uid} onclick={() => act(p, 'remove')}>{$t('fr.decline')}</button>
        </div>
      </div>
    {/each}
    {#if !inline && shown.length > 1}<a class="more label" href="/friends">{$t('fr.more', { n: shown.length - 1 })}</a>{/if}
    {#if inline && shown.length > 5}<a class="more label" href="/friends">{$t('fr.more', { n: shown.length - 5 })}</a>{/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </section>
{/if}

<style>
  .req {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 12%, var(--card));
    color: var(--text);
  }
  .req.pop {
    position: fixed;
    z-index: 90;
    right: 18px;
    top: 18px;
    width: min(360px, calc(100vw - 24px));
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
    animation: in 0.25s ease-out;
  }
  @keyframes in {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
  }
  @media (max-width: 767px) {
    .req.pop {
      top: auto;
      bottom: 78px;
      right: 12px;
      left: 12px;
      width: auto;
    }
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2 {
    margin: 0;
    flex: 1;
    font-size: 16px;
  }
  .x {
    border: 0;
    background: none;
    color: var(--muted);
    width: 32px;
    height: 32px;
    cursor: pointer;
  }
  .one {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .who {
    flex: 1 1 180px;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }
  .av {
    width: 42px;
    height: 42px;
    flex: none;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: var(--raised);
    font-weight: 800;
  }
  .av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .txt strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .btns {
    display: flex;
    gap: 6px;
  }
  .more {
    color: var(--accent);
  }
  .err {
    margin: 0;
    color: var(--loss);
    font-size: 13px;
  }
</style>
