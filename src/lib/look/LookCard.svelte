<script lang="ts">
  /**
   * "Your look" on the profile (owner, 2026-10-22: "no way to change the username or picture… like chess.com, once a
   * month… flair"): a picture everyone sees from the chess mascots (no faces: a child's photo never goes public), a
   * flair from the awards won, and the name, once every 30 days (server/api-worker src/social.ts PUT /look).
   */
  import { onMount } from 'svelte';
  import { t, type Key } from '$lib/i18n';
  import { AWARDS } from '$lib/awards/awards';
  import { getLook, saveLook } from '$lib/social';
  import { AVATARS, avatarSrc } from './avatars';

  let { earned, onchange }: { earned: Set<string>; onchange?: (l: { avatar?: string; flair?: string; name: string }) => void } = $props();

  let avatar = $state<string | undefined>();
  let flair = $state<string | undefined>();
  let name = $state('');
  let saved = $state('');
  let nextNameAt = $state(0);
  let newName = $state('');
  let error = $state('');
  let busy = $state(false);
  let note = $state('');
  onMount(async () => {
    try {
      const l = await getLook();
      avatar = l.avatar;
      flair = l.flair;
      name = newName = l.name;
      nextNameAt = l.nextNameAt;
    } catch (e) {
      error = (e as Error).message;
    }
  });
  const flairs = $derived(AWARDS.filter((a) => earned.has(a.id) && a.icon));
  const nameLocked = $derived(nextNameAt > Date.now());

  async function save(change: { avatar?: string; flair?: string; name?: string }) {
    busy = true;
    error = '';
    note = '';
    try {
      const l = await saveLook(change);
      avatar = l.avatar;
      flair = l.flair;
      if (change.name !== undefined && l.name !== name) nextNameAt = Date.now() + 30 * 86_400_000;
      name = l.name;
      note = $t('look.saved');
      onchange?.({ avatar: l.avatar, flair: l.flair, name: l.name });
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="card look" aria-labelledby="look-h">
  <h2 id="look-h" class="title">{$t('look.h')}</h2>
  <p class="label">{$t('look.sub')}</p>

  <h3>{$t('look.avatarH')}</h3>
  <div class="grid" role="radiogroup" aria-label={$t('look.avatarH')}>
    {#each AVATARS as a (a)}
      <button class="av" class:on={avatar === a} role="radio" aria-checked={avatar === a} disabled={busy} onclick={() => save({ avatar: a })} title={$t(`look.a.${a}` as Key)}>
        <img src={avatarSrc(a)} alt={$t(`look.a.${a}` as Key)} width="72" height="72" loading="lazy" />
      </button>
    {/each}
    <button class="av none" class:on={!avatar} role="radio" aria-checked={!avatar} disabled={busy} onclick={() => save({ avatar: '' })}>{$t('look.none')}</button>
  </div>

  <h3>{$t('look.flairH')}</h3>
  <p class="label">{$t('look.flairSub')}</p>
  {#if flairs.length}
    <div class="flairs" role="radiogroup" aria-label={$t('look.flairH')}>
      <button class="fl" class:on={!flair} role="radio" aria-checked={!flair} disabled={busy} onclick={() => save({ flair: '' })}>{$t('look.noFlair')}</button>
      {#each flairs as a (a.id)}
        <button class="fl" class:on={flair === a.id} role="radio" aria-checked={flair === a.id} disabled={busy} onclick={() => save({ flair: a.id })} title={a.name}>
          <span class="em">{a.icon}</span>
        </button>
      {/each}
    </div>
  {:else}
    <p class="label">{$t('look.flairEmpty')}</p>
  {/if}

  <h3>{$t('look.nameH')}</h3>
  <form class="name" onsubmit={(e) => (e.preventDefault(), save({ name: newName.trim() }))}>
    <input bind:value={newName} maxlength="24" minlength="2" disabled={nameLocked || busy} aria-label={$t('look.nameH')} />
    <button class="btn" disabled={nameLocked || busy || newName.trim() === name || newName.trim().length < 2}>{$t('look.saveName')}</button>
  </form>
  <p class="label small">{nameLocked ? $t('look.nameNext', { date: new Date(nextNameAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }) : $t('look.nameRule')}</p>

  {#if error}<p class="err" role="alert">{error}</p>{:else if note}<p class="ok" role="status">{note}</p>{/if}
</section>

<style>
  .look {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h3 {
    margin: 10px 0 2px;
    font: 800 15px var(--font-title);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: 8px;
  }
  .av {
    aspect-ratio: 1;
    padding: 0;
    border-radius: 50%;
    border: 3px solid transparent;
    background: #14213d;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.12s;
  }
  .av img {
    width: 100%;
    height: 100%;
    display: block;
  }
  .av:hover {
    transform: scale(1.06);
  }
  .av.on {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 30%, transparent);
  }
  .av.none {
    background: var(--raised);
    color: var(--muted);
    font: 700 12px var(--font-body);
  }
  .flairs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .fl {
    min-width: 44px;
    height: 44px;
    padding: 0 10px;
    border-radius: 12px;
    border: 2px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: 700 13px var(--font-body);
    cursor: pointer;
  }
  .fl .em {
    font-size: 22px;
  }
  .fl.on {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 18%, var(--raised));
  }
  .name {
    display: flex;
    gap: 8px;
  }
  .name input {
    flex: 1;
    min-width: 0;
  }
  .small {
    font-size: 12.5px;
  }
  .err {
    color: var(--loss);
    font-weight: 700;
    margin: 0;
  }
  .ok {
    color: var(--win);
    font-weight: 700;
    margin: 0;
  }
</style>
