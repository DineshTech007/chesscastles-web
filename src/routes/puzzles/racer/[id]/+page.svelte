<script lang="ts">
  /**
   * A Puzzle Racer race (src/lib/racer): the waiting room (who's in, the link to share, a friend to challenge), the
   * start lights, the race (the board, my score, the clock, the combo, my place, every car on the track), and the
   * flag: the podium, my place, a new best, and every puzzle to look at again.
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer } from '$lib/classroom/api';
  import Board from '$lib/components/Board.svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import Fireworks from '$lib/components/Fireworks.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import RushReview, { type RushPuzzle } from '$lib/puzzles/RushReview.svelte';
  import { puzzleSounds } from '$lib/puzzles/puzzleSounds';
  import type { BandPuzzle } from '$lib/puzzles/bank';
  import { POINTS, study } from '$lib/study/progress';
  import { friendsList, type Player } from '$lib/social';
  import { inviteToBattle } from '$lib/invites';
  import { track } from '$lib/analytics';
  import { CARS, newRace, preload, puzzleAt, quickRace, raceLink, type CarView } from '$lib/racer/api';
  import { Race } from '$lib/racer/race.svelte';
  import { racerStats, racerTitle, recordRace } from '$lib/racer/stats';
  import TitleLadder from '$lib/racer/TitleLadder.svelte';
  import Track from '$lib/racer/Track.svelte';
  import Car from '$lib/racer/Car.svelte';
  import StartLights from '$lib/racer/StartLights.svelte';
  import ComboBar from '$lib/racer/ComboBar.svelte';
  import ChatDock from '$lib/chat/ChatDock.svelte';
  import EmojiBurst from '$lib/chat/EmojiBurst.svelte';
  import { t } from '$lib/i18n';
  import { RACER_ERRORS } from '$lib/i18n/features/racer';

  const id = $derived(page.params.id ?? '');
  const signedIn = $derived($session.status === 'in' || !!devPlayer());
  let race = $state<Race | undefined>();

  // The race's puzzles, one at a time.
  let idx = $state(0);
  let current = $state<BandPuzzle | undefined>();
  let round = $state(0);
  let loading = false;
  let log = $state<RushPuzzle[]>([]);
  let flash = $state<'ok' | 'bad' | undefined>();
  let reviewing = $state<number | undefined>();

  $effect(() => {
    if (!signedIn || !id || race?.id === id) return;
    race?.close();
    race = new Race(id);
    idx = 0;
    current = undefined;
    log = [];
    recorded = false;
    newBest = false;
    reviewing = undefined;
  });
  onDestroy(() => race?.close());
  // Local tests look at the race (developer's computer only).
  $effect(() => {
    if (import.meta.env.DEV && race) (window as unknown as { __race: Race }).__race = race;
  });

  const info = $derived(race?.info);
  const phase = $derived(info?.phase ?? 'lobby');
  const me = $derived(race?.mine);
  const humans = $derived((race?.cars ?? []).filter((c) => !c.bot));

  async function load(i: number) {
    const slots = race?.info?.slots;
    if (!slots || loading) return;
    loading = true;
    try {
      const p = await puzzleAt(slots, i);
      if (!p) return;
      current = p;
      idx = i;
      round++;
      preload(slots, i + 2, 6);
    } finally {
      loading = false;
    }
  }
  // The first puzzle as soon as the race is known (or, back mid-race, the one I'm on).
  $effect(() => {
    if (!info || current) return;
    preload(info.slots, 0, 10);
    void load(me?.at ?? 0);
  });

  function onresult(ok: boolean, _wrong: number, miss?: { ply: number; uci: string }) {
    if (phase !== 'racing' || !current || !race) return;
    race.solve(idx, ok);
    log = [...log, { id: current[0], fen: current[1], moves: current[2].split(' '), r: current[3], ok, miss }];
    flash = ok ? 'ok' : 'bad';
    setTimeout(() => (flash = undefined), 350);
    if (ok) {
      puzzleSounds.star(Math.min(3, 1 + Math.floor((me?.combo ?? 0) / 5)));
      study.log('puzzle', POINTS.puzzleSolved, 'Puzzle Racer');
    } else puzzleSounds.missed();
    setTimeout(() => phase === 'racing' && void load(idx + 1), ok ? 120 : 450);
  }

  // The clock.
  let now = $state(Date.now());
  const tick = setInterval(() => (now = race?.now() ?? Date.now()), 200);
  onDestroy(() => clearInterval(tick));
  const left = $derived(info?.endAt ? Math.max(0, Math.ceil((info.endAt - now) / 1000)) : 0);
  const clock = $derived(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
  const lobbyLeft = $derived(info?.startAt ? Math.max(0, Math.ceil((info.startAt - 4000 - now) / 1000)) : 0);
  let lastTick = 0;
  $effect(() => {
    if (phase === 'racing' && left <= 10 && left > 0 && left !== lastTick) {
      lastTick = left;
      puzzleSounds.tick();
    }
  });

  // The flag: my result, kept once.
  let recorded = false;
  let newBest = $state(false);
  const final = $derived(race?.final);
  const myPlace = $derived(final ? final.findIndex((c) => c.uid === race!.me) + 1 : 0);
  const myFinal = $derived(final?.find((c) => c.uid === race!.me));
  $effect(() => {
    if (!final || recorded || !myFinal || !info) return;
    recorded = true;
    newBest = recordRace(myFinal.score, myPlace, final.length, info.duel) && myFinal.score > 0;
    if (myPlace === 1 && final.length > 1) puzzleSounds.levelUp();
    else puzzleSounds.solved();
    track('feature', info.duel ? 'battle_finish' : 'racer_finish');
  });

  // Sharing and challenging.
  let copied = $state(false);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(raceLink(id));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      prompt($t('racer.room.linkPrompt'), raceLink(id));
    }
  }
  const waText = $derived($t(info?.duel ? 'racer.room.waBattle' : 'racer.room.waRace', { link: raceLink(id) }));
  let friends = $state<Player[]>([]);
  /** Invites sent (when): after 15 seconds an invite can go again (the friend missed or lost the popup). */
  let invited = $state<Record<string, { state: 'sent' | 'error'; at: number }>>({});
  $effect(() => {
    if (!info || info.open || phase !== 'lobby' || $session.status !== 'in') return;
    friendsList().then(
      (r) => (friends = r.friends.sort((a, b) => Number(b.online) - Number(a.online)).slice(0, 12)),
      () => {},
    );
  });
  async function challenge(p: Player) {
    try {
      await inviteToBattle(p.uid, id);
      invited = { ...invited, [p.uid]: { state: 'sent', at: Date.now() } };
    } catch {
      invited = { ...invited, [p.uid]: { state: 'error', at: Date.now() } };
    }
  }

  let going = $state(false);
  async function nextRace() {
    if (going || !info) return;
    going = true;
    try {
      if (info.open) {
        const r = await quickRace();
        await goto(`/puzzles/racer/${r.id}`);
      } else {
        const r = await newRace({ seconds: info.seconds, duel: info.duel });
        // A rematch: the other player gets the invite at once.
        const other = info.duel ? final?.find((c) => c.uid !== race!.me && !c.bot) : undefined;
        if (other) void inviteToBattle(other.uid, r.id).catch(() => {});
        await goto(`/puzzles/racer/${r.id}`);
      }
    } catch (e) {
      const m = (e as Error).message;
      alert(RACER_ERRORS[m] ? $t(RACER_ERRORS[m]) : m);
    } finally {
      going = false;
    }
  }
  const ordinal = (n: number) => (n === 1 ? $t('racer.place.1') : n === 2 ? $t('racer.place.2') : n === 3 ? $t('racer.place.3') : $t('racer.place.n', { n }));
  const podium = $derived(final ? [final[1], final[0], final[2]] : []);
  const title = $derived(info?.duel ? 'Puzzle Battle' : 'Puzzle Racer');
</script>

<svelte:head><title>{title} · Chess Castles</title></svelte:head>

{#snippet who(c: CarView)}
  <span class="who-name">{c.uid === race?.me ? $t('racer.you') : c.name}{c.bot ? ' 🤖' : ''}</span>
{/snippet}

<div class="page">
  <header class="head">
    <a class="back" href="/puzzles/racer"><Icon name="back" size={16} />Puzzle Racer</a>
    <h1 class="display">{info?.duel ? '⚔️ Puzzle Battle' : '🏁 Puzzle Racer'}</h1>
  </header>

  {#if !signedIn}
    <div class="card pad center">
      <p>{$t('racer.room.signIn')}</p>
      <button class="btn primary" onclick={() => startSignIn()}>{$t('racer.room.signInBtn')}</button>
    </div>
  {:else if race?.error}
    <div class="card pad center">
      <p class="big-msg">🏁 {RACER_ERRORS[race.error] ? $t(RACER_ERRORS[race.error]) : race.error}</p>
      <button class="btn primary" onclick={nextRace} disabled={going}>{$t('racer.room.joinQuick')}</button>
    </div>
  {:else if !info}
    <div class="card pad center"><p class="muted">{$t('racer.room.loading')}</p></div>
  {:else}
    <div class="arena" class:over={phase === 'over'} style="--lanes: {Math.max(2, race?.cars.length ?? 2)}">
      <div class="boardwrap" class:ok={flash === 'ok'} class:bad={flash === 'bad'}>
        {#if phase === 'racing' && current}
          {#key round}
            <PuzzleBoard fen={current[1]} moves={current[2].split(' ')} tries={1} {onresult} premoves />
          {/key}
        {:else if current}
          <Board fen={current[1]} viewOnly coordinates={false} label={$t('racer.room.firstPuzzle')} />
        {:else}
          <div class="skel"></div>
        {/if}
        {#if phase === 'lights'}<StartLights startAt={info.startAt} now={() => race!.now()} />{/if}
        {#if phase === 'lobby'}
          <div class="veil">
            {#if me}
              <Car car={me.car} size={150} />
              <p class="drive">{$t('racer.room.drive')} <b>{CARS[me.car % CARS.length].name}</b>{$t('racer.room.driveEnd')}</p>
            {/if}
          </div>
        {/if}
        {#if phase === 'over'}
          <div class="veil flagged"><span class="flagbig">🏁</span></div>
        {/if}
      </div>

      <aside class="panel card">
        {#if phase === 'lobby'}
          {#if info.open}
            <h2>{$t('racer.room.joining')}</h2>
            <p class="lcd num">{lobbyLeft}</p>
            <p class="muted">{$t('racer.room.lightsIn', { n: lobbyLeft })}</p>
          {:else if info.duel}
            <h2>{$t('racer.room.waitFriend')}</h2>
            <p class="muted">{$t('racer.room.battleStarts', { n: info.seconds })}</p>
          {:else}
            <h2>{$t('racer.withFriends')}</h2>
            <p class="muted">{$t(humans.length === 1 ? 'racer.room.in1' : 'racer.room.inN', { n: humans.length })} {info.owner === race?.me ? $t('racer.room.ownerHint') : $t('racer.room.guestHint')}</p>
            {#if info.owner === race?.me}<button class="btn primary big go" onclick={() => race?.start()}>{$t('racer.room.start')}</button>{/if}
          {/if}
          {#if !info.open}
            <div class="share">
              <button class="btn" onclick={copyLink}><Icon name="copy" size={16} />{copied ? $t('racer.room.copied') : $t('racer.room.copy')}</button>
              <a class="btn wa" href="https://wa.me/?text={encodeURIComponent(waText)}" target="_blank" rel="noopener">WhatsApp</a>
            </div>
            {#if friends.length}
              <h3>{$t('racer.challengeFriend')}</h3>
              <div class="friends">
                {#each friends as f (f.uid)}
                  {@const inv = invited[f.uid]}
                  {@const again = !inv || now - inv.at > 15_000}
                  <button class="friend" onclick={() => challenge(f)} disabled={!again}>
                    <span class="dot" class:on={f.online}></span>{f.name}
                    <span class="state">{!inv ? (f.online ? $t('racer.room.online') : '') : inv.state === 'error' ? (again ? $t('racer.room.tryAgain') : $t('racer.room.couldNot')) : again ? $t('racer.room.inviteAgain') : $t('racer.room.invited')}</span>
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        {:else if phase === 'lights'}
          <h2>{$t('racer.room.getReady')}</h2>
          <p class="muted">{$t('racer.room.solveMany', { n: info.seconds })}</p>
        {:else if phase === 'racing'}
          <div class="hud">
            <div class="scorebox"><span class="flagmini">🏁</span><span class="lcd num">{me?.score ?? 0}</span></div>
            <div class="side">
              <span class="clock num" class:low={left <= 10}>⏱ {clock}</span>
              <span class="place">{ordinal(race?.rank ?? 1)} <span class="muted">{$t('racer.room.of', { n: race?.cars.length ?? 0 })}</span></span>
            </div>
          </div>
          <ComboBar combo={me?.combo ?? 0} />
          {#if current}<p class="muted small">{$t('racer.room.puzzleInfo', { n: idx + 1, r: current[3] })}</p>{/if}
        {:else if final && myFinal}
          <div class="result">
            {#if myPlace === 1 && final.length > 1}<Fireworks rockets={5} />{/if}
            <p class="done">{info.duel ? (myPlace === 1 ? $t('racer.room.wonBattle') : $t('racer.room.battleOver')) : $t('racer.room.raceDone')}</p>
            <p class="placebig">{['🥇', '🥈', '🥉'][myPlace - 1] ?? '🏅'} {ordinal(myPlace)} <span class="muted">{$t('racer.room.of', { n: final.length })}</span></p>
            <p class="lcd num">{myFinal.score}</p>
            <p class="muted">{$t('racer.room.solvedMissed', { solved: myFinal.solved, missed: myFinal.tried - myFinal.solved })}</p>
            {#if newBest}<p class="best">{$t('racer.room.newBest')}</p>{:else}<p class="muted small">{$t('racer.room.yourBest', { n: $racerStats.best })}</p>{/if}
            {#if racerTitle($racerStats.best)}<span class="rtitle">🏎️ {racerTitle($racerStats.best)}</span>{/if}
            <div class="podium" aria-label={$t('racer.room.podium')}>
              {#each podium as c, i (c?.uid ?? i)}
                {#if c}
                  <div class="step s{i === 1 ? 1 : i === 0 ? 2 : 3}" class:mine={c.uid === race?.me}>
                    <Car car={c.car} size={i === 1 ? 74 : 60} />
                    {@render who(c)}
                    <span class="pts num">{c.score}</span>
                    <span class="block">{i === 1 ? 1 : i === 0 ? 2 : 3}</span>
                  </div>
                {/if}
              {/each}
            </div>
            <TitleLadder best={$racerStats.best} size={34} />
            <button class="btn primary big go" onclick={nextRace} disabled={going}>{info.open ? $t('racer.room.next') : info.duel ? $t('racer.room.rematch') : $t('racer.room.again')}</button>
            <a class="lb" href="/leaderboard#racer">{$t('racer.room.lb')}</a>
          </div>
        {/if}
      </aside>
    </div>

    <div class="trackwrap">
      <Track cars={race?.cars ?? []} me={race?.me ?? ''} {phase} seconds={info.seconds} chat={race?.chat ?? []} {now} />
      <EmojiBurst lines={race?.chat ?? []} me={race?.me ?? ''} />
    </div>
    {#if race}
      <div class="chatrow">
        <ChatDock lines={race.chat} me={race.me} guard={race.guard} onsend={(k, v) => race?.say(k, v)} note={phase === 'lobby' ? $t('racer.room.sayHi') : ''} />
      </div>
    {/if}

    {#if phase === 'over' && log.length}
      <section class="card pad review">
        <h3>{$t('racer.room.yourPuzzles')}</h3>
        <p class="muted small">{$t('racer.room.tapOne')}</p>
        <ol class="chips">
          {#each log as x, i (i)}<li class:ok={x.ok}><button onclick={() => (reviewing = i)}>{x.r}</button></li>{/each}
        </ol>
      </section>
    {/if}
  {/if}
</div>

{#if reviewing !== undefined && log[reviewing]}
  <RushReview list={log} bind:at={reviewing} onclose={() => (reviewing = undefined)} />
{/if}

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 14px;
    flex-wrap: wrap;
  }
  .head h1 {
    margin: 0;
    font-size: clamp(24px, 4vw, 32px);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .pad {
    padding: 16px 18px;
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .big-msg {
    font: 700 18px var(--font-title);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
  }
  .arena {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 12px;
    align-items: start;
  }
  .boardwrap {
    position: relative;
    border-radius: 12px;
    transition: box-shadow 0.2s;
    /* Small enough that the track stays on a laptop's screen, whatever the number of cars. */
    max-width: min(620px, max(360px, calc(100dvh - 190px - var(--lanes) * 42px)));
    width: 100%;
    justify-self: center;
  }
  .boardwrap.ok {
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.8);
  }
  .boardwrap.bad {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.85);
    animation: shake 0.3s;
  }
  @keyframes shake {
    25% {
      transform: translateX(-5px);
    }
    75% {
      transform: translateX(5px);
    }
  }
  .skel {
    aspect-ratio: 1;
    border-radius: 12px;
    background: var(--raised);
  }
  .veil {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(10, 14, 24, 0.72);
    border-radius: 12px;
    backdrop-filter: blur(2px);
  }
  .drive {
    font: 600 18px var(--font-title);
    color: #e9edf6;
  }
  .flagged {
    background: rgba(10, 14, 24, 0.5);
  }
  .flagbig {
    font-size: 90px;
    animation: wave 1s ease-in-out infinite alternate;
  }
  @keyframes wave {
    from {
      transform: rotate(-10deg);
    }
    to {
      transform: rotate(10deg);
    }
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    position: relative;
    overflow: hidden;
  }
  .panel h2 {
    margin: 0;
    font: 700 20px var(--font-title);
  }
  .panel h3 {
    margin: 4px 0 0;
    font: 700 15px var(--font-title);
  }
  .lcd {
    margin: 0;
    font: 800 64px/1 'Barlow Condensed', var(--font-display);
    color: #ffb84d;
    text-shadow: 0 0 18px rgba(255, 160, 40, 0.55);
    letter-spacing: 0.02em;
  }
  .hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .scorebox {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .flagmini {
    font-size: 34px;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .clock {
    font: 800 24px var(--font-title);
  }
  .clock.low {
    color: var(--loss);
    animation: pulse 0.6s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    to {
      transform: scale(1.1);
    }
  }
  .place {
    font: 800 18px var(--font-title);
    color: var(--gold);
  }
  .go {
    width: 100%;
  }
  .share {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .wa {
    background: #25d366;
    color: #06240f;
    border-color: #25d366;
    font-weight: 800;
  }
  .friends {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 220px;
    overflow: auto;
  }
  .friend {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: 600 14px var(--font-body);
    cursor: pointer;
    text-align: left;
  }
  .friend:disabled {
    cursor: default;
    opacity: 0.8;
  }
  .friend .state {
    margin-left: auto;
    font-size: 12px;
    color: var(--muted);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
  }
  .dot.on {
    background: var(--win);
  }
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }
  .done {
    margin: 0;
    font: 800 22px var(--font-title);
  }
  .placebig {
    margin: 0;
    font: 800 28px var(--font-title);
    color: var(--gold);
  }
  .best {
    margin: 0;
    font: 800 18px var(--font-title);
    color: var(--win);
    animation: pulse 0.7s ease-in-out infinite alternate;
  }
  .podium {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: end;
    gap: 6px;
    width: 100%;
    margin: 8px 0;
  }
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .who-name {
    font: 700 12px var(--font-body);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .step.mine .who-name {
    color: var(--gold);
  }
  .pts {
    font: 800 15px var(--font-title);
    color: #ffb84d;
  }
  .block {
    width: 100%;
    display: grid;
    place-items: center;
    border-radius: 8px 8px 0 0;
    font: 900 22px var(--font-display);
    color: #0b1426;
  }
  .s1 .block {
    height: 64px;
    background: linear-gradient(180deg, #ffe08a, #edb040);
  }
  .s2 .block {
    height: 46px;
    background: linear-gradient(180deg, #eef2f7, #aab4c3);
  }
  .s3 .block {
    height: 34px;
    background: linear-gradient(180deg, #f3c39a, #c98a5b);
  }
  .rtitle {
    font: 800 13px var(--font-body);
    padding: 3px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    color: var(--gold);
  }
  .lb {
    font-weight: 700;
    font-size: 14px;
  }
  .trackwrap {
    position: relative;
  }
  .chatrow {
    max-width: 560px;
    width: 100%;
  }
  .review h3 {
    margin: 0;
    font: 700 16px var(--font-title);
  }
  .chips {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chips li {
    border-radius: 7px;
    background: var(--loss);
  }
  .chips li.ok {
    background: var(--win);
  }
  .chips button {
    border: 0;
    background: transparent;
    color: #fff;
    font: 800 12px var(--font-body);
    padding: 5px 8px;
    cursor: pointer;
  }
  /* Phones: the score and clock first, then the board, then the track. */
  @media (max-width: 860px) {
    .arena {
      grid-template-columns: 1fr;
    }
    .panel {
      order: -1;
      padding: 10px 12px;
    }
    .arena.over .panel {
      order: 0;
    }
    .lcd {
      font-size: 48px;
    }
    .boardwrap {
      max-width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flagbig,
    .best,
    .clock.low,
    .boardwrap.bad {
      animation: none;
    }
  }
</style>
