<script lang="ts" module>
  import { writable } from 'svelte/store';
  /** Settings' "Get reports on WhatsApp": opens the keep-in-touch step now. */
  export const askKeepInTouch = writable(false);
</script>

<script lang="ts">
  /**
   * Once after signing in (new players and those who joined before, on their next visit): the language for the whole
   * site (if not chosen yet; the language button at the top changes it any time), then how to keep in touch, both
   * offered: notifications on this phone (study-time and streak reminders, no number needed: first for players under
   * 18) and Guru's game insights on WhatsApp (their own number, or a parent's with consent: only a parent's under 18).
   * "Not now" asks again in a week. Never during a game, over the consent form or the install popup.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { session } from '$lib/auth';
  import { consentNeeded, readConsent } from '$lib/consent';
  import { contentLang, setContentLang } from '$lib/contentLang';
  import { t } from '$lib/i18n';
  import { installOpen } from '$lib/install';
  import { myWhatsapp, normalizePhone, saveWhatsapp } from '$lib/social';
  import { loadPlan, savePlan } from '$lib/study/plan';
  import { streak, study } from '$lib/study/progress';
  import { reminderSupport, setReminders } from '$lib/study/reminders';

  const BUSY = /^\/(play|watch|analysis|puzzles)\/./;
  const WEEK = 7 * 86_400_000;
  type Step = 'lang' | 'stay' | 'done';
  let step = $state<Step | undefined>();
  let ready = $state(false);
  onMount(() => setTimeout(() => (ready = true), 2500));

  const askedKey = (uid: string) => `cc.waAsked.${uid}`;
  const chosenLang = () => {
    try {
      return localStorage.getItem('cc.lang') !== null;
    } catch {
      return true;
    }
  };
  const waDue = (uid: string) => {
    try {
      const v = localStorage.getItem(askedKey(uid));
      return !v || (v !== 'done' && Date.now() > Number(v));
    } catch {
      return false;
    }
  };
  const remember = (uid: string, v: string) => {
    try {
      localStorage.setItem(askedKey(uid), v);
    } catch {
      /* asked again next visit */
    }
  };

  // Decide once per sign-in what to ask.
  let decidedFor = '';
  $effect(() => {
    const s = $session;
    if (!ready || s.status !== 'in' || decidedFor === s.uid || $consentNeeded) return;
    decidedFor = s.uid;
    const needLang = !chosenLang();
    if (!waDue(s.uid)) return void (step = needLang ? 'lang' : undefined);
    // A number already given (on another device): nothing to ask.
    myWhatsapp().then(
      (w) => {
        if (w.phone) remember(s.uid, 'done');
        step = needLang ? 'lang' : w.phone ? undefined : 'stay';
      },
      () => (step = needLang ? 'lang' : undefined),
    );
  });

  // Asked from Settings: the keep-in-touch step at once.
  $effect(() => {
    if ($askKeepInTouch && $session.status === 'in') {
      askKeepInTouch.set(false);
      saved = false;
      step = 'stay';
    }
  });

  const open = $derived(!!step && step !== 'done' && !$installOpen && !$consentNeeded && !BUSY.test(page.url.pathname));

  const minor = readConsent()?.age === 'minor';
  let whose = $state<'self' | 'parent'>(minor ? 'parent' : 'self');
  let phone = $state('');
  let agreed = $state(false);
  let busy = $state(false);
  let error = $state('');

  function pickLang(l: 'en' | 'hi' | 'mr') {
    setContentLang(l);
    const uid = $session.status === 'in' ? $session.uid : '';
    step = uid && waDue(uid) ? 'stay' : 'done';
  }
  async function save(e: Event) {
    e.preventDefault();
    error = '';
    const n = normalizePhone(phone);
    if (!n) return void (error = $t('welcome.wa.bad'));
    busy = true;
    try {
      await saveWhatsapp(n, minor ? 'parent' : whose);
      if ($session.status === 'in') remember($session.uid, 'done');
      saved = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save. Try again.';
    } finally {
      busy = false;
    }
  }
  let saved = $state(false);

  // Notifications: the study reminders (src/lib/study/reminders.ts), turned on with the study plan's times.
  const canPush = reminderSupport() === 'push';
  let push = $state<'off' | 'on' | 'denied' | 'busy'>(canPush && loadPlan().remind && typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'on' : 'off');
  async function pushOn() {
    push = 'busy';
    const plan = { ...loadPlan(), remind: true };
    const r = await setReminders(plan, streak($study, Date.now()), $study).catch(() => 'unsupported' as const);
    if (r === 'on') savePlan(plan);
    push = r === 'on' ? 'on' : r === 'denied' ? 'denied' : 'off';
  }
  /** Something was turned on: the sheet closes with "Done" and is not asked again. */
  const anyOn = $derived(push === 'on' || saved);
  function finish() {
    if ($session.status === 'in') remember($session.uid, anyOn ? 'done' : String(Date.now() + WEEK));
    step = 'done';
  }
  const LANGS = [
    ['mr', 'मराठी'],
    ['hi', 'हिंदी'],
    ['en', 'English'],
  ] as const;
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (step === 'stay' ? finish() : pickLang($contentLang))} />

{#if open}
  <div class="scrim" role="presentation"></div>
  <div class="sheet card" role="dialog" aria-modal="true" aria-labelledby="welcome-h">
    {#if step === 'lang'}
      <h2 id="welcome-h" class="title">{$t('welcome.lang.h')}</h2>
      <div class="langs">
        {#each LANGS as [id, name] (id)}
          <button class="btn lang" class:primary={$contentLang === id} lang={id} onclick={() => pickLang(id)}>{name}</button>
        {/each}
      </div>
      <p class="label">{$t('welcome.lang.note')}</p>
    {:else if step === 'stay'}
      <h2 id="welcome-h" class="title">{$t('welcome.stay.h')}</h2>
      {#snippet pushBox()}
        {#if canPush}
          <section class="way" class:first={minor}>
            <h3><span aria-hidden="true">🔔</span> {$t('welcome.push.h')}</h3>
            <p class="label">{$t('welcome.push.p')}</p>
            {#if push === 'on'}
              <p class="ok" role="status">✓ {$t('welcome.push.done')}</p>
            {:else}
              <button class="btn" class:primary={minor} disabled={push === 'busy'} onclick={pushOn}>{$t('welcome.push.on')}</button>
              {#if push === 'denied'}<p class="err">{$t('welcome.push.denied')}</p>{/if}
            {/if}
          </section>
        {/if}
      {/snippet}
      {#if minor}{@render pushBox()}{/if}
      <section class="way" class:first={!minor}>
        <h3><span aria-hidden="true">💬</span> {minor && canPush ? $t('welcome.wa.or.parent') : $t('welcome.wa.h')}</h3>
        <p class="label">{$t('welcome.wa.p')}</p>
        {#if saved}
          <p class="ok" role="status">✓ {$t('welcome.wa.done')}</p>
        {:else}
          <form onsubmit={save}>
            {#if minor}
              <p class="note">{$t('welcome.wa.minor')}</p>
            {:else}
              <div class="whose" role="radiogroup" aria-label={$t('welcome.wa.number')}>
                <label><input type="radio" bind:group={whose} value="self" /> {$t('welcome.wa.mine')}</label>
                <label><input type="radio" bind:group={whose} value="parent" /> {$t('welcome.wa.parent')}</label>
              </div>
            {/if}
            <label class="num-field">
              <span>{$t('welcome.wa.number')}</span>
              <span class="phone"><span class="cc">+91</span><input bind:value={phone} type="tel" inputmode="tel" autocomplete="tel-national" placeholder="98765 43210" required /></span>
            </label>
            <label class="consent"><input type="checkbox" bind:checked={agreed} required /> <span>{minor || whose === 'parent' ? $t('welcome.wa.consent.parent') : $t('welcome.wa.consent.self')}</span></label>
            {#if error}<p class="err" role="alert">{error}</p>{/if}
            <button class="btn" class:primary={!minor} disabled={busy || !agreed || !phone.trim()}>{$t('welcome.wa.save')}</button>
            <p class="label small">{$t('welcome.wa.privacy')} <a href="/legal/privacy">{$t('more.privacy')}</a></p>
          </form>
        {/if}
      </section>
      {#if !minor}{@render pushBox()}{/if}
      <div class="actions">
        <button class="btn" class:primary={anyOn} onclick={finish}>{anyOn ? $t('welcome.finish') : $t('welcome.wa.later')}</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    z-index: 90;
  }
  .sheet {
    position: fixed;
    z-index: 91;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(460px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  p {
    margin: 0;
  }
  .langs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .lang {
    height: 52px;
    font-size: 18px;
    font-weight: 800;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .whose {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
  }
  .whose label,
  .consent {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 14px;
  }
  .num-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-weight: 700;
    font-size: 14px;
  }
  .phone {
    display: flex;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg);
  }
  .cc {
    display: grid;
    place-items: center;
    padding: 0 10px;
    background: var(--raised);
    color: var(--text-2);
    font-weight: 700;
  }
  .phone input {
    flex: 1;
    min-width: 0;
    height: 44px;
    border: 0;
    background: transparent;
    color: var(--text);
    padding: 0 10px;
    font: inherit;
    font-size: 17px;
    letter-spacing: 0.04em;
  }
  .note {
    padding: 8px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    font-size: 14px;
  }
  .err {
    color: var(--loss);
    font-size: 14px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .small {
    font-size: 12.5px;
  }
  .way {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .way.first {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }
  .way h3 {
    margin: 0;
    font-size: 16px;
  }
  .way > .btn {
    align-self: flex-start;
  }
  .ok {
    color: var(--win);
    font-weight: 700;
  }
</style>
