<script lang="ts">
  /**
   * Settings' "Keep in touch": where Guru's WhatsApp reports go (the player's number or a parent's), with Stop, or
   * the way to give a number; and where study-reminder notifications are turned on or off (the study plan, on Learn).
   */
  import { onMount } from 'svelte';
  import { myWhatsapp, stopWhatsapp, type MyWhatsapp } from '$lib/social';
  import { askKeepInTouch } from './WelcomeSheet.svelte';
  import { remindersOn, reminderSupport, turnOnReminders } from '$lib/study/reminders';

  const canPush = reminderSupport() === 'push';
  let push = $state<'off' | 'on' | 'denied' | 'busy'>(canPush && remindersOn() ? 'on' : 'off');
  async function pushOn() {
    push = 'busy';
    const r = await turnOnReminders();
    push = r === 'on' ? 'on' : r === 'denied' ? 'denied' : 'off';
  }

  let wa = $state<MyWhatsapp | undefined>();
  let busy = $state(false);
  let note = $state('');
  onMount(() => {
    void myWhatsapp().then((w) => (wa = w), () => (wa = {}));
  });

  async function stop() {
    if (!confirm('Stop WhatsApp messages from Chess Castles? Your number is removed.')) return;
    busy = true;
    try {
      await stopWhatsapp();
      wa = {};
      note = 'Stopped. Your number was removed.';
    } catch {
      note = 'Could not stop. Try again.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="card block" aria-labelledby="touch-h">
  <h2 id="touch-h" class="title">Keep in touch</h2>
  {#if wa?.phone}
    <p>Guru's game reports go on WhatsApp to <strong class="num">{wa.phone}</strong> ({wa.whose === 'parent' ? "a parent's number" : 'your number'}).</p>
    <button class="btn" disabled={busy} onclick={stop}>Stop WhatsApp messages</button>
  {:else if wa}
    <p class="label">Get Guru's game reports on WhatsApp: where you lose the most points, with a link to the right study plan.</p>
    <button class="btn" onclick={() => askKeepInTouch.set(true)}>Get reports on WhatsApp</button>
  {/if}
  {#if note}<p class="label" role="status">{note}</p>{/if}
  {#if canPush}
    {#if push === 'on'}
      <p>Notifications on this phone are on: study and streak reminders with Guru's focus for you, and Guru's weekly check of your new games. <a href="/learn#plan-h">Times and days on Learn</a>.</p>
    {:else}
      <p class="label">Free notifications on this phone: study and streak reminders with Guru's focus for you, and Guru's weekly check of your new games.</p>
      <button class="btn primary" disabled={push === 'busy'} onclick={pushOn}>Turn on notifications</button>
      {#if push === 'denied'}<p class="label">Notifications are blocked in this browser: allow them in its site settings (the lock next to the address), then try again.</p>{/if}
    {/if}
  {:else}
    <p class="label">Notifications need Chess Castles installed as an app on this phone (iPhone) or Chrome on Android.</p>
  {/if}
</section>

<style>
  p {
    margin: 0;
  }
  section {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
</style>
