<script lang="ts">
  /**
   * The home page's first card: a game in two taps (owner's requests, 2026-10-21: "a playing portal", as on
   * chess.com; one Play button first, the clocks after it; no 1-minute games here, children learn more slower).
   * Play, then a clock: an opponent at the player's level ("Match my level" once their CC Rating at that speed
   * means something, else the level they last chose, else a friendly one for a child). The Play page keeps every
   * other choice (rating, colour, opening, bullet, the computer, online).
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { t } from '$lib/i18n';
  import { TIME_CONTROLS, tcLabel } from '$lib/game/fideGame';
  import { clampLevel, FIRST_LEVEL, levelName, matchLevel } from '$lib/game/levels';
  import { speedOf } from '$lib/kfide';
  import { kfideAll } from '$lib/stores/me';

  /** TIME_CONTROLS' positions: 5+0, 10+0, 15+10, 30+0. */
  const CLOCKS: { tc: number; name: string; kind: string; icon: IconName }[] = [
    { tc: 0, name: '5 min', kind: 'Blitz', icon: 'puzzle' },
    { tc: 1, name: '10 min', kind: 'Blitz', icon: 'history' },
    { tc: 2, name: '15+10', kind: 'Rapid', icon: 'history' },
    { tc: 3, name: '30 min', kind: 'Rapid', icon: 'history' },
  ];
  const KEY = 'k24.playSetup';
  /** The clock played last (it is marked among the choices); 15+10 the first time. */
  let tc = $state(2);
  let choosing = $state(false);
  let saved = $state<{ rating?: number; color?: string }>({});
  onMount(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (CLOCKS.some((c) => c.tc === s.tc)) tc = s.tc;
      saved = { rating: s.rating, color: s.color };
    } catch {
      /* first visit */
    }
  });

  const ccAt = (i: number) => $kfideAll[speedOf(tcLabel(TIME_CONTROLS[i]))];
  const levelAt = (i: number) => {
    const mine = ccAt(i);
    return mine.games >= 5 ? matchLevel(mine.rating) : saved.rating ? clampLevel(saved.rating) : FIRST_LEVEL;
  };

  function play(i: number) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      localStorage.setItem(KEY, JSON.stringify({ ...s, mode: 'fide', tc: i }));
    } catch {
      /* private mode */
    }
    const mine = ccAt(i);
    const c = saved.color === 'white' || saved.color === 'black' ? saved.color : Math.random() < 0.5 ? 'white' : 'black';
    void goto(`/play/fide?r=${levelAt(i)}&tc=${i}&c=${c}${mine.games ? `&me=${mine.rating}` : ''}`);
  }
</script>

<section class="play-card" aria-labelledby="pc-h">
  <img class="art" src="/art/play-256.webp" srcset="/art/play-256.webp 256w, /art/play.webp 512w" sizes="(min-width: 700px) 230px, 128px" alt="" width="243" height="256" fetchpriority="high" />
  <div class="head">
    <h2 id="pc-h" class="display">{$t('home.play.h')}</h2>
    <p class="lvl">{$t('home.play.level', { level: levelName(levelAt(tc)) })}</p>
  </div>

  {#if !choosing}
    <button class="go" onclick={() => (choosing = true)}><Icon name="play" size={20} />{$t('home.play.now')}</button>
  {:else}
    <div class="choose">
      <div class="choose-h">
        <span>{$t('home.play.choose')}</span>
        <button class="x" onclick={() => (choosing = false)} aria-label={$t('home.play.close')}><Icon name="close" size={16} /></button>
      </div>
      <div class="clocks" role="group" aria-label={$t('home.play.clock')}>
        {#each CLOCKS as c (c.tc)}
          <button class:on={tc === c.tc} onclick={() => play(c.tc)}>
            <Icon name={c.icon} size={18} />
            <strong class="num">{c.name}</strong>
            <span>{c.kind}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <nav class="other" aria-label={$t('home.play.other')}>
    <a href="/friends"><Icon name="users" size={16} />{$t('home.play.friend')}</a>
    <a href="/play?mode=online"><Icon name="globe" size={16} />{$t('home.play.online')}</a>
    <a href="/play/tournament"><Icon name="trophy" size={16} />{$t('home.play.tournament')}</a>
    <a href="/play"><Icon name="dots" size={16} /><span class="sr-only">{$t('home.play.h')}: </span>{$t('home.play.more')}</a>
  </nav>
</section>

<style>
  .play-card {
    container-type: inline-size;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 16px 14px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
    background:
      radial-gradient(80% 110% at 100% 0%, rgba(237, 176, 64, 0.26), transparent 62%),
      linear-gradient(165deg, #1b2d5c 0%, #121e3c 55%, #0d1730 100%);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
    color: #eef3ff;
  }
  :global(:root[data-theme='light']) .play-card {
    background:
      radial-gradient(80% 110% at 100% 0%, rgba(237, 176, 64, 0.3), transparent 62%),
      linear-gradient(165deg, #fffaf0 0%, #fff 60%);
    color: var(--text);
    box-shadow: 0 14px 34px rgba(13, 24, 48, 0.12);
  }
  .art {
    position: absolute;
    right: -6px;
    top: -4px;
    width: 128px;
    height: auto;
    pointer-events: none;
    filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.45));
  }
  /* Tall enough that what follows starts below the picture. */
  .head {
    padding-right: 120px;
    min-height: 102px;
  }
  .head h2 {
    margin: 0;
    font-size: 44px;
    line-height: 1;
  }
  .lvl {
    margin: 6px 0 0;
    font-size: 14.5px;
    color: color-mix(in srgb, currentColor 72%, transparent);
  }
  .go {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 58px;
    border: 0;
    border-radius: 16px;
    background: linear-gradient(180deg, #f7cd62, #edb040 55%, #d99a24);
    box-shadow:
      0 6px 0 #b07816,
      0 12px 24px rgba(237, 176, 64, 0.28);
    color: #0b1426;
    font: inherit;
    font-family: var(--font-title);
    font-size: 22px;
    font-weight: 800;
    cursor: pointer;
    margin-bottom: 6px;
    transition: transform 0.08s, box-shadow 0.08s;
  }
  .go:active {
    transform: translateY(4px);
    box-shadow:
      0 2px 0 #b07816,
      0 6px 14px rgba(237, 176, 64, 0.24);
  }
  .choose {
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: open 0.2s ease-out;
  }
  @keyframes open {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
  }
  .choose-h {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 700;
    font-size: 15px;
  }
  .x {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: color-mix(in srgb, currentColor 10%, transparent);
    color: inherit;
    cursor: pointer;
  }
  .clocks {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .clocks button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px 2px 10px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
    background: color-mix(in srgb, var(--gold) 12%, transparent);
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .clocks button:active {
    transform: scale(0.96);
  }
  .clocks button :global(svg) {
    color: var(--gold);
  }
  .clocks strong {
    font-size: 16px;
    white-space: nowrap;
  }
  .clocks span {
    font-size: 11.5px;
    opacity: 0.75;
  }
  /* The clock played last. */
  .clocks button.on {
    background: color-mix(in srgb, var(--gold) 28%, transparent);
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--gold);
  }
  .other {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }
  .other a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 2px;
    border-radius: 10px;
    color: inherit;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
    opacity: 0.88;
  }
  .other a:hover {
    background: color-mix(in srgb, currentColor 7%, transparent);
    text-decoration: none;
  }
  .other a :global(svg) {
    color: var(--gold);
  }
  /* A wide card (a tablet, a computer): the picture large on the right, the choices on the left. */
  @container (min-width: 640px) {
    .art {
      width: 230px;
      right: 28px;
      top: 50%;
      transform: translateY(-50%);
    }
    .head,
    .go,
    .choose,
    .other {
      max-width: calc(100% - 270px);
    }
    .head {
      padding-right: 0;
      min-height: 0;
    }
    .head h2 {
      font-size: 52px;
    }
  }
</style>
