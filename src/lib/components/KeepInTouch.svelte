<script lang="ts">
  /**
   * Settings' "Keep in touch": where Guru's WhatsApp reports go (the player's number or a parent's), with Stop, or
   * the way to give a number; and where study-reminder notifications are turned on or off (the study plan, on Learn).
   */
  import { onMount } from 'svelte';
  import { myWhatsapp, stopWhatsapp, type MyWhatsapp } from '$lib/social';
  import { askKeepInTouch } from './WelcomeSheet.svelte';

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
  <p class="label">Study-time and streak reminders on this phone: <a href="/learn#plan-h">turn them on or off in your study plan on Learn</a>.</p>
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
