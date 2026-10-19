<script lang="ts">
  /**
   * Chess Guide: answers for parents and beginners (FIDE rating, how it is calculated, tie-breaks,
   * tournaments), in English, Hindi and Marathi. Ask the guide in your own words, or open a question.
   */
  import { tick } from 'svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import { contentLang } from '$lib/contentLang';
  import { findGuide, GUIDE, TOPIC_NAME, type GuideItem, type Topic } from '$lib/guide/guide';
  import { track } from '$lib/analytics';

  const UI = {
    en: { title: 'Chess Guide', sub: 'Simple answers for parents and beginners: FIDE ratings, tie-breaks, tournaments and more.', ask: 'Ask the Chess Guide', ph: 'Type a question, e.g. how is FIDE rating calculated?', send: 'Ask', hello: 'Hi! I am the Chess Guide. Ask me about FIDE ratings, tournaments or the rules, or open a question below.', none: 'I do not have an answer to that yet. Try other words, or open one of the questions below. For help with the website, use Help & support.', related: 'Related:', all: 'All questions', help: 'Help & support', you: 'You' },
    hi: { title: 'Chess Guide', sub: 'Parents और beginners के लिए आसान जवाब: FIDE rating, tie-break, tournaments और बहुत कुछ।', ask: 'Chess Guide से पूछिए', ph: 'अपना सवाल लिखिए, जैसे FIDE rating कैसे calculate होती है?', send: 'पूछें', hello: 'नमस्ते! मैं Chess Guide हूँ। FIDE rating, tournaments या rules के बारे में पूछिए, या नीचे कोई सवाल खोलिए।', none: 'इसका जवाब मेरे पास अभी नहीं है। दूसरे शब्द आज़माइए, या नीचे का कोई सवाल खोलिए। Website में मदद के लिए Help & support देखिए।', related: 'इससे जुड़े:', all: 'सारे सवाल', help: 'Help & support', you: 'आप' },
    mr: { title: 'Chess Guide', sub: 'पालक आणि beginners साठी सोपी उत्तरं: FIDE rating, tie-break, tournaments आणि बरंच काही.', ask: 'Chess Guide ला विचारा', ph: 'तुमचा प्रश्न लिहा, उदा. FIDE rating कशी calculate होते?', send: 'विचारा', hello: 'नमस्कार! मी Chess Guide आहे. FIDE rating, tournaments किंवा rules बद्दल विचारा, किंवा खाली एखादा प्रश्न उघडा.', none: 'याचं उत्तर माझ्याकडे अजून नाही. वेगळे शब्द वापरून बघा, किंवा खालचा एखादा प्रश्न उघडा. Website बद्दल मदतीसाठी Help & support बघा.', related: 'संबंधित:', all: 'सगळे प्रश्न', help: 'Help & support', you: 'तुम्ही' },
  } as const;
  const t = $derived(UI[$contentLang]);

  /** A bot message keeps the answer itself, not its words, so it is shown in the language chosen now. */
  type Msg = { from: 'me'; text: string } | { from: 'bot'; item?: GuideItem; more?: GuideItem[]; none?: boolean };
  let msgs = $state<Msg[]>([]);
  let q = $state('');
  let box: HTMLDivElement | undefined = $state();
  let openId = $state('');
  let topic = $state<Topic | 'all'>('all');
  const topics = Object.keys(TOPIC_NAME) as Topic[];
  const shown = $derived(GUIDE.filter((g) => topic === 'all' || g.topic === topic));
  const POPULAR = ['calc', 'tiebreak', 'first-rating', 'first-tournament'].map((id) => GUIDE.find((g) => g.id === id)!);

  async function ask(text: string) {
    const s = text.trim();
    if (!s) return;
    q = '';
    track('feature', 'guide_ask');
    const found = findGuide(s);
    msgs = [
      ...msgs,
      { from: 'me', text: s },
      found.length ? { from: 'bot', item: found[0], more: found.slice(1) } : { from: 'bot', none: true },
    ];
    await tick();
    box?.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }
  function toggle(id: string) {
    openId = openId === id ? '' : id;
    if (openId) track('feature', `guide_${id}`);
  }
</script>

<svelte:head><title>Chess Guide · Chess Castles</title></svelte:head>

<div class="page" lang={$contentLang}>
  <header class="head">
    <div>
      <h1 class="display">{t.title}</h1>
      <p class="label">{t.sub}</p>
    </div>
    <LangSwitch />
  </header>

  <section class="card chat" aria-label={t.ask}>
    <div class="msgs" bind:this={box} aria-live="polite">
      <div class="msg bot">
        <span class="av"><GuruAvatar size={34} /></span>
        <div class="bubble"><p>{t.hello}</p></div>
      </div>
      {#each msgs as m, i (i)}
        <div class="msg {m.from}">
          {#if m.from === 'bot'}<span class="av"><GuruAvatar size={34} /></span>{/if}
          <div class="bubble">
            {#if m.from === 'me'}
              <p>{m.text}</p>
            {:else if m.item}
              <strong class="qh">{m.item.q[$contentLang]}</strong>
              {#each m.item.a[$contentLang] as para, k (k)}<p>{para}</p>{/each}
            {:else}
              <p>{t.none}</p>
            {/if}
            {#if m.from === 'bot' && m.item?.link}<a class="btn small" href={m.item.link.href}>{m.item.link.label[$contentLang]} →</a>{/if}
            {#if m.from === 'bot' && m.more?.length}
              <div class="more"><span class="label">{t.related}</span>{#each m.more as k (k.id)}<button class="chip" onclick={() => ask(k.q[$contentLang])}>{k.q[$contentLang]}</button>{/each}</div>
            {/if}
            {#if m.from === 'bot' && m.none}<a class="btn small" href="/help">{t.help} →</a>{/if}
          </div>
        </div>
      {/each}
    </div>
    <div class="pop">
      {#each POPULAR as k (k.id)}<button class="chip" onclick={() => ask(k.q[$contentLang])}>{k.q[$contentLang]}</button>{/each}
    </div>
    <form class="compose" onsubmit={(e) => (e.preventDefault(), ask(q))}>
      <input bind:value={q} placeholder={t.ph} aria-label={t.ask} autocomplete="off" />
      <button class="btn primary" type="submit" disabled={!q.trim()}>{t.send}</button>
    </form>
  </section>

  <section aria-labelledby="all-h">
    <div class="list-head">
      <h2 id="all-h" class="title">{t.all}</h2>
      <div class="chips" role="group" aria-label="Topic">
        <button class="chip" aria-pressed={topic === 'all'} onclick={() => (topic = 'all')}>{t.all}</button>
        {#each topics as k (k)}<button class="chip" aria-pressed={topic === k} onclick={() => (topic = k)}>{TOPIC_NAME[k][$contentLang]}</button>{/each}
      </div>
    </div>
    <ul class="qs">
      {#each shown as g (g.id)}
        <li class="card">
          <button class="qb" aria-expanded={openId === g.id} onclick={() => toggle(g.id)}>
            <span>{g.q[$contentLang]}</span>
            <span class="plus" aria-hidden="true">{openId === g.id ? '−' : '+'}</span>
          </button>
          {#if openId === g.id}
            <div class="ans">
              {#each g.a[$contentLang] as para, k (k)}<p>{para}</p>{/each}
              {#if g.link}<a class="btn small" href={g.link.href}>{g.link.label[$contentLang]} →</a>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
  <p class="label foot">Rules follow the FIDE Handbook as of October 2026; every tournament’s own regulations decide its details. Chess Castles is not affiliated with FIDE.</p>
</div>

<style>
  .page {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 40px;
  }
  .head p {
    margin: 4px 0 0;
  }
  .chat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }
  .msgs {
    max-height: 420px;
    min-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .msg {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .msg.me {
    justify-content: flex-end;
  }
  .av {
    flex: none;
  }
  .bubble {
    max-width: 88%;
    padding: 10px 14px;
    border-radius: 16px;
    background: var(--raised);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
    line-height: 1.55;
  }
  .me .bubble {
    background: var(--action);
    color: var(--on-action);
  }
  .bubble p {
    margin: 0;
  }
  .qh {
    color: var(--gold);
  }
  .more,
  .pop,
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .compose {
    display: flex;
    gap: 8px;
  }
  .compose input {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
    font: inherit;
  }
  .list-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .list-head h2 {
    margin: 0;
    font-size: 21px;
  }
  .qs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .qs li {
    padding: 0;
  }
  .qb {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-weight: 700;
    font-size: 16.5px;
    text-align: left;
    cursor: pointer;
  }
  .plus {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--raised);
    color: var(--accent);
    font-size: 20px;
  }
  .ans {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    line-height: 1.65;
  }
  .ans p {
    margin: 0;
  }
  .foot {
    margin: 0;
  }
</style>
