<script lang="ts">
  /**
   * Reads one book: a chapter at a time, in a comfortable size and colour,
   * remembering where the reader got to. "Listen" reads the chapter aloud
   * with the device's voice (chess moves in words) and follows along on the
   * page; books with a LibriVox recording also have a human-read audiobook.
   */
  import { track } from '$lib/analytics';
  import { mount, onDestroy, onMount, tick, unmount } from 'svelte';
  import Board from '$lib/components/Board.svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import { chunks, loadBook, progressOf, saveProgress, speakable, type Book } from '$lib/books/books';
  import { POINTS, study } from '$lib/study/progress';

  const slug = page.params.slug!;
  let book = $state<Book | undefined>();
  let error = $state('');
  let chapter = $state(0);
  let read = $state<number[]>([]);
  let article: HTMLElement | undefined = $state();

  // ---------- reader settings (this browser) ----------
  type Theme = 'paper' | 'sepia' | 'night';
  let size = $state(19);
  let theme = $state<Theme>('paper');
  let showNote = $state(true);
  const SETTINGS = 'k24.reader';
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS, JSON.stringify({ size, theme, rate, voiceName, noteSeen: !showNote }));
    } catch {
      /* private mode */
    }
  }

  onMount(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS) ?? '{}');
      if (s.size) size = s.size;
      if (s.theme) theme = s.theme;
      if (s.rate) rate = s.rate;
      if (s.voiceName) voiceName = s.voiceName;
      if (s.noteSeen) showNote = false;
    } catch {
      /* defaults */
    }
    const p = progressOf(slug);
    chapter = p.chapter;
    read = p.read;
    part = p.audioPart ?? 0;
    loadBook(slug).then(
      async (b) => {
        book = b;
        if (chapter >= b.chapters.length) chapter = 0;
        await tick();
        // Back to where the reader was.
        if (p.scroll > 0.02 && article) window.scrollTo({ top: article.offsetTop + p.scroll * article.offsetHeight - 80 });
        if (page.url.searchParams.has('listen')) {
          if (b.audio.length) {
            panel = 'audio';
          } else startSpeaking(0);
        }
      },
      (e) => (error = e.message),
    );
    loadVoices();
    speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
  });

  // ---------- diagrams: positions in the text, drawn on a real board ----------
  let boards: ReturnType<typeof mount>[] = [];
  $effect(() => {
    void chapter;
    if (!book || !article) return;
    const el = article;
    void tick().then(() => {
      for (const fig of el.querySelectorAll<HTMLElement>('figure.k24-diagram:not([data-on])')) {
        fig.dataset.on = '1';
        const target = document.createElement('div');
        target.className = 'dia-board';
        fig.prepend(target);
        boards.push(mount(Board, { target, props: { fen: fig.dataset.fen ?? '8/8/8/8/8/8/8/8', viewOnly: true, label: 'Diagram from the book' } }));
      }
    });
    return () => {
      for (const b of boards) void unmount(b);
      boards = [];
    };
  });

  // ---------- chapters and progress ----------
  async function goChapter(i: number, keepSpeaking = false) {
    if (!book || i < 0 || i >= book.chapters.length) return;
    if (!keepSpeaking) stopSpeaking();
    chapter = i;
    chapterAt = Date.now();
    clearTimeout(finishTimer);
    track('feature', 'book_chapter');
    saveProgress(slug, { chapter: i, scroll: 0 });
    await tick();
    if (article) window.scrollTo({ top: article.offsetTop - 70, behavior: keepSpeaking ? 'smooth' : 'auto' });
  }

  /** When this chapter was opened: reaching the bottom pays only after about the time reading it takes (owner, 2026-10-23: no paying for skimming). */
  let chapterAt = Date.now();
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(finishTimer));
  function finishChapter() {
    if (!book || read.includes(chapter)) return;
    const words = (article?.innerText ?? '').split(/\s+/).filter(Boolean).length;
    const need = Math.min(120, Math.max(20, words / 5)) * 1000;
    const left = need - (Date.now() - chapterAt);
    if (left > 0) {
      clearTimeout(finishTimer);
      finishTimer = setTimeout(finishChapter, left + 200);
      return;
    }
    read = [...read, chapter];
    saveProgress(slug, { read });
    study.log('lesson', POINTS.lessonFinished, `Read: ${book.title}, ${book.chapters[chapter].title}`);
  }

  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  function onScroll() {
    if (!article || !book) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!article) return;
      const r = article.getBoundingClientRect();
      const done = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      saveProgress(slug, { chapter, scroll: done });
      if (r.bottom < innerHeight + 40) finishChapter();
    }, 400);
  }

  const bookPct = $derived(book ? Math.round((read.length / book.chapters.length) * 100) : 0);

  // ---------- reading aloud with the device's voice ----------
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  let voices = $state<SpeechSynthesisVoice[]>([]);
  let voiceName = $state('');
  let rate = $state(1);
  let speaking = $state<'off' | 'on' | 'paused'>('off');
  let para = $state(-1);
  /** Bumped on every stop, so a finished sentence from an old run does not carry on. */
  let run = 0;

  function loadVoices() {
    if (!canSpeak) return;
    const all = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    // Indian English first, then the rest.
    voices = [...all.filter((v) => v.lang === 'en-IN'), ...all.filter((v) => v.lang !== 'en-IN')];
  }

  /** The parts of the chapter that are read one after another. */
  function blocks(): HTMLElement[] {
    if (!article) return [];
    const all = [...article.querySelectorAll<HTMLElement>('h2, h3, h4, p, li, tr, blockquote')];
    const set = new Set(all);
    return all.filter((el) => {
      for (let a = el.parentElement; a && a !== article; a = a.parentElement) if (set.has(a)) return false;
      return (el.textContent ?? '').trim().length > 0;
    });
  }

  function mark(i: number) {
    article?.querySelectorAll('.speaking').forEach((e) => e.classList.remove('speaking'));
    const el = blocks()[i];
    if (!el) return;
    el.classList.add('speaking');
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 110) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function startSpeaking(from: number) {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const me = ++run;
    speaking = 'on';
    const say = (i: number) => {
      if (me !== run) return;
      const list = blocks();
      if (i >= list.length) {
        finishChapter();
        // On to the next chapter, and keep reading.
        if (book && chapter < book.chapters.length - 1) void goChapter(chapter + 1, true).then(() => say(0));
        else stopSpeaking();
        return;
      }
      para = i;
      mark(i);
      const parts = chunks(speakable(list[i].innerText || list[i].textContent || ''));
      const voice = voices.find((v) => v.name === voiceName);
      let k = 0;
      const next = () => {
        if (me !== run) return;
        if (k >= parts.length) return say(i + 1);
        const u = new SpeechSynthesisUtterance(parts[k++]);
        u.rate = rate;
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        } else u.lang = 'en-IN';
        u.onend = next;
        u.onerror = (e) => {
          if (e.error !== 'interrupted' && e.error !== 'canceled') next();
        };
        speechSynthesis.speak(u);
      };
      next();
    };
    say(Math.max(0, from));
  }

  function stopSpeaking() {
    run++;
    if (canSpeak) speechSynthesis.cancel();
    speaking = 'off';
    para = -1;
    article?.querySelectorAll('.speaking').forEach((e) => e.classList.remove('speaking'));
  }

  function pauseResume() {
    if (speaking === 'on') {
      speechSynthesis.pause();
      speaking = 'paused';
    } else if (speaking === 'paused') {
      speechSynthesis.resume();
      speaking = 'on';
    } else startSpeaking(firstVisible());
  }

  /** The first paragraph on screen, to start reading from where the reader is. */
  function firstVisible(): number {
    const i = blocks().findIndex((el) => el.getBoundingClientRect().bottom > 90);
    return i < 0 ? 0 : i;
  }

  /** While listening, a tap on a paragraph reads from there. */
  function onArticleClick(e: MouseEvent) {
    if (speaking === 'off') return;
    if ((e.target as HTMLElement).closest('a')) return;
    const list = blocks();
    const i = list.findIndex((el) => el.contains(e.target as Node));
    if (i >= 0) startSpeaking(i);
  }

  function changeRate(r: number) {
    rate = r;
    saveSettings();
    if (speaking === 'on') startSpeaking(para);
  }
  function changeVoice(name: string) {
    voiceName = name;
    saveSettings();
    if (speaking === 'on') startSpeaking(para);
  }

  // ---------- the human-read audiobook (LibriVox) ----------
  let panel = $state<'none' | 'audio'>('none');
  let part = $state(0);
  let player: HTMLAudioElement | undefined = $state();
  let resumeAt = progressOf(slug).audioTime ?? 0;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function playPart(i: number) {
    stopSpeaking();
    part = i;
    resumeAt = 0;
    saveProgress(slug, { audioPart: i, audioTime: 0 });
    void tick().then(() => player?.play());
  }
  function onAudioLoaded() {
    if (player && resumeAt > 0) {
      player.currentTime = resumeAt;
      resumeAt = 0;
    }
  }
  let lastSave = 0;
  function onAudioTime() {
    if (!player || Date.now() - lastSave < 5000) return;
    lastSave = Date.now();
    saveProgress(slug, { audioPart: part, audioTime: player.currentTime });
  }
  function onAudioEnded() {
    if (book && part < book.audio.length - 1) playPart(part + 1);
  }

  onDestroy(() => {
    stopSpeaking();
    clearTimeout(scrollTimer);
    if (canSpeak) speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
  });
</script>

<svelte:head><title>{book ? `${book.title} · Audio Books` : 'Audio Books'} · Chess Castles</title></svelte:head>
<svelte:window onscroll={onScroll} />

<div class="top">
  <a class="btn ghost back" href="/books"><Icon name="back" size={18} color="currentColor" />Library</a>
  {#if book}
    <span class="btitle"><strong>{book.title}</strong><span class="label"> · {book.author}</span></span>
  {/if}
</div>

{#if error}
  <p class="card err">{error} <a href="/books">Back to the library</a></p>
{:else if !book}
  <p class="label">Opening the book…</p>
{:else}
  <div class="tools card">
    <label class="chap">
      <span class="sr">Chapter</span>
      <select value={chapter} onchange={(e) => goChapter(Number(e.currentTarget.value))}>
        {#each book.chapters as c, i (i)}
          <option value={i}>{read.includes(i) ? '✓ ' : ''}{i + 1}. {c.title}</option>
        {/each}
      </select>
    </label>
    <div class="grp" aria-label="Text size">
      <button class="ib" onclick={() => ((size = Math.max(14, size - 1)), saveSettings())} aria-label="Smaller text">A−</button>
      <button class="ib big" onclick={() => ((size = Math.min(30, size + 1)), saveSettings())} aria-label="Bigger text">A+</button>
    </div>
    <div class="grp" role="radiogroup" aria-label="Page colour">
      {#each [['paper', 'Light'], ['sepia', 'Sepia'], ['night', 'Night']] as [t, label] (t)}
        <button class="sw {t}" class:on={theme === t} role="radio" aria-checked={theme === t} aria-label={label} title={label} onclick={() => ((theme = t as Theme), saveSettings())}></button>
      {/each}
    </div>
    <span class="pct label">{bookPct}% read</span>
  </div>

  {#if book.audio.length}
    <div class="audiobook card">
      <button class="ab-head" onclick={() => (panel = panel === 'audio' ? 'none' : 'audio')} aria-expanded={panel === 'audio'}>
        <span class="ab-icon">🎧</span>
        <span class="ab-text">
          <strong>Audiobook</strong>
          <span class="label">Read by LibriVox volunteers · {book.audio.length} parts · {mmss(book.audio.reduce((s, a) => s + a.seconds, 0) / 60)} hours</span>
        </span>
        <Icon name="chevron" color="var(--muted)" />
      </button>
      {#if panel === 'audio'}
        <audio
          bind:this={player}
          src={book.audio[part].url}
          controls
          preload="metadata"
          onloadedmetadata={onAudioLoaded}
          ontimeupdate={onAudioTime}
          onended={onAudioEnded}
          onplay={stopSpeaking}
        ></audio>
        <ol class="parts">
          {#each book.audio as a, i (i)}
            <li>
              <button class:on={i === part} onclick={() => playPart(i)}>
                <span>{a.title}</span>
                <span class="label">{mmss(a.seconds)}{a.reader ? ` · ${a.reader}` : ''}</span>
              </button>
            </li>
          {/each}
        </ol>
        <p class="label small">
          Recordings from <a href={book.audioSource} target="_blank" rel="noopener">LibriVox</a>, in the public domain.
        </p>
      {/if}
    </div>
  {/if}

  {#if book.notation === 'descriptive' && showNote}
    <div class="note card">
      <span>
        This book writes moves the old way: <em>P-K4</em> means a pawn to the King's fourth square (e4 for White).
        <a href="/books/notation">How to read old notation</a>. When you listen, moves are read out in words.
      </span>
      <button class="ib" aria-label="Hide this note" onclick={() => ((showNote = false), saveSettings())}><Icon name="close" size={16} color="currentColor" /></button>
    </div>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <article
    bind:this={article}
    class="page {theme}"
    class:listening={speaking !== 'off'}
    style:font-size="{size}px"
    onclick={onArticleClick}
  >
    {#key chapter}
      <!-- Public-domain text cleaned at build time (scripts/build-books.py keeps only simple tags). -->
      {@html book.chapters[chapter].html}
    {/key}
    <nav class="pager" aria-label="Chapters">
      <button class="btn" disabled={chapter === 0} onclick={() => goChapter(chapter - 1)}>← Previous</button>
      <span class="label">Chapter {chapter + 1} of {book.chapters.length}</span>
      <button class="btn primary" disabled={chapter >= book.chapters.length - 1} onclick={() => (finishChapter(), goChapter(chapter + 1))}>Next →</button>
    </nav>
    <p class="credit label">
      {book.title} ({book.year}) is in the public domain. Text from <a href={book.source} target="_blank" rel="noopener">{book.sourceName ?? 'Project Gutenberg'}</a>.
    </p>
  </article>

  {#if canSpeak}
    <div class="listen" class:on={speaking !== 'off'} role="region" aria-label="Read aloud">
      <button class="play" onclick={pauseResume} aria-label={speaking === 'on' ? 'Pause' : 'Listen'}>
        {#if speaking === 'on'}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
        {/if}
      </button>
      <span class="ltext">
        {#if speaking === 'off'}<strong>Listen</strong><span class="label">Read this chapter aloud</span>
        {:else}<strong>{speaking === 'paused' ? 'Paused' : 'Reading aloud'}</strong><span class="label">Tap a paragraph to jump there</span>{/if}
      </span>
      <select class="rate" value={rate} onchange={(e) => changeRate(Number(e.currentTarget.value))} aria-label="Speed">
        {#each [0.75, 0.9, 1, 1.15, 1.3, 1.5] as r (r)}<option value={r}>{r}×</option>{/each}
      </select>
      {#if voices.length > 1}
        <select class="voice" value={voiceName} onchange={(e) => changeVoice(e.currentTarget.value)} aria-label="Voice">
          <option value="">Default voice</option>
          {#each voices as v (v.name)}<option value={v.name}>{v.name.replace(/^(Microsoft|Google)\s/, '')}</option>{/each}
        </select>
      {/if}
      {#if speaking !== 'off'}
        <button class="ib" onclick={stopSpeaking} aria-label="Stop reading"><Icon name="close" size={18} color="currentColor" /></button>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 4px 0 12px;
    flex-wrap: wrap;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .btitle {
    min-width: 0;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 12px;
    margin-bottom: 10px;
    position: sticky;
    top: 8px;
    z-index: 5;
  }
  .chap {
    flex: 1 1 240px;
    min-width: 0;
  }
  select {
    font: inherit;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 8px;
    max-width: 100%;
  }
  .chap select {
    width: 100%;
  }
  .grp {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .ib {
    min-width: 38px;
    height: 38px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ib.big {
    font-size: 19px;
  }
  .sw {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid var(--border);
    cursor: pointer;
  }
  .sw.paper {
    background: #fbfaf7;
  }
  .sw.sepia {
    background: #f3e7cf;
  }
  .sw.night {
    background: #15171c;
  }
  .sw.on {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .pct {
    margin-left: auto;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .note {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 10px;
    border-left: 4px solid var(--gold);
    font-size: 14.5px;
  }
  .note span {
    flex: 1;
  }
  .audiobook {
    margin-bottom: 10px;
    padding: 0;
    overflow: hidden;
  }
  .ab-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .ab-icon {
    font-size: 26px;
  }
  .ab-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .ab-head[aria-expanded='true'] :global(svg) {
    transform: rotate(90deg);
  }
  audio {
    width: calc(100% - 28px);
    margin: 0 14px 8px;
  }
  .parts {
    list-style: none;
    margin: 0;
    padding: 0 8px;
    max-height: 260px;
    overflow-y: auto;
  }
  .parts button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .parts button:hover {
    background: var(--raised);
  }
  .parts button.on {
    background: color-mix(in srgb, var(--gold) 20%, transparent);
    font-weight: 700;
  }
  .small {
    font-size: 12.5px;
    padding: 6px 14px 12px;
    margin: 0;
  }

  /* ---------- the page ---------- */
  .page {
    --ink: #22201c;
    --paper: #fbfaf7;
    --soft: #6b665c;
    --hl: #fde68a;
    max-width: 760px;
    margin: 0 auto 110px;
    padding: clamp(18px, 5vw, 56px) clamp(16px, 6vw, 64px);
    border-radius: 12px;
    background: var(--paper);
    color: var(--ink);
    font-family: Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
    line-height: 1.7;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    overflow-wrap: break-word;
  }
  .page.sepia {
    --ink: #3b2f1e;
    --paper: #f4e9d2;
    --soft: #7b6a4f;
    --hl: #f7c873;
  }
  .page.night {
    --ink: #d8d4cb;
    --paper: #15171c;
    --soft: #8d8a83;
    --hl: #4b3b12;
  }
  .page :global(h2),
  .page :global(h3),
  .page :global(h4) {
    font-family: inherit;
    line-height: 1.3;
    text-align: center;
    margin: 1.2em 0 0.8em;
  }
  .page :global(h2) {
    font-size: 1.45em;
  }
  .page :global(h3) {
    font-size: 1.2em;
  }
  .page :global(p) {
    margin: 0 0 1em;
  }
  .page :global(a) {
    color: inherit;
  }
  .page :global(img) {
    display: block;
    max-width: min(100%, 420px);
    height: auto;
    margin: 1em auto;
    background: #fff;
    border-radius: 4px;
  }
  .page.night :global(img) {
    filter: brightness(0.88);
  }
  .page :global(figure.k24-diagram) {
    width: min(100%, 340px);
    margin: 1.2em auto;
    font-family: system-ui, sans-serif;
  }
  .page :global(.dia-board) {
    aspect-ratio: 1;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
  }
  .page :global(figcaption) {
    margin-top: 6px;
    text-align: center;
    font-size: 0.75em;
    color: var(--soft);
  }
  .page :global(table) {
    border-collapse: collapse;
    margin: 1em auto;
    font-size: 0.88em;
    max-width: 100%;
    display: block;
    overflow-x: auto;
  }
  .page :global(td),
  .page :global(th) {
    padding: 2px 10px;
    vertical-align: top;
  }
  .page :global(blockquote) {
    margin: 1em 1.5em;
    font-style: italic;
  }
  .page :global(hr) {
    border: 0;
    border-top: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    width: 40%;
    margin: 2em auto;
  }
  .page :global(pre) {
    white-space: pre-wrap;
    font-size: 0.85em;
  }
  .page.listening :global(p),
  .page.listening :global(li),
  .page.listening :global(tr) {
    cursor: pointer;
  }
  .page :global(.speaking) {
    background: color-mix(in srgb, var(--hl) 70%, transparent);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--hl) 70%, transparent);
    border-radius: 4px;
    transition: background 0.2s;
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 2.5em;
    padding-top: 1.2em;
    border-top: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
    font-family: var(--font, system-ui), sans-serif;
    font-size: 15px;
  }
  .pager .label,
  .credit {
    color: var(--soft);
  }
  .credit {
    font-family: system-ui, sans-serif;
    font-size: 12.5px;
    text-align: center;
    margin: 1.4em 0 0;
  }

  /* ---------- read-aloud bar ---------- */
  .listen {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px 8px 8px;
    width: min(560px, calc(100vw - 32px));
    box-sizing: border-box;
    border-radius: 999px;
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }
  .listen.on {
    border-color: var(--gold);
  }
  /* Phones: above the tab bar at the bottom of the screen. */
  @media (max-width: 767px) {
    .listen {
      bottom: calc(84px + env(safe-area-inset-bottom));
    }
  }
  .play {
    width: 46px;
    height: 46px;
    flex: none;
    border-radius: 50%;
    border: 0;
    background: var(--action);
    color: var(--on-action);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .ltext {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .ltext .label {
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .voice {
    max-width: 130px;
  }
  .err {
    color: var(--loss);
  }
  @media (max-width: 520px) {
    .voice {
      display: none;
    }
    .pct {
      display: none;
    }
  }
</style>
