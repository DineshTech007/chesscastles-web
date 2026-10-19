<script lang="ts">
  /**
   * Like, dislike and heart for a blog post. Your own choice is kept in this browser; each tap is also counted
   * anonymously (the admin page shows which stories people like). Like and dislike exclude each other; the heart
   * is separate.
   */
  import { track } from '$lib/analytics';
  import type { Lang } from '$lib/coach/i18n';

  let { slug, lang = 'en' }: { slug: string; lang?: Lang } = $props();
  const T = {
    en: { ask: 'Did you enjoy this story?', like: 'Like', dislike: 'Dislike', heart: 'Love it', thanks: 'Thank you for telling us!' },
    hi: { ask: 'क्या आपको यह कहानी पसंद आई?', like: 'पसंद', dislike: 'नापसंद', heart: 'बहुत पसंद', thanks: 'बताने के लिए धन्यवाद!' },
    mr: { ask: 'तुम्हाला ही गोष्ट आवडली का?', like: 'आवडली', dislike: 'आवडली नाही', heart: 'खूप आवडली', thanks: 'सांगितल्याबद्दल धन्यवाद!' },
  } as const;
  const t = $derived(T[lang]);
  const KEY = (s: string) => `cc.react.${s}`;
  interface Mine {
    vote?: 'like' | 'dislike';
    heart?: boolean;
  }
  let mine = $state<Mine>({});
  $effect(() => {
    const s = slug;
    try {
      mine = JSON.parse(localStorage.getItem(KEY(s)) ?? '{}');
    } catch {
      mine = {};
    }
  });
  const save = () => {
    try {
      localStorage.setItem(KEY(slug), JSON.stringify(mine));
    } catch {
      /* kept for this visit only */
    }
  };
  function vote(v: 'like' | 'dislike') {
    mine = { ...mine, vote: mine.vote === v ? undefined : v };
    if (mine.vote) track('feature', `blog_${v}_${slug.slice(0, 40)}`);
    save();
  }
  function heart() {
    mine = { ...mine, heart: !mine.heart };
    if (mine.heart) track('feature', `blog_heart_${slug.slice(0, 40)}`);
    save();
  }
</script>

<section class="card rx" aria-label={t.ask}>
  <strong>{t.ask}</strong>
  <div class="btns">
    <button class="r" aria-pressed={mine.vote === 'like'} onclick={() => vote('like')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8c1.6 0 2.6 1.1 2.3 2.7L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7" /></svg>{t.like}
    </button>
    <button class="r" aria-pressed={mine.vote === 'dislike'} onclick={() => vote('dislike')}>
      <svg viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(180deg)"><path d="M7 11v9H4v-9zM7 11l4-8c1.6 0 2.6 1.1 2.3 2.7L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7" /></svg>{t.dislike}
    </button>
    <button class="r heart" aria-pressed={!!mine.heart} onclick={heart}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>{t.heart}
    </button>
  </div>
  {#if mine.vote || mine.heart}<span class="label">{t.thanks}</span>{/if}
</section>

<style>
  .rx {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .r {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    min-height: 44px;
  }
  .r svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .r[aria-pressed='true'] {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 20%, var(--raised));
    color: var(--gold);
  }
  .r[aria-pressed='true'] svg {
    fill: currentColor;
    fill-opacity: 0.25;
  }
  .heart[aria-pressed='true'] {
    border-color: #ef4d6a;
    background: color-mix(in srgb, #ef4d6a 18%, var(--raised));
    color: #ef4d6a;
  }
  .heart[aria-pressed='true'] svg {
    fill: currentColor;
    fill-opacity: 1;
  }
  .label {
    margin: 0;
  }
</style>
