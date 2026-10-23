<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import { AVATARS, chooseAvatar, coachAvatar } from '$lib/coach/avatar';
  import { CATALOG } from '$lib/coach/catalog';
  import { loadLibrary, type LibraryRow } from '$lib/coach/content/openings';
  import { LEGENDS } from '$lib/coach/content/legends';
  import { LANGS, type Lang } from '$lib/coach/i18n';
  import { loadCoach, saveCoach, type CoachState } from '$lib/coach/progress';
  import { SECTIONS, type Category, type Level } from '$lib/coach/types';
  import { CLOUD_NAMES, cloudVoice, speak, speaking, stopSpeaking, voicesFor, voicesReady } from '$lib/coach/voice';
  import { avatarInfo } from '$lib/coach/avatar';
  import { formatDate } from '$lib/format';
  import { myGames, opponentOf, outcome } from '$lib/stores/myGames';

  type Tab = Category | 'review';
  let prefs = $state<CoachState>({ lang: 'en', voice: true, voices: {}, done: {}, rating: 1200 });
  let tab = $state<Tab>('opening');
  let level = $state<Level | 'all'>('all');
  let query = $state('');
  let library = $state<LibraryRow[]>([]);
  let voices = $state<{ name: string; lang: string }[]>([]);
  /** The coach chooser: closed until asked for (Guru teaches by default, or /coach?choose=1 from Home's promo), closed again once a coach is picked. */
  let choosing = $state(typeof location !== 'undefined' && new URLSearchParams(location.search).has('choose'));

  // Chess Castles' natural voices (cloud): when on, they speak for every coach and the device's voice list is not needed.
  let cloudOn = $state(false);
  $effect(() => {
    void cloudVoice().then((v) => (cloudOn = v));
  });
  const refreshVoices = () => (voices = voicesFor(prefs.lang).map((v) => ({ name: v.name, lang: v.lang })));
  onMount(() => {
    prefs = loadCoach();
    myGames.load();
    try {
      const t = sessionStorage.getItem('k24.coach.tab');
      if (t === 'opening' || t === 'middlegame' || t === 'endgame' || t === 'review') tab = t;
    } catch {
      // ignore
    }
    voicesReady().then(refreshVoices);
    loadLibrary().then((rows) => (library = rows)).catch(() => {});
  });

  const set = (patch: Partial<CoachState>) => {
    prefs = { ...prefs, ...patch };
    saveCoach(prefs);
    if (patch.lang) refreshVoices();
  };
  const pick = (t: Tab) => {
    tab = t;
    try {
      sessionStorage.setItem('k24.coach.tab', t);
    } catch {
      // ignore
    }
  };
  const chosenVoice = $derived(prefs.voices[prefs.lang] ?? voices[0]?.name ?? '');
  const SAMPLE: Record<Lang, string> = {
    en: 'Hello! I am Chess Guru. Shall we learn something new today?',
    hi: 'नमस्ते! मैं Chess Guru हूँ। चलो, आज कुछ नया सीखते हैं!',
    mr: 'नमस्कार! मी Chess Guru. चल, आज काहीतरी नवीन शिकूया!',
  };

  const TABS: { id: Tab; label: string; icon: 'book' | 'flame' | 'flag' | 'history' }[] = [
    { id: 'opening', label: 'Openings', icon: 'book' },
    { id: 'middlegame', label: 'Middlegame', icon: 'flame' },
    { id: 'endgame', label: 'Endgame', icon: 'flag' },
    { id: 'review', label: 'Review my games', icon: 'history' },
  ];
  const LEVELS: (Level | 'all')[] = ['all', 'beginner', 'intermediate', 'advanced'];

  /** A tap on Guru: Guru says hello again (a second tap stops). With no voice on this device, the face still talks a moment. */
  let waving = $state(false);
  function hello() {
    if ($speaking) return stopSpeaking();
    if (!cloudOn && !voices.length) {
      waving = true;
      setTimeout(() => (waving = false), 2600);
      return;
    }
    void speak(SAMPLE[prefs.lang], prefs.lang, cloudOn ? undefined : chosenVoice);
  }

  const q = $derived(query.trim().toLowerCase());
  const lessons = $derived(
    CATALOG.filter((l) => (q ? `${l.title} ${l.blurb} ${l.section}`.toLowerCase().includes(q) : l.category === tab)).filter((l) => level === 'all' || l.level === level),
  );
  const sections = $derived.by(() => {
    if (q) return [{ name: 'Lessons', items: lessons }];
    const order = tab === 'review' ? [] : SECTIONS[tab];
    return order.map((name) => ({ name, items: lessons.filter((l) => l.section === name) })).filter((s) => s.items.length);
  });
  const libraryHits = $derived(
    q.length >= 2
      ? library
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => `${r[0]} ${r[1]}`.toLowerCase().includes(q))
          .slice(0, 30)
      : [],
  );
  const doneCount = $derived(CATALOG.filter((l) => prefs.done[l.id]).length);
  const legendNames = (ids?: string[]) => (ids ?? []).slice(0, 4).map((k) => LEGENDS[k]?.name.split(' ')[0] ?? k);
</script>

<svelte:head><title>Coach · Chess Castles</title></svelte:head>

<div class="page">
  <section class="hero card">
    <button class="guru-tap" onclick={hello} aria-label={$speaking ? 'Stop Guru' : 'Hear Guru say hello'} title="Tap Guru">
      <GuruAvatar size={104} talking={$speaking || waving} />
    </button>
    <div class="intro">
      <h1 class="display">Chess Guru</h1>
      <p>Lessons from beginner to advanced level: openings, middlegame tactics and strategy, and endgames. Guru explains every position, plays the moves out, and you practise each one against the engine at your level.</p>
      <p class="label">{CATALOG.length} lessons · 3,865 named opening lines in the library · {doneCount} finished</p>
      <button class="btn ghost change" aria-expanded={choosing} onclick={() => (choosing = !choosing)}>
        <Icon name="users" size={18} />{choosing ? 'Close' : 'Change coach'}
      </button>
    </div>
  </section>

  {#if choosing}
    <section class="chooser card" aria-label="Choose your coach">
      <h2 class="title">Choose your coach</h2>
      {#each [{ kids: false, title: 'Chess coaches', note: 'For serious study, at any age.' }, { kids: true, title: 'For young players', note: 'Friendly characters who teach the same lessons.' }] as group (group.title)}
        <h3 class="group-h">{group.title} <span class="label">{group.note}</span></h3>
        <div class="faces" class:kids={group.kids}>
          {#each AVATARS.filter((a) => !!a.kids === group.kids) as a (a.id)}
            <button class="face" class:on={$coachAvatar === a.id} aria-pressed={$coachAvatar === a.id} onclick={() => { chooseAvatar(a.id); prefs = loadCoach(); refreshVoices(); choosing = false; }}>
              <GuruAvatar id={a.id} size={group.kids ? 92 : 108} talking={$coachAvatar === a.id} />
              <span class="title">{a.name}</span>
              <span class="label">{a.about}</span>
              <span class="vtag">{a.voice === 'male' ? "Man's voice" : "Woman's voice"}</span>
              {#if a.sarvam}<span class="vtag new">✨ New voice</span>{/if}
            </button>
          {/each}
        </div>
      {/each}
    </section>
  {/if}

  <section class="settings">
    <div class="setting">
      <span class="label">Guru speaks</span>
      <div class="segmented" role="group" aria-label="Guru speaks">
        {#each LANGS as l (l.id)}
          <button aria-pressed={prefs.lang === l.id} onclick={() => set({ lang: l.id as Lang })}>{l.name}</button>
        {/each}
      </div>
    </div>
    <div class="setting">
      <span class="label">Guru's voice</span>
      <div class="voice-row">
        {#if cloudOn}
          {@const coach = avatarInfo($coachAvatar)}
          {@const g = coach.voice}
          {#if coach.sarvam}
            <span class="cloud-v">New voice by <strong>Sarvam AI</strong> <span class="label">({g === 'male' ? "man's" : "woman's"} voice, made for Indian languages)</span></span>
          {:else}
            <span class="cloud-v">Natural voice: <strong>{CLOUD_NAMES[prefs.lang][g]}</strong> <span class="label">({g === 'male' ? "man's" : "woman's"} voice)</span></span>
          {/if}
          <button class="btn ghost" onclick={() => speak(SAMPLE[prefs.lang], prefs.lang)}><Icon name="speaker" size={18} />Test</button>
        {:else if voices.length}
          <select value={chosenVoice} onchange={(e) => set({ voices: { ...prefs.voices, [prefs.lang]: (e.currentTarget as HTMLSelectElement).value } })} aria-label="Guru's voice">
            {#each voices as v (v.name)}<option value={v.name}>{v.name.replace(/^Microsoft |^Google /, '')}</option>{/each}
          </select>
          <button class="btn ghost" onclick={() => speak(SAMPLE[prefs.lang], prefs.lang, chosenVoice)}><Icon name="speaker" size={18} />Test</button>
        {/if}
        <button class="btn ghost" aria-pressed={prefs.voice} onclick={() => set({ voice: !prefs.voice })}>
          <Icon name={prefs.voice ? 'speaker' : 'mute'} size={18} />{prefs.voice ? 'Voice on' : 'Voice off'}
        </button>
      </div>
    </div>
    <label class="search">
      <Icon name="search" size={18} color="var(--muted)" />
      <input bind:value={query} placeholder="Search lessons and 3,865 opening lines" aria-label="Search lessons and openings" />
    </label>
  </section>

  {#if !q}
    <nav class="tabs" aria-label="Topics">
      {#each TABS as t (t.id)}
        <button class="tab" class:on={tab === t.id} aria-pressed={tab === t.id} onclick={() => pick(t.id)}>
          <Icon name={t.icon} size={20} color={tab === t.id ? 'var(--accent)' : 'var(--muted)'} />
          <span>{t.label}</span>
          {#if t.id !== 'review'}<span class="count">{CATALOG.filter((l) => l.category === t.id).length}</span>{/if}
        </button>
      {/each}
    </nav>
  {/if}

  {#if tab !== 'review' || q}
    <div class="chips" role="group" aria-label="Level">
      {#each LEVELS as lv (lv)}
        <button class="chip" aria-pressed={level === lv} onclick={() => (level = lv)}>{lv === 'all' ? 'All levels' : lv[0].toUpperCase() + lv.slice(1)}</button>
      {/each}
    </div>
    {#each sections as s (s.name)}
      <h2 class="section title">{s.name}</h2>
      <ul class="grid">
        {#each s.items as l (l.id)}
          <li>
            <a class="lesson card" href="/coach/{l.id}">
              <span class="top">
                <span class="name title">{l.title}</span>
                {#if prefs.done[l.id]}<span class="done" title="Finished"><Icon name="check" size={16} color="#fff" /></span>{/if}
              </span>
              <span class="blurb">{l.blurb}</span>
              <span class="meta">
                <span class="pill lvl {l.level}">{l.level}</span>
                {#if l.legends?.length}<span class="pill gold">{legendNames(l.legends).join(', ')}</span>{/if}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/each}
    {#if libraryHits.length}
      <h2 class="section title">Opening library</h2>
      <ul class="lib">
        {#each libraryHits as { r, i } (i)}
          <li><a href="/coach/lib-{i}"><span class="eco">{r[0]}</span><span class="nm">{r[1]}</span><span class="label mv">{r[2].split(' ').slice(0, 6).join(' ')}</span></a></li>
        {/each}
      </ul>
    {/if}
    {#if q && !lessons.length && !libraryHits.length}
      <p class="label">Nothing found for "{query}".</p>
    {/if}
    {#if !q && tab === 'opening'}
      <p class="label more">Looking for another opening? Search any of the 3,865 named opening lines above (150 families, from the Sicilian and the Ruy Lopez to the Zukertort).</p>
    {/if}
  {:else}
    <a class="card insights-cta" href="/insights">
      <strong class="title">Analyse your chess.com or Lichess games</strong>
      <span class="label">Guru checks your last games, finds what costs you points, and builds your weekly plan with puzzles from your own mistakes.</span>
    </a>
    <section class="reviews card">
      <h2 class="title">Review your games with Guru</h2>
      <p class="label">Guru studies your game with the engine, finds your best moments and your biggest mistakes, explains the better moves, and lets you practise those positions.</p>
      {#if !$myGames.length}
        <p>No games yet. <a href="/play">Play a game</a> and come back to review it.</p>
      {:else}
        <ul>
          {#each $myGames.slice(0, 30) as g (g.id)}
            <li>
              <span class="res {outcome(g)}">{({ won: 'W', lost: 'L', draw: 'D', unfinished: '–' })[outcome(g)]}</span>
              <span class="vs">vs {opponentOf(g)}<span class="label"> · {Math.ceil(g.uci.length / 2)} moves · {formatDate(g.playedAt)}</span></span>
              <a class="btn primary small" href="/coach/review/{g.id}">Review with Guru</a>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .cloud-v {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
  }
  .insights-cta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border-color: var(--gold);
    color: var(--text);
    text-decoration: none;
    margin-bottom: 12px;
  }
  .insights-cta:hover {
    outline: 1px solid var(--gold);
    text-decoration: none;
  }
  .page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 28px 24px 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .guru-tap {
    flex: none;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    transition: transform 0.12s;
  }
  .guru-tap:active {
    transform: scale(0.95);
  }
  .hero {
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 22px 24px;
    background:
      radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--gold) 16%, transparent), transparent 55%),
      var(--card);
  }
  h1 {
    margin: 0 0 6px;
    font-size: 40px;
  }
  .intro p {
    margin: 0 0 6px;
    color: var(--text-2);
    max-width: 70ch;
  }
  .change {
    margin-top: 4px;
  }
  .chooser {
    padding: 18px 20px;
  }
  .chooser h2 {
    margin: 0 0 12px;
    font-size: 20px;
  }
  .group-h {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    margin: 14px 0 8px;
    font-size: 15px;
    color: var(--gold);
  }
  .group-h .label {
    font-weight: 500;
    font-size: 13px;
    color: var(--muted);
  }
  .faces {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
  }
  .faces.kids {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .vtag {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .vtag.new {
    color: var(--gold);
  }
  .face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 18px 10px 14px;
    border-radius: var(--r-card);
    border: 2px solid var(--border);
    background: radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--gold) 10%, transparent), var(--raised) 70%);
    transition:
      transform 0.15s,
      border-color 0.15s;
    color: inherit;
    font: inherit;
    text-align: center;
    cursor: pointer;
  }
  .face .label {
    font-size: 12.5px;
    line-height: 1.3;
  }
  .face:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--gold) 60%, var(--border));
  }
  .face.on {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 25%, transparent);
  }
  .settings {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 14px 22px;
  }
  .setting {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .voice-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .voice-row .btn {
    gap: 6px;
  }
  .voice-row select {
    height: 40px;
    max-width: 240px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-size: 14px;
    padding: 0 8px;
  }
  .search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-control);
    background: var(--card);
  }
  .search input {
    flex: 1;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    outline: none;
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font: inherit;
    font-family: var(--font-title);
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }
  .tab.on {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 14%, var(--card));
  }
  .count {
    margin-left: auto;
    font-size: 13px;
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .section {
    margin: 10px 0 0;
    font-size: 22px;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .lesson {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    color: var(--text);
    text-decoration: none;
    transition: border-color 0.15s, transform 0.15s;
  }
  .lesson:hover {
    border-color: var(--brand);
    transform: translateY(-2px);
  }
  .top {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    font-size: 19px;
  }
  .done {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--win);
  }
  .blurb {
    color: var(--text-2);
    font-size: 14.5px;
    flex: 1;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .lvl {
    text-transform: capitalize;
  }
  .lvl.beginner {
    color: var(--win);
  }
  .lvl.advanced {
    color: var(--loss);
  }
  .lib {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lib a {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-soft);
    color: var(--text);
    text-decoration: none;
  }
  .lib a:hover {
    border-color: var(--brand);
  }
  .eco {
    font-weight: 700;
    color: var(--accent);
  }
  .mv {
    font-size: 12.5px;
  }
  .more {
    margin: 0;
  }
  .reviews {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .reviews h2 {
    margin: 0;
    font-size: 22px;
  }
  .reviews ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .reviews li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border-soft);
  }
  .vs {
    flex: 1;
  }
  .res {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 13px;
    background: var(--raised);
  }
  .res.won {
    background: var(--win);
    color: #fff;
  }
  .res.lost {
    background: var(--loss);
    color: #fff;
  }
  @media (max-width: 767px) {
    .page {
      padding: 16px 16px 32px;
    }
    .hero {
      flex-direction: column;
      text-align: center;
      padding: 16px;
    }
    h1 {
      font-size: 30px;
    }
    .tabs {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
    }
    .tab {
      min-width: 0;
      padding: 12px 10px;
      font-size: 15.5px;
      gap: 6px;
    }
    .lib a {
      grid-template-columns: 48px minmax(0, 1fr);
    }
    .mv {
      display: none;
    }
  }
</style>
