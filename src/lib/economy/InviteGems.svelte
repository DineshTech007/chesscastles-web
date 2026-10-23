<script lang="ts">
  /**
   * "Invite a friend, get 3 gems" (owner, 2026-10-23: "by inviting a new user give 3 diamonds, so they add their parents
   * and all, they earn more gems and we get more members"): the player's own link, a copy button and a WhatsApp share.
   * The server pays when a new player joins with the link (server/api-worker src/plans.ts, wallet.ts inviteReward).
   */
  import { session } from '$lib/auth';
  import { inviteLink } from '$lib/plans';
  import { t } from '$lib/i18n';
  import { track } from '$lib/analytics';
  import Gem from './Gem.svelte';
  import { INVITE_MAX, INVITE_REWARD } from './core';

  const link = $derived($session.status === 'in' && $session.username ? inviteLink($session.username) : '');
  let copied = $state(false);
  const text = $derived(`${$t('eco.invite.msg')} ${link}`);
  async function copy() {
    track('feature', 'invite_copy');
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* the field can be selected by hand */
    }
  }
</script>

{#if link}
  <section class="inv" aria-labelledby="inv-h">
    <div class="h"><span class="g"><Gem size={22} /></span><h3 id="inv-h" class="title">{$t('eco.invite.h', { n: INVITE_REWARD.gems })}</h3></div>
    <p>{$t('eco.invite.b', { n: INVITE_REWARD.gems, max: INVITE_MAX })}</p>
    <div class="row">
      <input readonly value={link} aria-label={$t('eco.invite.h', { n: INVITE_REWARD.gems })} onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
      <button class="btn" onclick={copy}>{copied ? $t('eco.invite.copied') : $t('eco.invite.copy')}</button>
    </div>
    <a class="btn primary wa" href="https://wa.me/?text={encodeURIComponent(text)}" target="_blank" rel="noopener" onclick={() => track('feature', 'invite_whatsapp')}>{$t('eco.invite.wa')}</a>
  </section>
{/if}

<style>
  .inv {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    border: 1px dashed color-mix(in srgb, #8fe6f5 60%, var(--border));
    background: color-mix(in srgb, #8fe6f5 8%, transparent);
  }
  .h {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 16px;
  }
  p {
    margin: 0;
    font-size: 13.5px;
    color: var(--text-2);
  }
  .row {
    display: flex;
    gap: 6px;
  }
  input {
    flex: 1;
    min-width: 0;
    height: 40px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }
  .wa {
    align-self: flex-start;
    text-decoration: none;
  }
</style>
