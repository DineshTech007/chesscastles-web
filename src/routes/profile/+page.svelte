<script lang="ts">
  import { myName, setMyName } from '$lib/stores/me';
  import { page } from '$app/state';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { formatDate } from '$lib/format';
  import { KFIDE_PROVISIONAL, KFIDE_SPEEDS, SPEED_LABEL, kfideText, type KfideSpeed } from '$lib/kfide';
  import { kfide, kfideAll, myPhoto, photoSrc, savePhoto, shrinkPhoto, shownGames } from '$lib/stores/me';
  import RatingChart from '$lib/review/RatingChart.svelte';
  import AllTimeStats from '$lib/review/AllTimeStats.svelte';
  import { myGames } from '$lib/stores/myGames';
  import { FED_NAMES } from '$lib/fideFeds';
  import { fideSearch, displayName } from '$lib/api';
  import { myProfile, saveProfile, type Player } from '$lib/social';
  import { myCountry, setMyCountry } from '$lib/stores/me';
  import CoachWork from '$lib/components/CoachWork.svelte';
  import { PLAN_INFO, PLANS_ON, RANK, hasGate, myPlan, untilText } from '$lib/plans';

  let busy = $state(false);
  let message = $state('');
  let input: HTMLInputElement | undefined = $state();

  onMount(() => myGames.load());

  // The details others see (friends see everything; others see name, country, status and ratings).
  let details = $state<Player | undefined>();
  let form = $state({ name: '', first: '', last: '', location: '', country: 'IND', language: 'English', timezone: '', fideId: '', fideRating: 0, status: '', about: '' });
  let saving = $state(false);
  let savedNote = $state('');
  let fideNote = $state('');
  const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Assamese', 'Urdu', 'Konkani'];
  const zones = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      return ['Asia/Kolkata'];
    }
  })();
  const countries = Object.entries(FED_NAMES).sort((a, b) => a[1].localeCompare(b[1]));

  $effect(() => {
    if ($session.status !== 'in') return;
    myProfile()
      .then((p) => {
        details = p;
        if (p.country) setMyCountry(p.country);
        form = {
          name: p.name,
          first: p.first ?? '',
          last: p.last ?? '',
          location: p.location ?? '',
          country: p.country || 'IND',
          language: p.language || 'English',
          timezone: p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          fideId: p.fideId ?? '',
          fideRating: p.fideRating ?? 0,
          status: p.status ?? '',
          about: p.about ?? '',
        };
      })
      .catch(() => {});
  });

  async function lookUpFide() {
    fideNote = '';
    const id = form.fideId.trim();
    if (!/^\d{4,12}$/.test(id)) return;
    try {
      const p = (await fideSearch(id)).find((x) => x.fideId === id);
      if (!p) {
        fideNote = 'No FIDE player with that ID.';
        return;
      }
      form.fideRating = p.standard ?? p.rapid ?? p.blitz ?? 0;
      fideNote = `${p.title ? `${p.title} ` : ''}${displayName(p.name)} · Std ${p.standard ?? '—'} · Rapid ${p.rapid ?? '—'} · Blitz ${p.blitz ?? '—'}`;
    } catch {
      fideNote = "FIDE couldn't be reached right now.";
    }
  }

  async function saveDetails(e: Event) {
    e.preventDefault();
    saving = true;
    savedNote = '';
    try {
      const kfideTc = Object.fromEntries(KFIDE_SPEEDS.filter((s) => $kfideAll[s].games).map((s) => [s, { rating: $kfideAll[s].rating, games: $kfideAll[s].games }]));
      details = await saveProfile({ ...form, kfide: $kfide.rating, kfideGames: $kfide.games, kfideTc });
      if ($session.status === 'in') setMyName($session.uid, details.name);
      setMyCountry(form.country);
      savedNote = 'Saved.';
    } catch (err) {
      savedNote = err instanceof Error ? err.message : "Couldn't save. Try again.";
    } finally {
      saving = false;
    }
  }

  const name = $derived($session.status === 'in' ? $myName : 'You');
  const initials = $derived(name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase());
  /** The latest CC Rating games at every speed. */
  const recent = $derived(
    KFIDE_SPEEDS.flatMap((s) => $kfideAll[s].history.map((h) => ({ ...h, speed: s })))
      .sort((a, b) => b.at - a.at)
      .slice(0, 12),
  );
  /** The speed the rating chart shows: ?speed= from the home page's tiles, then the tile clicked. */
  let chartSpeed = $state<KfideSpeed | undefined>(KFIDE_SPEEDS.find((s) => s === page.url.searchParams.get('speed')));
  const SPEED_TCS: Record<KfideSpeed, string> = { standard: '60+0 · 90+30', rapid: '10+0 · 15+10 · 30+0', blitz: '5+0' };

  async function pick(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    busy = true;
    message = '';
    try {
      const b64 = await shrinkPhoto(file);
      if (!b64) {
        message = "That picture couldn't be used. Try a JPEG or PNG photo.";
        return;
      }
      await savePhoto(b64);
      message = $session.status === 'in' ? 'Photo saved to your Chess Castles account.' : 'Photo saved on this device.';
    } catch {
      message = "The photo couldn't be saved. Check your connection and try again.";
    } finally {
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    try {
      await savePhoto(undefined);
      message = 'Photo removed.';
    } catch {
      message = "The photo couldn't be removed. Try again.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Profile · Chess Castles</title></svelte:head>

<div class="page">
  <section class="card head">
    <div class="photo">
      {#if $myPhoto}
        <img src={photoSrc($myPhoto)} alt="Your profile" />
      {:else}
        <span class="initials display">{initials}</span>
      {/if}
    </div>
    <div class="who">
      <h1 class="display">{name}{#if $session.status === 'in'} <PlanBadge plan={$myPlan?.plan ?? 'free'} size={30} />{/if}</h1>
      <p class="label">
        {#if $session.status === 'in'}{$session.uid.startsWith('lichess:') ? `Signed in with Lichess as ${$session.username}` : 'Signed in with Google'}{:else}Not signed in: your photo and games stay on this device.{/if}
      </p>
      <div class="buttons">
        <input bind:this={input} id="photo-file" type="file" accept="image/*" hidden onchange={pick} />
        <button class="btn primary" disabled={busy} onclick={() => input?.click()}><Icon name="users" size={18} />{$myPhoto ? 'Change photo' : 'Add a photo'}</button>
        {#if $myPhoto}<button class="btn ghost" disabled={busy} onclick={remove}>Remove</button>{/if}
        {#if $session.status === 'out'}<button class="btn ghost" onclick={() => startSignIn()}>Sign in to keep it in your account</button>{/if}
      </div>
      {#if message}<p class="label msg" role="status">{message}</p>{/if}
      {#if $session.status !== 'in'}
        <label class="country-out">
          <span class="label">Country (for the flag next to your name)</span>
          <select id="pf-country-local" value={$myCountry} onchange={(e) => setMyCountry((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">None</option>
            {#each countries as [code, name] (code)}<option value={code}>{name}</option>{/each}
          </select>
        </label>
      {/if}
      <p class="label small">Your photo is shown only to you (it never appears on leaderboards). With an account, the app shows it too.</p>
    </div>
  </section>

  {#if $session.status === 'in'}
    <form class="card details" onsubmit={saveDetails}>
      <h2 class="title">Details</h2>
      {#if details}<p class="label">Joined {formatDate(details.joined)} · Lichess username {details.username}</p>{/if}
      <div class="grid">
        <label for="pf-name">Display name</label><input id="pf-name" bind:value={form.name} maxlength="24" required minlength="2" />
        <label for="pf-first">First name</label><input id="pf-first" bind:value={form.first} maxlength="40" />
        <label for="pf-last">Last name</label><input id="pf-last" bind:value={form.last} maxlength="40" />
        <label for="pf-location">Location</label><input id="pf-location" bind:value={form.location} maxlength="60" placeholder="City" />
        <label for="pf-country">Country</label>
        <select id="pf-country" bind:value={form.country}>{#each countries as [code, name] (code)}<option value={code}>{name}</option>{/each}</select>
        <label for="pf-language">Language</label>
        <select id="pf-language" bind:value={form.language}>{#each LANGUAGES as l (l)}<option value={l}>{l}</option>{/each}</select>
        <label for="pf-tz">Timezone</label>
        <select id="pf-tz" bind:value={form.timezone}>{#each zones as z (z)}<option value={z}>{z}</option>{/each}</select>
        <label for="pf-fide">FIDE ID</label>
        <div class="fide-row">
          <input id="pf-fide" bind:value={form.fideId} inputmode="numeric" maxlength="12" placeholder="e.g. 35009192" onchange={lookUpFide} />
          <span class="num label">{form.fideRating ? `FIDE ${form.fideRating}` : ''}</span>
        </div>
        {#if fideNote}<span></span><p class="label note">{fideNote}</p>{/if}
        <label for="pf-status">Status</label><input id="pf-status" bind:value={form.status} maxlength="100" placeholder="Your chess slogan, e.g. Always play for the win!" />
        <label for="pf-about">About me</label><textarea id="pf-about" bind:value={form.about} maxlength="1000" rows="5" placeholder="Your favourite openings, your chess goals, your club…"></textarea>
      </div>
      <div class="save-row">
        <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>
        {#if savedNote}<span class="label" role="status">{savedNote}</span>{/if}
      </div>
      <p class="label small">Everyone signed in sees your display name, country, status and ratings. Only your friends see your photo, name, location and “about me”.</p>
    </form>
  {/if}

  {#if !PLANS_ON && $session.status === 'in' && hasGate('coach_tools')}
    <section class="card plancard" aria-label="Coach tools">
      <div class="ptext"><h2 class="title">Coach tools</h2><span class="label">Your students' progress, games and the work you set them.</span></div>
      <div class="plinks"><a class="btn primary" href="/students">My students</a></div>
    </section>
  {:else if PLANS_ON && $session.status === 'in' && $myPlan}
    <section class="card plancard" aria-labelledby="plan-h">
      <PlanBadge plan={$myPlan.plan} size={46} />
      <div class="ptext">
        <h2 id="plan-h" class="title">{PLAN_INFO[$myPlan.plan].name} plan</h2>
        <span class="label">{$myPlan.until ? `Until ${untilText($myPlan.until)}` : 'Free forever'}{$myPlan.source === 'launch' ? ' · launch offer' : $myPlan.source === 'referral' ? ' · invite reward' : ''}</span>
      </div>
      <div class="plinks">
        {#if RANK[$myPlan.plan] >= RANK.elite}<a class="btn" href="/students">My students</a>{/if}
        <a class="btn primary" href="/plans">Plans and invites</a>
      </div>
    </section>
  {/if}
  <CoachWork manage />

  <section class="card kcard" id="cc-ratings" aria-labelledby="kfide-h">
    <h2 id="kfide-h" class="title">CC Ratings</h2>
    <div class="kspeeds">
      {#each KFIDE_SPEEDS as s (s)}
        {@const k = $kfideAll[s]}
        <a
          class="kspeed"
          class:main={$kfideAll.main === s && k.games > 0}
          class:shown={k.games > 0 && (chartSpeed ?? $kfideAll.main) === s}
          href={k.games ? `?speed=${s}#cc-ratings` : '/play?mode=fide'}
          onclick={(e) => {
            if (!k.games) return;
            e.preventDefault();
            chartSpeed = s;
          }}
        >
          <span class="ks-head"><span class="label">{SPEED_LABEL[s]}</span>{#if $kfideAll.main === s && k.games}<span class="main-tag">Main</span>{/if}</span>
          <strong class="display num">{k.games ? kfideText(k) : '—'}</strong>
          <span class="label">{k.games ? `${k.games} ${k.games === 1 ? 'game' : 'games'}` : `Not played yet · starts at ${k.rating}`}</span>
          <span class="label tcs">{SPEED_TCS[s]}</span>
        </a>
      {/each}
    </div>
    <RatingChart all={$kfideAll} bind:speed={chartSpeed} />
  </section>
  <AllTimeStats games={$shownGames} />
  <section class="ratings">
    {#if $session.status === 'in' && $session.profile}
      <a class="rating card" href="/puzzles"><span class="label">Puzzle rating</span><strong class="display num">{$session.profile.ratings.puzzle}</strong></a>
    {/if}
  </section>

  <section class="card about">
    <h2 class="title">What is the CC Rating?</h2>
    <p>Your CC Rating (CC = Chess Castles) goes up and down with your results against the FIDE-rated opponents (computer opponents) on the Play page, worked out the same way FIDE rates real games. Beat a stronger player and it climbs a lot; lose to a weaker one and it drops.</p>
    <p>Like FIDE, you have three: <strong>Classical</strong> (games of 60 minutes or more), <strong>Rapid</strong> (10 to 59 minutes) and <strong>Blitz</strong> (under 10 minutes), counting the minutes plus the increment. Each game changes only the rating for its speed, because most players are stronger at one speed than another. Your main CC Rating, shown next to your name, is the speed you play most.</p>
    <p>Each rating becomes steady after {KFIDE_PROVISIONAL} games at that speed (until then it shows a ?). If you give your own FIDE rating on the Play page, they all start from it; otherwise from 1500.</p>
    <a class="btn primary" href="/play?mode=fide"><Icon name="play" size={18} fill color="currentColor" />Play a FIDE-rated opponent</a>
  </section>

  {#if recent.length}
    <section class="card">
      <h2 class="title">Recent CC Rating games</h2>
      <ul class="hist">
        {#each recent as h (h.id)}
          <li>
            <span class="label">{formatDate(h.at)}</span>
            <span>vs FIDE {h.opponent} <span class="label">· {SPEED_LABEL[h.speed]}</span></span>
            <span class="res" class:win={h.score === 1} class:loss={h.score === 0}>{h.score === 1 ? 'Won' : h.score === 0 ? 'Lost' : 'Draw'}</span>
            <span class="num">{h.after}</span>
            <span class="num delta" class:up={h.after > h.before} class:down={h.after < h.before}>{h.after >= h.before ? '+' : ''}{h.after - h.before}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .plancard {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    flex-wrap: wrap;
  }
  .ptext {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .ptext h2 {
    margin: 0;
    font-size: 18px;
  }
  .plinks {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .page {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .card {
    padding: 18px 20px;
  }
  .head {
    display: flex;
    gap: 20px;
    align-items: center;
    flex-wrap: wrap;
  }
  .photo {
    width: 112px;
    height: 112px;
    border-radius: 50%;
    overflow: hidden;
    flex: none;
    background: #5a3a1c;
    display: grid;
    place-items: center;
    box-shadow: 0 0 0 3px var(--gold);
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .initials {
    color: #eef3ff;
    font-size: 40px;
  }
  .who {
    flex: 1;
    min-width: 240px;
  }
  h1 {
    margin: 0;
    font-size: 32px;
  }
  .who p {
    margin: 4px 0 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .msg {
    color: var(--text);
  }
  .small {
    font-size: 12.5px;
  }
  .country-out {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
    max-width: 320px;
  }
  .country-out select {
    font: inherit;
    padding: 8px 10px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
  }
  .details {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .details h2 {
    margin: 0;
    font-size: 20px;
  }
  .details p {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    gap: 10px 14px;
    align-items: center;
    max-width: 620px;
  }
  .grid label {
    font-weight: 600;
    font-size: 14px;
  }
  .grid input,
  .grid select,
  .grid textarea {
    font: inherit;
    padding: 9px 11px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
    min-width: 0;
    width: 100%;
  }
  .fide-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .save-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  @media (max-width: 560px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .kcard h2 {
    margin: 0 0 10px;
    font-size: 19px;
  }
  .kspeeds {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .kspeed {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--raised);
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }
  .kspeed.main {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 10%, var(--raised));
  }
  .kspeed strong {
    font-size: 34px;
  }
  .kspeed.main strong {
    color: var(--gold);
  }
  /* The speed the chart below shows. */
  .kspeed.shown {
    outline: 2px solid var(--series-1);
    outline-offset: 1px;
  }
  .ks-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .main-tag {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--gold);
    color: #1b1300;
  }
  .tcs {
    font-size: 12px;
  }
  @media (max-width: 560px) {
    .kspeeds {
      grid-template-columns: 1fr;
    }
  }
  .ratings {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .rating {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: inherit;
    text-decoration: none;
  }
  .rating:hover {
    border-color: var(--brand);
    text-decoration: none;
  }
  .rating strong {
    font-size: 34px;
  }
  .about h2,
  .card > h2 {
    margin: 0 0 8px;
    font-size: 19px;
  }
  .about p {
    margin: 0 0 12px;
    max-width: 65ch;
  }
  .hist {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .hist li {
    display: grid;
    grid-template-columns: 1.2fr 1.2fr 0.7fr 0.6fr 0.5fr;
    gap: 8px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
    align-items: center;
  }
  .res.win {
    color: var(--win);
  }
  .res.loss {
    color: var(--loss);
  }
  .delta {
    text-align: right;
    font-weight: 700;
  }
  .delta.up {
    color: var(--win);
  }
  .delta.down {
    color: var(--loss);
  }
</style>
