<script lang="ts">
  /**
   * Castle Cups (owner, 2026-10-22): Chess Castles' own Swiss tournaments every evening, one per time control, all
   * games here (server/api-worker src/cup.ts). Today's four cups with Join, the rules in a few lines, and the latest
   * champions. Admins can start a cup now or call it off, and switch cups off for everyone.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer } from '$lib/classroom/api';
  import { adminMe } from '$lib/admin';
  import { track } from '$lib/analytics';
  import { t } from '$lib/i18n';
  import CupCard from '$lib/cups/CupCard.svelte';
  import { cancelCup, flashCup, joinCup, leaveCup, resetCups, startCup, testCup, todayCups, type CupSummary, type Today } from '$lib/cups/api';
  import { forgetCup, rememberCup } from '$lib/cups/joined';
  import { API } from '$lib/api';
  import { token } from '$lib/classroom/api';

  const me = $derived($session.status === 'in' ? $session.uid : (devPlayer() ?? ''));
  let today = $state<Today>();
  let now = $state(Date.now());
  let offset = 0;
  let busy = $state('');
  let error = $state('');
  let admin = $state(false);

  async function load() {
    try {
      today = await todayCups();
      offset = today.now - Date.now();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  onMount(() => {
    void load();
    const tick = setInterval(() => (now = Date.now() + offset), 1000);
    const poll = setInterval(() => document.visibilityState === 'visible' && void load(), 30_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  });
  $effect(() => {
    if ($session.status !== 'in') return void (admin = false);
    adminMe().then(
      () => (admin = true),
      () => (admin = false),
    );
  });

  /** A change of mine shows at once (the list is cached a few seconds on the server). */
  function patch(id: string, f: (c: CupSummary) => CupSummary) {
    if (today) today = { ...today, cups: today.cups.map((c) => (c.id === id ? f(c) : c)) };
  }
  async function join(c: CupSummary) {
    if (!me) return startSignIn();
    busy = c.id;
    error = '';
    try {
      await joinCup(c.id);
      track('feature', `cup_join_${c.slot}`);
      rememberCup({ id: c.id, name: c.name, startAt: c.startAt });
      patch(c.id, (x) => ({ ...x, uids: [...x.uids, me], entries: x.entries + 1 }));
      if (c.status === 'running') await goto(`/cups/${c.id}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = '';
    }
  }
  async function leave(c: CupSummary) {
    busy = c.id;
    try {
      await leaveCup(c.id);
      forgetCup(c.id);
      patch(c.id, (x) => ({ ...x, uids: x.uids.filter((u) => u !== me), entries: Math.max(0, x.entries - 1) }));
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = '';
    }
  }
  async function adminDo(c: CupSummary, what: 'start' | 'cancel') {
    if (!confirm(what === 'cancel' ? $t('cups.confirmCallOff', { name: c.name }) : $t('cups.confirmStart', { name: c.name }))) return;
    try {
      await (what === 'start' ? startCup(c.id) : cancelCup(c.id));
      if (what === 'start') await goto(`/cups/${c.id}`);
      else patch(c.id, (x) => ({ ...x, status: 'cancelled' }));
    } catch (e) {
      error = (e as Error).message;
    }
  }
  // A private test cup (owner, 2026-10-23: "arrange one tournament for me to test"): its link to share.
  let tMin = $state(3);
  let tInc = $state(0);
  let tIn = $state(10);
  let made = $state<{ id: string; startAt: number }[]>([]);
  async function makeTest() {
    error = '';
    try {
      made = [await testCup(tMin, tInc, tIn), ...made];
    } catch (e) {
      error = (e as Error).message;
    }
  }
  // An on-demand cup for everyone (owner, 2026-10-23: "in case I see a lot of players online, put one tournament on
  // the home page and all players can join it").
  const FLASH = [
    { minutes: 1, inc: 1, label: 'Bullet 1+1' },
    { minutes: 2, inc: 1, label: 'Bullet 2+1' },
    { minutes: 3, inc: 0, label: 'Blitz 3+0' },
    { minutes: 3, inc: 2, label: 'Blitz 3+2' },
    { minutes: 5, inc: 0, label: 'Blitz 5+0' },
  ];
  let fTc = $state(2);
  let fIn = $state(10);
  async function makeFlash() {
    const tc = FLASH[fTc];
    if (!confirm(`Put a ${tc.label} cup on Home for everyone, starting in ${fIn} minutes?`)) return;
    error = '';
    try {
      await flashCup(tc.minutes, tc.inc, fIn);
      error = `${tc.label} is on Home now, starting in ${fIn} minutes.`;
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function wipe() {
    if (!confirm('Wipe every cup played so far (results, champions)? This cannot be undone.')) return;
    try {
      const r = await resetCups();
      error = `Wiped ${r.wiped.length} cups.`;
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function switchCups(on: boolean) {
    try {
      const res = await fetch(`${API}/cup/switch`, { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not switch.');
      if (today) today = { ...today, off: !on };
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<svelte:head>
  <title>Castle Cups · Chess Castles</title>
  <meta name="description" content="Chess Castles' own tournaments every evening: Bullet and Blitz, real kids, podium prizes for every group." />
</svelte:head>

<div class="page">
  <header class="hero">
    <div class="trophy" aria-hidden="true">🏆</div>
    <div>
      <h1>Castle Cups <span class="newtag">{$t('nav.new')}</span></h1>
      <p class="lead">{$t('cups.lead')}</p>
    </div>
  </header>

  {#if today?.off}<p class="note">{$t('cups.off')}</p>{/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <section class="list" aria-label={$t('cups.todayH')}>
    <h2>{today && today.cups[0] && new Date(today.cups[0].startAt).toDateString() !== new Date(now).toDateString() ? $t('cups.tomorrowH') : $t('cups.todayH')}</h2>
    {#if !today}
      {#each [0, 1, 2, 3] as i (i)}<div class="skel"></div>{/each}
    {:else}
      {#each today.cups as c (c.id)}
        <CupCard cup={c} {now} {me} busy={busy === c.id} onjoin={() => join(c)} onleave={() => leave(c)} />
      {/each}
    {/if}
  </section>

  <section class="rules card">
    <h2>{$t('cups.howH')}</h2>
    <ul>
      <li>🕡 {$t('cups.rule.when')}</li>
      <li>♟ {$t('cups.rule.swiss')}</li>
      <li>🏅 {$t('cups.rule.groups')}</li>
      <li>📈 {$t('cups.rule.rated')}</li>
      <li>🤖 {$t('cups.rule.computer')}</li>
      <li>⏱ {$t('cups.rule.stay')}</li>
      <li>🛡️ {$t('cups.rule.fair')}</li>
    </ul>
  </section>

  {#if today?.champions.length}
    <section class="champs card">
      <h2>{$t('cups.champsH')}</h2>
      <ul>
        {#each today.champions as c (c.id)}
          <li>
            <span class="cn">{c.name} · {new Date(c.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</span>
            <span class="pod">{#each c.podium as p, i (i)}<span>{['🥇', '🥈', '🥉'][i]} {p.name} <small>({p.score})</small></span>{/each}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if admin && today}
    <section class="card admin">
      <h2>🔒 Admin</h2>
      <p class="muted">{$t('cups.adminOnly')}</p>
      <ul class="adm">
        {#each today.cups.filter((c) => c.status === 'open' || c.status === 'running') as c (c.id)}
          <li>
            <span>{c.name} · {c.entries} 👥</span>
            {#if c.status === 'open'}<button class="btn small" onclick={() => adminDo(c, 'start')}>{$t('cups.startNow')}</button>{/if}
            <button class="btn small ghost danger" onclick={() => adminDo(c, 'cancel')}>{$t('cups.callOff')}</button>
          </li>
        {/each}
      </ul>
      <h3>On-demand cup (everyone)</h3>
      <p class="muted">Many kids online? Put one more cup on Home: everyone can join, computer players fill the field, awards as in the day's cups.</p>
      <div class="tc">
        <span class="presets">
          {#each FLASH as f, i (f.label)}<button class="btn small" class:primary={fTc === i} aria-pressed={fTc === i} onclick={() => (fTc = i)}>{f.label}</button>{/each}
        </span>
        <span class="presets">
          Starts in
          {#each [5, 10, 15, 30] as m (m)}<button class="btn small" class:primary={fIn === m} aria-pressed={fIn === m} onclick={() => (fIn = m)}>{m} min</button>{/each}
        </span>
        <button class="btn primary" onclick={makeFlash}>Put it on Home</button>
      </div>
      <h3>Test cup (private)</h3>
      <p class="muted">Only people with its link can join; not on Home, no awards. Start it with "Start now" on its page, or it starts by itself.</p>
      <div class="tc">
        <label>Minutes <input type="number" min="1" max="30" bind:value={tMin} /></label>
        <label>+ seconds <input type="number" min="0" max="30" bind:value={tInc} /></label>
        <label>Starts in (min) <input type="number" min="1" max="1440" bind:value={tIn} /></label>
        <button class="btn primary" onclick={makeTest}>Make a test cup</button>
      </div>
      {#each made as m (m.id)}
        <p class="made">🔗 <a href="/cups/{m.id}">chesscastles.com/cups/{m.id}</a> · starts {new Date(m.startAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>
      {/each}
      <h3>Cups on or off</h3>
      {#if today.off}<button class="btn primary" onclick={() => switchCups(true)}>{$t('cups.turnOn')}</button>
      {:else}<button class="btn" onclick={() => switchCups(false)}>{$t('cups.turnOff')}</button>{/if}
      <h3>Wipe old cups</h3>
      <button class="btn ghost danger" onclick={wipe}>Wipe every cup played so far</button>
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hero {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 18px;
    border-radius: 20px;
    background:
      radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, var(--gold) 26%, transparent), transparent 60%),
      linear-gradient(135deg, color-mix(in srgb, #ef4444 14%, var(--card)), var(--card));
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--border));
  }
  .trophy {
    font-size: 54px;
    animation: bob 3s ease-in-out infinite;
  }
  @keyframes bob {
    50% {
      transform: translateY(-5px) rotate(-4deg);
    }
  }
  h1 {
    margin: 0;
    font: 800 28px var(--font-title);
  }
  .newtag {
    font: 800 11px var(--font-body);
    vertical-align: middle;
    color: #1b1300;
    background: var(--gold);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .lead {
    margin: 4px 0 0;
    color: var(--muted);
  }
  h2 {
    margin: 0 0 8px;
    font: 800 18px var(--font-title);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .skel {
    height: 74px;
    border-radius: 16px;
    background: var(--raised);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.5;
    }
  }
  .card {
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .rules ul,
  .champs ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rules li {
    line-height: 1.4;
  }
  .champs li {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cn {
    font-size: 12.5px;
    color: var(--muted);
    font-weight: 700;
  }
  .pod {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    font-weight: 700;
  }
  .pod small {
    color: var(--muted);
  }
  .note {
    margin: 0;
    padding: 10px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--gold) 14%, var(--raised));
  }
  .err {
    margin: 0;
    color: var(--loss);
    font-weight: 700;
  }
  .muted {
    color: var(--muted);
  }
  .tc {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-end;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
  }
  .tc label {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    font-weight: 700;
  }
  .tc input {
    width: 90px;
  }
  .made {
    margin: 6px 0 0;
    word-break: break-all;
  }
  .adm {
    list-style: none;
    margin: 8px 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .adm li {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .adm li span {
    flex: 1;
    font-weight: 700;
  }
  .danger {
    color: var(--loss);
  }
  @media (prefers-reduced-motion: reduce) {
    .trophy,
    .skel {
      animation: none;
    }
  }
</style>
