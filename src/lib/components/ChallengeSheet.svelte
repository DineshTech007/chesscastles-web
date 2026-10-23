<script lang="ts">
  /**
   * Inviting a Chess Castles player to a game (invites.ts): the clock (bullet, blitz or rapid), rated or casual, then
   * Send. The other player gets a popup wherever they are on the site; this sheet waits for their answer (a game
   * that starts opens by itself). Bullet is a friendly game on Chess Castles' own server (no ratings).
   */
  import { onDestroy } from 'svelte';
  import { track } from '$lib/analytics';
  import { cancelSent, invitePlayer, isBullet, sentInvite } from '$lib/invites';
  import Icon from './Icon.svelte';

  let { player, onclose }: { player: { uid: string; name: string }; onclose: () => void } = $props();

  const GROUPS: { label: string; note?: string; tcs: [number, number][] }[] = [
    { label: 'Bullet', note: 'friendly game', tcs: [[1, 0], [1, 1], [2, 1]] },
    { label: 'Blitz', tcs: [[3, 0], [3, 2], [5, 0], [5, 3]] },
    { label: 'Rapid', tcs: [[10, 0], [10, 5], [15, 10]] },
  ];
  let tc = $state<[number, number]>([10, 0]);
  let rated = $state(true);
  let sending = $state(false);
  let error = $state('');
  const mine = $derived($sentInvite?.to === player.uid ? $sentInvite : undefined);

  function send() {
    if (sending) return;
    sending = true;
    error = '';
    track('feature', isBullet(tc[0], tc[1]) ? 'invite_bullet' : 'invite');
    invitePlayer(player, tc[0], tc[1], rated)
      .catch((e) => (error = e instanceof Error ? e.message : 'The invite could not be sent.'))
      .finally(() => (sending = false));
  }
  function close() {
    if (mine?.state === 'waiting') cancelSent();
    else sentInvite.set(undefined);
    onclose();
  }
  // Leaving the page (a game starting opens its board): the sheet goes, the invite stays answered or waiting.
  onDestroy(() => {
    if ($sentInvite && $sentInvite.state !== 'waiting') sentInvite.set(undefined);
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />
<div class="scrim" role="presentation" onclick={close}></div>
<div class="sheet card" role="dialog" aria-modal="true" aria-labelledby="cs-h">
  <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
  <h2 id="cs-h" class="title">Play {player.name}</h2>

  {#if mine?.state === 'waiting'}
    <div class="wait">
      <span class="spinner" aria-hidden="true"></span>
      <p><strong>Waiting for {player.name}…</strong></p>
      <p class="label">They see your {mine.tc} invite on Chess Castles now. The game opens here when they accept.</p>
      <button class="btn" onclick={close}>Cancel the invite</button>
    </div>
  {:else if mine?.state === 'declined' || mine?.state === 'gone'}
    <div class="wait">
      <p><strong>{mine.state === 'declined' ? `${player.name} can't play right now.` : `No answer from ${player.name} this time.`}</strong></p>
      <p class="label">Try again later, or play someone else who is online.</p>
      <button class="btn primary" onclick={() => sentInvite.set(undefined)}>Invite again</button>
    </div>
  {:else}
    {#each GROUPS as g (g.label)}
      <div class="grp">
        <span class="label">{g.label}{#if g.note}{' · '}{g.note}{/if}</span>
        <div class="tiles">
          {#each g.tcs as t (t.join('+'))}
            <button class="tile num" aria-pressed={tc[0] === t[0] && tc[1] === t[1]} onclick={() => (tc = t)}>{t[0]}+{t[1]}</button>
          {/each}
        </div>
      </div>
    {/each}
    {#if isBullet(tc[0], tc[1])}
      <p class="label note">Bullet is a friendly game played right here on Chess Castles. It does not change anyone's rating.</p>
    {:else}
      <label class="rated"><input type="checkbox" bind:checked={rated} /> Rated (changes your Lichess rating)</label>
    {/if}
    <button class="btn primary big" onclick={send} disabled={sending}>{sending ? 'Sending…' : `Send invite · ${tc[0]}+${tc[1]}`}</button>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 96;
    background: rgba(5, 10, 20, 0.6);
  }
  .sheet {
    position: fixed;
    z-index: 97;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(460px, 100vw);
    max-height: 92vh;
    overflow-y: auto;
    padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
    border-radius: 22px 22px 0 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: up 0.25s ease-out;
  }
  @media (min-width: 700px) {
    .sheet {
      top: 50%;
      bottom: auto;
      transform: translate(-50%, -50%);
      border-radius: 22px;
    }
  }
  @keyframes up {
    from {
      opacity: 0;
      translate: 0 30px;
    }
  }
  .x {
    position: absolute;
    top: 10px;
    right: 10px;
    border: 0;
    background: transparent;
    color: var(--text-2);
    padding: 6px;
    cursor: pointer;
  }
  h2 {
    margin: 0 30px 0 0;
  }
  .grp {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .tile {
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-weight: 800;
    font-size: 16px;
    cursor: pointer;
  }
  .tile[aria-pressed='true'] {
    border: 2px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 18%, var(--raised));
  }
  .rated {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .note {
    margin: 0;
    font-size: 13px;
  }
  .big {
    min-height: 52px;
    font-size: 17px;
  }
  .wait {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    padding: 8px 0;
  }
  .wait p {
    margin: 0;
  }
  .spinner {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 4px solid color-mix(in srgb, var(--gold) 25%, transparent);
    border-top-color: var(--gold);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .err {
    margin: 0;
    color: var(--loss);
    font-size: 14px;
  }
</style>
