<script lang="ts">
  /**
   * "How to use" in the top bar: a 15–20 second video of the feature of the
   * page you are on, in your content language (English, Hindi or Marathi), with
   * the other two languages one tap away. See src/lib/featureVideos.ts.
   */
  import { page } from '$app/state';
  import { contentLang } from '$lib/contentLang';
  import type { Lang } from '$lib/coach/i18n';
  import { featureVideoFor, videoPoster, videoSrc } from '$lib/featureVideos';
  import { track } from '$lib/analytics';
  import Icon from './Icon.svelte';

  const feature = $derived(featureVideoFor(page.url.pathname + page.url.search));
  let open = $state(false);
  let lang = $state<Lang>('en');
  const LABEL: Record<Lang, string> = { en: 'How to use', hi: 'कैसे इस्तेमाल करें', mr: 'कसे वापरायचे' };
  const LANGS: { id: Lang; name: string }[] = [
    { id: 'en', name: 'English' },
    { id: 'hi', name: 'हिन्दी' },
    { id: 'mr', name: 'मराठी' },
  ];
  function show() {
    lang = $contentLang;
    open = true;
    track('feature', `video_${feature?.id ?? ''}_${lang}`);
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if feature}
  <button class="how" onclick={show} title="{LABEL[$contentLang]} · 20 s" aria-label="{LABEL[$contentLang]}: {feature.name[$contentLang]}">
    <Icon name="play" size={16} />
    <span class="how-text">{LABEL[$contentLang]}</span>
  </button>
{/if}

{#if open && feature}
  <div class="scrim" role="presentation" onclick={() => (open = false)}></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="fv-h">
    <div class="top">
      <h2 id="fv-h" class="title">{feature.name[lang]}</h2>
      <div class="segmented langs" role="group" aria-label="Language">
        {#each LANGS as l (l.id)}<button aria-pressed={lang === l.id} onclick={() => (lang = l.id)}>{l.name}</button>{/each}
      </div>
      <button class="x" onclick={() => (open = false)} aria-label="Close"><Icon name="close" size={18} /></button>
    </div>
    {#key `${feature.id}-${lang}`}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video src={videoSrc(feature.id, lang)} poster={videoPoster(feature.id)} controls autoplay playsinline preload="metadata"></video>
    {/key}
    <p class="label">{lang === 'hi' ? '15–20 seconds: यह क्या है और कैसे इस्तेमाल करें।' : lang === 'mr' ? '15–20 seconds: हे काय आहे आणि कसे वापरायचे.' : '15–20 seconds: what it is and how to use it.'}</p>
  </div>
{/if}

<style>
  .how {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .how:hover {
    background: color-mix(in srgb, var(--accent) 24%, transparent);
  }
  @media (max-width: 599px) {
    .how-text {
      display: none;
    }
    .how {
      width: 40px;
      padding: 0;
      justify-content: center;
    }
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 10, 20, 0.7);
    z-index: 95;
  }
  .dialog {
    position: fixed;
    z-index: 96;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(900px, calc(100vw - 24px));
    padding: 14px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .top h2 {
    margin: 0;
    font-size: 18px;
    flex: 1;
    min-width: 0;
  }
  .langs {
    min-width: 220px;
  }
  .x {
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  video {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    background: #000;
  }
  p {
    margin: 0;
    text-align: center;
  }
</style>
