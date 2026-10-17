<script lang="ts">
  /**
   * FIDE rankings, like a live-ratings table: the world or any country,
   * open / women / juniors / girls, sorted by classical, rapid or blitz,
   * with photos, titles, flags and ages; search by name or FIDE id within
   * the list (and across FIDE when it isn't there). From FIDE's monthly
   * combined list (scripts/build-fide-list.py).
   */
  import { myCountry, myFideId, myPhoto, photoSrc } from '$lib/stores/me';
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { displayName, fideSearch, rankResults, type FidePlayer } from '$lib/api';
  import { FED_NAMES, fedName } from '$lib/fideFeds';

  /** [id, name, title, sex, classical, rapid, blitz, birth year, inactive, fed?] */
  type Row = [number, string, string, string, number, number, number, number, number, string?];
  type Key = 'classical' | 'rapid' | 'blitz' | 'age';
  type Group = 'all' | 'women' | 'juniors' | 'girls';

  const COL: Record<Exclude<Key, 'age'>, number> = { classical: 4, rapid: 5, blitz: 6 };
  const KEY = 'k24.rankings';
  let meta = $state<{ period: string; players: number; feds: [string, number][] } | undefined>();
  let fed = $state('');
  let group = $state<Group>('all');
  let sort = $state<Key>('classical');
  let inactive = $state(false);
  let q = $state('');
  let shown = $state(100);
  let rows = $state<Row[] | undefined>();
  let error = $state('');
  let fideResults = $state<FidePlayer[] | undefined>();
  let fideTimer: ReturnType<typeof setTimeout> | undefined;
  const cache = new Map<string, Row[]>();

  onMount(async () => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (typeof s.fed === 'string') fed = s.fed;
      // First visit: the player's own country (e.g. India), not the whole world.
      else if ($myCountry) fed = $myCountry;
      if (['all', 'women', 'juniors', 'girls'].includes(s.group)) group = s.group;
      if (['classical', 'rapid', 'blitz', 'age'].includes(s.sort)) sort = s.sort;
    } catch {
      /* first visit */
    }
    try {
      meta = await fetch('/data/fide/meta.json').then((r) => r.json());
    } catch {
      error = "The rating list couldn't be loaded.";
    }
  });

  $effect(() => {
    const f = fed;
    rows = undefined;
    const url = f ? `/data/fide/fed/${f}.json` : '/data/fide/world.json';
    const hit = cache.get(url);
    if (hit) {
      rows = hit;
      return;
    }
    fetch(url)
      .then((r) => r.json())
      .then((list: Row[]) => {
        cache.set(url, list);
        if (fed === f) rows = list;
      })
      .catch(() => (error = "The rating list couldn't be loaded."));
  });

  $effect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ fed, group, sort }));
    } catch {
      /* private mode */
    }
  });

  const year = $derived(Number(meta?.period.slice(0, 4)) || new Date().getFullYear());
  const age = (r: Row) => (r[7] ? year - r[7] : undefined);
  const words = $derived(q.toLowerCase().split(/[\s,]+/).filter(Boolean));

  const list = $derived.by(() => {
    if (!rows) return [];
    const col = sort === 'age' ? 4 : COL[sort];
    const out = rows.filter((r) => {
      if (!inactive && r[8]) return false;
      if (group === 'women' && r[3] !== 'F') return false;
      if (group === 'juniors' && !(r[7] && year - r[7] <= 20)) return false;
      if (group === 'girls' && !(r[3] === 'F' && r[7] && year - r[7] <= 20)) return false;
      if (sort !== 'age' && !r[col]) return false;
      return true;
    });
    out.sort((a, b) => (sort === 'age' ? (b[7] || 0) - (a[7] || 0) || b[4] - a[4] : (b[col] as number) - (a[col] as number)));
    // Rank before searching, so a found player keeps their place.
    const ranked = out.map((r, i) => ({ r, rank: i + 1 }));
    if (!words.length) return ranked;
    return ranked.filter(({ r }) => {
      const hay = `${r[1]} ${r[0]}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  });

  // Not in this list? Ask FIDE.
  $effect(() => {
    const query = q.trim();
    clearTimeout(fideTimer);
    fideResults = undefined;
    if (query.length < 3 || !rows || list.length >= 3) return;
    fideTimer = setTimeout(async () => {
      try {
        const found = rankResults(await fideSearch(query), query);
        if (q.trim() === query) fideResults = found.slice(0, 30);
      } catch {
        fideResults = [];
      }
    }, 450);
  });

  const feds = $derived((meta?.feds ?? []).map(([code, n]) => ({ code, n, name: fedName(code) })).sort((a, b) => a.name.localeCompare(b.name)));
  const flagOf = (r: Row) => r[9] ?? fed;
  const initials = (name: string) => displayName(name).split(' ').map((s) => s[0]).slice(0, 2).join('');
  const period = $derived(meta ? new Date(`${meta.period}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '');
  const SORTS: { k: Key; label: string }[] = [
    { k: 'classical', label: 'Classical' },
    { k: 'rapid', label: 'Rapid' },
    { k: 'blitz', label: 'Blitz' },
    { k: 'age', label: 'Age' },
  ];
  void FED_NAMES;
</script>

<section class="card rankings">
  <div class="filters">
    <select id="rank-fed" bind:value={fed} aria-label="Country" onchange={() => (shown = 100)}>
      <option value="">🌍 All countries</option>
      <option value="IND">India</option>
      {#each feds as f (f.code)}<option value={f.code}>{f.name} ({f.n.toLocaleString('en-IN')})</option>{/each}
    </select>
    <div class="segmented" role="group" aria-label="Players">
      {#each [['all', 'All players'], ['women', 'Women'], ['juniors', 'Juniors'], ['girls', 'Girls']] as [g, label] (g)}
        <button aria-pressed={group === g} onclick={() => ((group = g as Group), (shown = 100))}>{label}</button>
      {/each}
    </div>
  </div>
  <div class="filters">
    <label class="search">
      <Icon name="search" size={18} color="var(--muted)" />
      <input id="rank-search" type="search" bind:value={q} placeholder="Search by player name or FIDE ID" aria-label="Search by player name or FIDE ID" />
    </label>
    <label class="toggle"><input type="checkbox" bind:checked={inactive} /> <span>Include inactive</span></label>
  </div>
  {#if period}<p class="label period">FIDE list of {period} · {fed ? fedName(fed) : 'the world’s best'}{group === 'juniors' || group === 'girls' ? ' · 20 and under' : ''}</p>{/if}

  {#if error}
    <p class="label">{error}</p>
  {:else if !rows}
    <div class="skel"></div>
  {:else}
    <div class="sort-s" role="group" aria-label="Rating shown">
      {#each SORTS.filter((s) => s.k !== 'age') as s (s.k)}
        <button class="chip" aria-pressed={sort === s.k || (sort === 'age' && s.k === 'classical')} onclick={() => ((sort = s.k), (shown = 100))}>{s.label}</button>
      {/each}
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="rk">Rank</th>
            <th>Player</th>
            {#each SORTS as s (s.k)}
              <!-- Phones: only the rating the list is sorted by. -->
              <th class="r" class:hide-s={s.k === 'age' || s.k !== (sort === 'age' ? 'classical' : sort)}>
                <button class="sort" class:on={sort === s.k} onclick={() => ((sort = s.k), (shown = 100))}>{s.label}{sort === s.k ? ' ▼' : ' ⇅'}</button>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each list.slice(0, shown) as { r, rank } (r[0])}
            <tr>
              <td class="rk num">#{rank}</td>
              <td>
                <a class="player" href="/ratings/player/{r[0]}">
                  <!-- Only your own photo (from your profile), never photos from FIDE. -->
                  {#if $myPhoto && $myFideId === String(r[0])}
                    <img class="ph" src={photoSrc($myPhoto)} alt="" width="40" height="40" />
                  {:else}
                    <span class="ph initials">{initials(r[1])}</span>
                  {/if}
                  <span class="who">
                    {#if r[2]}<span class="title-tag">{r[2]}</span>{/if}
                    <span class="name">{displayName(r[1])}</span>
                    {#if flagOf(r)}<img class="flag" src="/flags/{flagOf(r)}.svg" alt={fedName(flagOf(r)!)} title={fedName(flagOf(r)!)} width="20" height="14" loading="lazy" />{/if}
                    {#if r[8]}<span class="label inact">inactive</span>{/if}
                  </span>
                </a>
              </td>
              <td class="r num" class:strong={sort === 'classical'} class:hide-s={sort !== 'classical' && sort !== 'age'}>{r[4] || '—'}</td>
              <td class="r num" class:strong={sort === 'rapid'} class:hide-s={sort !== 'rapid'}>{r[5] || '—'}</td>
              <td class="r num" class:strong={sort === 'blitz'} class:hide-s={sort !== 'blitz'}>{r[6] || '—'}</td>
              <td class="r num hide-s label">{age(r) ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if !list.length && !q}
      <p class="label">No players in this list.</p>
    {/if}
    {#if list.length > shown}<button class="btn more" onclick={() => (shown += 200)}>Show more ({(list.length - shown).toLocaleString('en-IN')} more)</button>{/if}
    {#if q && fideResults?.length}
      <h3 class="title fide-h">More players on FIDE</h3>
      <ul class="fide-res">
        {#each fideResults as p (p.fideId)}
          <li>
            <a href="/ratings/player/{p.fideId}">
              <span><strong>{p.title ? `${p.title} ` : ''}{displayName(p.name)}</strong> <span class="label">{[p.federation, p.birthYear].filter(Boolean).join(' · ')}</span></span>
              <span class="num label">Std {p.standard ?? '—'} · Rapid {p.rapid ?? '—'} · Blitz {p.blitz ?? '—'}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else if q && !list.length && fideResults && !fideResults.length}
      <p class="label">No player found. Try the surname only, or pick the player's country.</p>
    {/if}
  {/if}
</section>

<style>
  .rankings {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  select {
    font: inherit;
    font-weight: 600;
    padding: 9px 10px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
    max-width: 100%;
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
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
  .period {
    margin: 0;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-size: 13px;
    color: var(--text-2);
    padding: 8px 6px;
    white-space: nowrap;
  }
  th.r,
  td.r {
    text-align: right;
  }
  td {
    padding: 7px 6px;
    border-top: 1px solid var(--border);
  }
  tbody tr:nth-child(even) {
    background: color-mix(in srgb, var(--raised) 45%, transparent);
  }
  .rk {
    width: 64px;
    color: var(--text-2);
  }
  .sort {
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .sort.on {
    color: var(--text);
  }
  .player {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
    min-width: 0;
  }
  .player:hover .name {
    text-decoration: underline;
  }
  .ph {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    object-fit: cover;
    flex: none;
  }
  .ph.initials {
    display: grid;
    place-items: center;
    background: #5a3a1c;
    color: #eef3ff;
    font-weight: 700;
    font-size: 14px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .title-tag {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: #b3332f;
    color: #fff;
  }
  .flag {
    width: 20px;
    height: 14px;
    object-fit: cover;
    border-radius: 2px;
  }
  .inact {
    font-size: 11px;
  }
  .strong {
    font-weight: 800;
  }
  .more {
    align-self: center;
  }
  .fide-h {
    margin: 6px 0 0;
    font-size: 16px;
  }
  .fide-res {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .fide-res a {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding: 8px 4px;
    border-top: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
  }
  .skel {
    height: 400px;
  }
  .sort-s {
    display: none;
    gap: 6px;
    margin-bottom: 6px;
  }
  @media (max-width: 600px) {
    .hide-s {
      display: none;
    }
    .sort-s {
      display: flex;
    }
    .rk {
      width: 44px;
    }
  }
</style>
