<script lang="ts">
  import { AGES, NEW_BOOKS_LIVE, WHO, isAge, isWho, type AgeGroup, type Who } from '$lib/book/profiles';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import GameHistory from '$lib/components/GameHistory.svelte';
  import OnlinePanel from '$lib/components/OnlinePanel.svelte';
  import MaiaCard from '$lib/components/MaiaCard.svelte';
  import { START_FEN } from '$lib/chess/position';
  import { TIME_CONTROLS, TIME_CONTROL_ORDER, tcLabel } from '$lib/game/fideGame';
  import { LEVELS, OPENINGS } from '$lib/openings';
  import { kfideAll } from '$lib/stores/me';
  import { SPEED_LABEL, kfideText, speedOf } from '$lib/kfide';
  import { PLAN_INFO, PLANS_ON, RANK, currentPlan, hasGate, planSettings, requireGate } from '$lib/plans';

  type Mode = 'fide' | 'online' | 'computer';
  type ColorChoice = 'white' | 'random' | 'black';

  let mode = $state<Mode>('fide');
  /** First visit: 1200, a friendly level for a child; then the last one chosen. */
  let rating = $state(1400);
  /** The player's own FIDE rating (0: not given). */
  let tc = $state(2);
  let color = $state<ColorChoice>('random');
  let opening = $state('');
  let level = $state(1);
  let computerClock = $state(false);
  /** Who the FIDE-level opponent plays like (when the newer books are live). */
  let who = $state<Who>('any');
  let ageGroup = $state<AgeGroup>('any');
  let openingMenu = $state(false);

  const KEY = 'k24.playSetup';
  onMount(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (s.mode) mode = s.mode;
      if (s.rating) rating = Math.min(2800, Math.max(1400, s.rating));
      if (Number.isInteger(s.tc)) tc = Math.min(TIME_CONTROLS.length - 1, Math.max(0, s.tc));
      if (s.color) color = s.color;
      if (Number.isInteger(s.level)) level = s.level;
      if (typeof s.computerClock === 'boolean') computerClock = s.computerClock;
      if (isWho(s.who)) who = s.who;
      if (isAge(s.age)) ageGroup = s.age;
    } catch {
      /* first visit */
    }
    const m = page.url.searchParams.get('mode');
    if (m === 'computer' || m === 'fide' || m === 'online') mode = m;
  });

  // While everything is free (PLANS_ON off) hasGate lets everyone choose it.
  const openingIncluded = $derived(!PLANS_ON || RANK[$currentPlan] >= RANK[$planSettings.config.gates.bot_opening]);
  const chosenOpening = $derived(openingIncluded ? OPENINGS.find((o) => o.id === opening) : undefined);

  function start() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode, rating, tc, color, level, computerClock, who, age: ageGroup }));
    } catch {
      /* private mode */
    }
    const side = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
    if (mode === 'fide') {
      // The opponent plays against your CC Rating at this speed (once you have one).
      const mine = $kfideAll[speedOf(tcLabel(TIME_CONTROLS[tc]))];
      const me = mine.games ? `&me=${mine.rating}` : '';
      // Choosing the bot's opening comes with Premium and up.
      const o = opening && hasGate('bot_opening') ? `&o=${opening}` : '';
      const prof = NEW_BOOKS_LIVE ? `${who !== 'any' ? `&who=${who}` : ''}${ageGroup !== 'any' ? `&age=${ageGroup}` : ''}` : '';
      goto(`/play/fide?r=${rating}&tc=${tc}&c=${side}${me}${o}${prof}`);
    } else {
      goto(`/play/computer?l=${LEVELS[level].elo}&c=${side}${computerClock ? `&tc=${tc}` : ''}`);
    }
  }
</script>

<svelte:head><title>Play · Chess Castles</title></svelte:head>

<div class="play-page">
<div class="play">
  <div class="preview">
    <Board fen={START_FEN} viewOnly label="Starting position" />
  </div>

  <section class="setup panel" aria-label="Game setup">
    <div class="segmented" role="group" aria-label="Opponent">
      <button aria-pressed={mode === 'fide'} onclick={() => (mode = 'fide')}>FIDE-rated</button>
      <button aria-pressed={mode === 'online'} onclick={() => (mode = 'online')}>Online</button>
      <button aria-pressed={mode === 'computer'} onclick={() => (mode = 'computer')}>Computer</button>
    </div>

    {#if mode === 'online'}
      <OnlinePanel onfide={() => (mode = 'fide')} />
      <a class="promo" href="/play/lichess-tournaments">
        <span class="promo-icon">🏆</span>
        <span class="promo-text"><strong>Arena tournaments</strong><span class="label">Live arenas, starting every hour</span></span>
        <Icon name="chevron" color="var(--muted)" />
      </a>
    {:else}

    {#if mode === 'fide'}
      <div class="group">
        <h2 class="title h">Opponent rating</h2>
        <div class="rating">
          <span class="display rating-num num">{rating}</span>
          <span class="title fide">FIDE</span>
          <span class="grow"></span>
          <button class="icon-btn" aria-label="25 lower" disabled={rating <= 1400} onclick={() => (rating -= 25)}>−</button>
          <button class="icon-btn" aria-label="25 higher" disabled={rating >= 2800} onclick={() => (rating += 25)}>+</button>
        </div>
        <label class="slider">
          <span class="sr-only">Opponent rating</span>
          <input type="range" min="1400" max="2800" step="25" bind:value={rating} />
        </label>
        <div class="chips">
          {#each [1400, 1600, 1800, 2000, 2200, 2500] as r (r)}
            <button class="chip" aria-pressed={rating === r} onclick={() => (rating = r)}>{r}</button>
          {/each}
        </div>
        <p class="fide-note">A computer opponent in the style of a FIDE {rating} player. Not affiliated with FIDE.</p>
      </div>
      <MaiaCard ready="" quiet fallback="a simpler opponent" />
    {:else}
      <div class="group">
        <h2 class="title h">Level</h2>
        <div class="levels">
          {#each LEVELS as l, i (l.elo)}
            <button class="tile" aria-pressed={level === i} onclick={() => (level = i)}>
              <span class="title">{l.name}</span>
              <span class="label">{l.elo >= 3190 ? 'Full strength' : `about ${l.elo}`}</span>
            </button>
          {/each}
        </div>
        <label class="toggle">
          <input type="checkbox" bind:checked={computerClock} />
          <span>Play with a clock</span>
        </label>
      </div>
    {/if}

    {#if mode === 'fide' || computerClock}
      <div class="group">
        <h2 class="title h">Time control</h2>
        <div class="tcs">
          {#each TIME_CONTROL_ORDER as i (i)}
            {@const t = TIME_CONTROLS[i]}
            <button class="tile" aria-pressed={tc === i} onclick={() => (tc = i)}>
              <span class="title num">{tcLabel(t)}</span>
              <span class="label">{t.kind}</span>
            </button>
          {/each}
        </div>
        {#if mode === 'fide'}
          {@const sp = speedOf(tcLabel(TIME_CONTROLS[tc]))}
          <p class="mine-cc">Your {SPEED_LABEL[sp]} CC Rating <strong class="num">{kfideText($kfideAll[sp])}</strong></p>
          {#if TIME_CONTROLS[tc].kind === 'Bullet'}
            <!-- Bullet is decided by quick hands as much as by chess: worth saying to a student before they lose on time. -->
            <p class="bullet-note">Bullet is a race against the clock: your opponent plays at your speed, but every second counts. To learn and enjoy the game, 10+0 or 15+10 works best.</p>
          {/if}
        {/if}
      </div>
    {/if}

    <div class="two">
      <div class="group">
        <h2 class="title h">You play</h2>
        <div class="segmented" role="group" aria-label="Your colour">
          <button aria-pressed={color === 'white'} onclick={() => (color = 'white')} aria-label="White"><span class="disc w"></span><span class="cl">White</span></button>
          <button aria-pressed={color === 'random'} onclick={() => (color = 'random')} aria-label="Random"><span class="disc r"></span><span class="cl">Random</span></button>
          <button aria-pressed={color === 'black'} onclick={() => (color = 'black')} aria-label="Black"><span class="disc b"></span><span class="cl">Black</span></button>
        </div>
      </div>
      {#if mode === 'fide'}
        <div class="group opening-pick">
          <h2 class="title h">Opening</h2>
          <button class="select" aria-expanded={openingMenu} onclick={() => (openingMenu = !openingMenu)}>
            <span>{chosenOpening?.name ?? 'Any'}</span>
            {#if !openingIncluded}<span class="lockchip"><Icon name="lock" size={12} />{PLAN_INFO[$planSettings.config.gates.bot_opening].name}</span>{/if}
            <Icon name="chevron" size={16} />
          </button>
        </div>
      {/if}
    </div>

    {#if mode === 'fide' && NEW_BOOKS_LIVE}
      <!-- Who the opponent plays like: for a girls' or an age-group tournament. -->
      <div class="two">
        <div class="group">
          <h2 class="title h">Plays like</h2>
          <div class="segmented" role="group" aria-label="Plays like">
            {#each WHO as w (w.id)}<button aria-pressed={who === w.id} onclick={() => (who = w.id)}>{w.label}</button>{/each}
          </div>
        </div>
        <div class="group">
          <h2 class="title h">Age group</h2>
          <div class="segmented" role="group" aria-label="Age group">
            {#each AGES as a (a.id)}<button aria-pressed={ageGroup === a.id} onclick={() => (ageGroup = a.id)}>{a.label}</button>{/each}
          </div>
        </div>
      </div>
    {/if}

    {#if openingMenu && mode === 'fide'}
      <div class="openings" role="listbox" aria-label="Opening to prepare against">
        <button role="option" aria-selected={!opening} onclick={() => ((opening = ''), (openingMenu = false))}>
          <span class="title">Any opening</span><span class="label">Varied, like real games</span>
        </button>
        {#each OPENINGS as o (o.id)}
          <button
            role="option"
            aria-selected={opening === o.id}
            onclick={() => {
              openingMenu = false;
              if (requireGate('bot_opening')) opening = o.id;
            }}
          >
            <span class="title">{o.name}</span><span class="label">{o.sans}</span>
          </button>
        {/each}
      </div>
    {/if}

    <button class="btn primary big block start-cta" onclick={start}>
      <Icon name="play" size={18} fill color="currentColor" />
      {mode === 'fide' ? `Play ${rating} · ${tcLabel(TIME_CONTROLS[tc])}` : `Play ${LEVELS[level].name}`}
    </button>

    {#if mode === 'fide'}
      <a class="promo" href="/play/tournament">
        <span class="promo-icon">🏆</span>
        <span class="promo-text"><strong>Play a FIDE tournament</strong><span class="label">5 to 10 computer opponents, standings and trophies</span></span>
        <Icon name="chevron" color="var(--muted)" />
      </a>
    {/if}
    {/if}
  </section>
</div>

<div class="history-wrap">
  <GameHistory limit={10} />
</div>
</div>

<style>
  .fide-note {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .promo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 10%, transparent);
    color: var(--text);
    text-decoration: none;
  }
  .promo-icon {
    font-size: 30px;
  }
  .promo-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .play-page {
    max-width: 1180px;
    margin: 0 auto;
  }
  .history-wrap {
    margin-top: 28px;
  }
  .play {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
    max-width: 1180px;
    margin: 12px auto 0;
    align-items: flex-start;
  }
  .preview {
    flex: 1 1 420px;
    max-width: 620px;
    min-width: 0;
  }
  .setup {
    flex: 1 1 380px;
    max-width: 460px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .h {
    font-size: 16px;
    color: var(--accent);
  }
  .rating {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .rating-num {
    font-size: 58px;
  }
  .fide {
    color: var(--muted);
    margin-bottom: 8px;
  }
  .grow {
    flex: 1;
  }
  .rating .icon-btn {
    font-size: 22px;
    background: var(--raised);
  }
  .slider input {
    width: 100%;
    accent-color: var(--action);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .mine-cc {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--text-2);
  }
  .bullet-note {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13.5px;
    background: color-mix(in srgb, var(--gold) 12%, transparent);
    color: var(--text-2);
  }
  .mine-cc strong {
    color: var(--accent);
    margin-left: 4px;
  }
  .tcs,
  .levels {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 9px 4px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    cursor: pointer;
  }
  .tile .title {
    font-size: 18px;
  }
  .tile[aria-pressed='true'] {
    background: var(--action);
    border-color: var(--action);
    color: var(--on-action);
  }
  .tile[aria-pressed='true'] .label {
    color: color-mix(in srgb, var(--on-action) 80%, transparent);
  }
  .two {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .two > .group {
    flex: 1 1 160px;
  }
  .disc {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid var(--muted);
    vertical-align: middle;
  }
  .disc.w {
    background: #eef3ff;
  }
  .disc.b {
    background: #0e1525;
  }
  .disc.r {
    background: linear-gradient(90deg, #eef3ff 50%, #0e1525 50%);
  }
  .select {
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 12px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }
  .lockchip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
    margin-right: 6px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 18%, transparent);
  }
  .openings {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--r-control);
    background: var(--bg);
  }
  .openings button {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 14px;
    border: 0;
    border-bottom: 1px solid var(--border-soft);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .openings button:hover,
  .openings button[aria-selected='true'] {
    background: var(--raised);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    font-weight: 600;
  }
  .toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--action);
  }
  .cl {
    margin-left: 6px;
    font-size: 13.5px;
  }
  @media (max-width: 767px) {
    .preview {
      display: none;
    }
    /* The Play button stays in reach above the tab bar while the settings scroll. */
    .start-cta {
      position: sticky;
      bottom: calc(76px + env(safe-area-inset-bottom));
      z-index: 5;
      box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.6);
    }
    .setup {
      max-width: none;
    }
  }
</style>
