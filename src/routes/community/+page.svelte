<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import {
    COACH_LANGUAGES,
    coaches,
    dateRange,
    indianEvents,
    INDIAN_STATES,
    localEvents,
    phoneE164,
    type Coach,
    type IndianEvent,
    type LocalEvent,
    type Speed,
  } from '$lib/community';
  import { photoSrc } from '$lib/stores/me';

  type Tab = 'events' | 'coaches';
  let tab = $state<Tab>('events');
  let region = $state('');
  let speed = $state<Speed | ''>('');
  let q = $state('');
  let shown = $state(40);

  let fide = $state<IndianEvent[] | undefined>();
  let fideError = $state('');
  let local = $state<LocalEvent[]>([]);
  let coachList = $state<Coach[] | undefined>();
  let coachError = $state('');
  let language = $state('');
  let mode = $state<'' | 'online' | 'home' | 'academy'>('');

  const KEY = 'k24.community';
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  onMount(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (typeof s.state === 'string') region = s.state;
    } catch {
      /* first visit */
    }
    if (page.url.searchParams.get('tab') === 'coaches') tab = 'coaches';
    indianEvents().then((e) => (fide = e), () => ((fideError = "FIDE's tournament list couldn't be loaded right now."), (fide = [])));
    localEvents(today).then((e) => (local = e), () => {});
    coaches().then((c) => (coachList = c), () => ((coachError = "The coach directory couldn't be loaded right now."), (coachList = [])));
  });

  function setRegion(s: string) {
    region = s;
    shown = 40;
    try {
      localStorage.setItem(KEY, JSON.stringify({ state: s }));
    } catch {
      /* private mode */
    }
  }

  const words = $derived(q.toLowerCase().split(/\s+/).filter(Boolean));
  const matches = (hay: string) => words.every((w) => hay.toLowerCase().includes(w));

  type Item = { kind: 'fide'; e: IndianEvent } | { kind: 'local'; e: LocalEvent };
  const items = $derived.by((): Item[] => {
    const out: Item[] = [
      ...local.filter((e) => (!region || e.state === region) && (!speed || e.speed === speed) && matches(`${e.title} ${e.city} ${e.organizer} ${e.venue}`)).map((e) => ({ kind: 'local' as const, e })),
      ...(fide ?? []).filter((e) => (!region || e.state === region) && (!speed || e.speed === speed) && matches(`${e.name} ${e.city} ${e.national ?? ''}`)).map((e) => ({ kind: 'fide' as const, e })),
    ];
    return out.sort((a, b) => a.e.start.localeCompare(b.e.start));
  });

  const coachItems = $derived(
    (coachList ?? []).filter(
      (c) =>
        (!region || c.state === region) &&
        (!language || c.languages.includes(language)) &&
        (!mode || c.modes.includes(mode)) &&
        matches(`${c.name} ${c.title ?? ''} ${c.city} ${c.area ?? ''} ${c.pincode ?? ''} ${c.about}`),
    ),
  );

  const running = (start: string, end?: string) => start <= today && (end ?? start) >= today;
  const SPEED: Record<Speed, string> = { classical: 'Classical', rapid: 'Rapid', blitz: 'Blitz' };
  const MODE = { online: 'Online', home: 'Home tuition', academy: 'At an academy' };
  const LEVEL = { beginner: 'Beginners', intermediate: 'Intermediate', advanced: 'Advanced', tournament: 'Tournament players' };
  const wa = (phone: string, text: string) => `https://wa.me/${phoneE164(phone).replace('+', '')}?text=${encodeURIComponent(text)}`;
</script>

<svelte:head><title>FIDE & Local Events · Chess Castles</title></svelte:head>

<div class="page">
  <header class="head">
    <div>
      <h1 class="display">FIDE &amp; Local Events</h1>
      <p class="label">FIDE-rated and local tournaments across India, with dates, venues and how to register, plus chess coaches near you.</p>
    </div>
    <div class="segmented" role="group" aria-label="Show">
      <button aria-pressed={tab === 'events'} onclick={() => ((tab = 'events'), (shown = 40))}>Tournaments</button>
      <button aria-pressed={tab === 'coaches'} onclick={() => (tab = 'coaches')}>Coaches</button>
    </div>
  </header>

  <section class="filters card">
    <label class="search">
      <Icon name="search" size={18} color="var(--muted)" />
      <input id="community-search" type="search" bind:value={q} placeholder={tab === 'events' ? 'Tournament, city or "Under 11"' : 'Name, city, area or PIN code'} aria-label="Search" />
    </label>
    <select id="community-state" value={region} onchange={(e) => setRegion((e.currentTarget as HTMLSelectElement).value)} aria-label="State">
      <option value="">All of India</option>
      {#each INDIAN_STATES as s (s)}<option value={s}>{s}</option>{/each}
    </select>
    {#if tab === 'events'}
      <div class="chips" role="group" aria-label="Speed">
        <button class="chip" aria-pressed={speed === ''} onclick={() => (speed = '')}>All</button>
        {#each ['classical', 'rapid', 'blitz'] as const as sp (sp)}
          <button class="chip" aria-pressed={speed === sp} onclick={() => (speed = sp)}>{SPEED[sp]}</button>
        {/each}
      </div>
    {:else}
      <select id="community-language" bind:value={language} aria-label="Language">
        <option value="">Any language</option>
        {#each COACH_LANGUAGES as l (l)}<option value={l}>{l}</option>{/each}
      </select>
      <select id="community-mode" bind:value={mode} aria-label="How they teach">
        <option value="">Online or in person</option>
        <option value="online">Online</option>
        <option value="home">Home tuition</option>
        <option value="academy">At an academy</option>
      </select>
    {/if}
  </section>

  {#if tab === 'events'}
    {#if !fide}
      <div class="card skel"></div>
    {:else}
      {#if fideError}<p class="label">{fideError}</p>{/if}
      <p class="label count">{items.length} {items.length === 1 ? 'tournament' : 'tournaments'}{region ? ` in ${region}` : ' in India'}, soonest first.</p>
      <ul class="events">
        {#each items.slice(0, shown) as it (it.kind + it.e.id)}
          {#if it.kind === 'fide'}
            {@const e = it.e}
            <li class="card event">
              <div class="date">
                <strong>{dateRange(e.start, e.end)}</strong>
                {#if running(e.start, e.end)}<span class="tag live">On now</span>{/if}
              </div>
              <h2 class="title">{e.name}</h2>
              <p class="label">{[e.city, e.state].filter((x, i, a) => x && a.indexOf(x) === i).join(', ')}</p>
              <div class="tags">
                <span class="tag">{SPEED[e.speed]}</span>
                <span class="tag fide">FIDE rated</span>
                {#if e.national}<span class="tag nat">{e.national}</span>{/if}
              </div>
              <div class="links">
                {#if e.brochure}<a class="btn" href={e.brochure} target="_blank" rel="noopener"><Icon name="book" size={16} />Brochure</a>{/if}
                {#if e.onFide}<a class="btn ghost" href="https://ratings.fide.com/tournament_information.phtml?event={e.id}" target="_blank" rel="noopener">FIDE page <Icon name="external" size={14} /></a>{/if}
              </div>
            </li>
          {:else}
            {@const e = it.e}
            <li class="card event local">
              <div class="date">
                <strong>{dateRange(e.start, e.end)}</strong>
                {#if running(e.start, e.end)}<span class="tag live">On now</span>{/if}
                <span class="tag k24">Listed on Chess Castles</span>
              </div>
              <h2 class="title">{e.title}</h2>
              <p class="label">{e.venue}, {e.city}, {e.state} · by {e.organizer}</p>
              <div class="tags">
                <span class="tag">{SPEED[e.speed]}</span>
                {#if e.fideRated}<span class="tag fide">FIDE rated</span>{/if}
                {#each e.categories as c (c)}<span class="tag">{c}</span>{/each}
              </div>
              {#if e.entryFee || e.prizes || e.registerBy}
                <p class="small">{[e.entryFee ? `Entry: ${e.entryFee}` : '', e.prizes ? `Prizes: ${e.prizes}` : '', e.registerBy ? `Register by ${dateRange(e.registerBy)}` : ''].filter(Boolean).join(' · ')}</p>
              {/if}
              {#if e.description}<p class="small desc">{e.description}</p>{/if}
              <div class="links">
                <a class="btn" href="tel:{phoneE164(e.phone)}"><Icon name="send" size={16} />Call {e.phone}</a>
                {#if e.whatsapp}<a class="btn" href={wa(e.phone, `Hello, I found "${e.title}" on Chess Castles and would like to know more.`)} target="_blank" rel="noopener">WhatsApp</a>{/if}
                {#if e.link}<a class="btn ghost" href={e.link} target="_blank" rel="noopener">Website <Icon name="external" size={14} /></a>{/if}
              </div>
            </li>
          {/if}
        {/each}
      </ul>
      {#if items.length > shown}<button class="btn more" onclick={() => (shown += 40)}>Show more</button>{/if}
      <p class="label foot">From FIDE's list of rated tournaments in India and AICF's event pages, updated every few hours. Organising a local tournament? Listing it here is free: send the details on WhatsApp to 96898 74178 or to support@chesscastles.com, and it appears here once our team checks it.</p>
    {/if}
  {:else if !coachList}
    <div class="card skel"></div>
  {:else}
    {#if coachError}<p class="label">{coachError}</p>{/if}
    {#if !coachItems.length}
      <div class="card empty">
        <p>{coachList.length ? 'No coach matches these filters yet. Try all of India or another language.' : 'No coaches are listed yet.'}</p>
        <p class="label">Coaches can register free: send your details on WhatsApp to 96898 74178 or to support@chesscastles.com. Our team checks every profile before it appears.</p>
      </div>
    {:else}
      <ul class="coaches">
        {#each coachItems as c (c.id)}
          <li class="card coach">
            <div class="c-head">
              {#if c.photo}<img class="c-photo" src={photoSrc(c.photo)} alt="" />{:else}<span class="c-photo initials display">{c.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</span>{/if}
              <div>
                <h2 class="title">{#if c.title}<span class="t">{c.title}</span> {/if}{c.name}</h2>
                <p class="label">{[c.area, c.city, c.state].filter(Boolean).join(', ')}{c.pincode ? ` · ${c.pincode}` : ''}</p>
                <p class="label">{c.fideRating ? `FIDE ${c.fideRating} · ` : ''}{c.experience} {c.experience === 1 ? 'year' : 'years'} coaching</p>
              </div>
            </div>
            <div class="tags">
              {#each c.modes as m (m)}<span class="tag">{MODE[m]}</span>{/each}
              {#each c.levels as l (l)}<span class="tag soft">{LEVEL[l]}</span>{/each}
            </div>
            <p class="small"><strong>Languages:</strong> {c.languages.join(', ')}{c.fee ? ` · Fee: ${c.fee}` : ''}</p>
            <p class="small desc">{c.about}</p>
            {#if c.achievements}<p class="small desc"><strong>Achievements:</strong> {c.achievements}</p>{/if}
            <div class="links">
              <a class="btn" href="tel:{phoneE164(c.phone)}">Call {c.phone}</a>
              {#if c.whatsapp}<a class="btn" href={wa(c.phone, `Hello ${c.name}, I found you on Chess Castles and would like to know about chess coaching.`)} target="_blank" rel="noopener">WhatsApp</a>{/if}
              {#if c.email}<a class="btn ghost" href="mailto:{c.email}">Email</a>{/if}
              {#if c.fideId}<a class="btn ghost" href="/ratings/player/{c.fideId}">FIDE profile</a>{/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    flex-wrap: wrap;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 40px;
  }
  .head p {
    margin: 4px 0 0;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 12px 14px;
  }
  .search {
    flex: 1 1 260px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
  }
  select {
    font: inherit;
    padding: 8px 10px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
    max-width: 100%;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .count,
  .foot {
    margin: 0;
  }
  .events,
  .coaches {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: 12px;
  }
  .event,
  .coach {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .event.local {
    border-color: var(--gold);
  }
  .date {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    color: var(--gold);
  }
  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.3;
  }
  .event p,
  .coach p {
    margin: 0;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--border);
  }
  .tag.fide {
    color: var(--accent);
  }
  .tag.nat {
    color: var(--gold);
    border-color: var(--gold);
  }
  .tag.live {
    background: var(--win);
    border-color: var(--win);
    color: #fff;
  }
  .tag.k24 {
    color: var(--gold);
  }
  .tag.soft {
    font-weight: 500;
    color: var(--text-2);
  }
  .small {
    font-size: 13.5px;
  }
  .desc {
    color: var(--text-2);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
    padding-top: 6px;
  }
  .more {
    align-self: center;
  }
  .c-head {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .c-photo {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .c-photo.initials {
    display: grid;
    place-items: center;
    background: #5a3a1c;
    color: #eef3ff;
    font-size: 22px;
  }
  .t {
    color: var(--gold);
  }
  .empty {
    padding: 20px;
  }
  .empty p {
    margin: 0 0 6px;
  }
  .skel {
    height: 240px;
  }
</style>
