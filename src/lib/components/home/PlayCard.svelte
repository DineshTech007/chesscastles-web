<script lang="ts">
  /**
   * The home page's first card: a game in one tap (owner's request, 2026-10-21: "a playing portal", as on
   * chess.com). Four clocks to pick from and Play: an opponent at the player's level ("Match my level" once their
   * CC Rating at that speed means something, else the level they last chose, else a friendly one for a child).
   * The Play page keeps every other choice (rating, colour, opening, the computer, online).
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { t } from '$lib/i18n';
  import { TIME_CONTROLS, tcLabel } from '$lib/game/fideGame';
  import { clampLevel, FIRST_LEVEL, levelName, matchLevel } from '$lib/game/levels';
  import { speedOf } from '$lib/kfide';
  import { kfideAll } from '$lib/stores/me';

  let { compact = false }: { compact?: boolean } = $props();

  /** TIME_CONTROLS' positions: 1+0, 5+0, 10+0, 15+10. */
  const CLOCKS: { tc: number; name: string; kind: string; icon: IconName }[] = [
    { tc: 6, name: '1 min', kind: 'Bullet', icon: 'flame' },
    { tc: 0, name: '5 min', kind: 'Blitz', icon: 'puzzle' },
    { tc: 1, name: '10 min', kind: 'Blitz', icon: 'history' },
    { tc: 2, name: '15+10', kind: 'Rapid', icon: 'history' },
  ];
  const KEY = 'k24.playSetup';
  let tc = $state(2);
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

  const mine = $derived($kfideAll[speedOf(tcLabel(TIME_CONTROLS[tc]))]);
  const level = $derived(mine.games >= 5 ? matchLevel(mine.rating) : saved.rating ? clampLevel(saved.rating) : FIRST_LEVEL);
  const clock = $derived(CLOCKS.find((c) => c.tc === tc)!);

  function play() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      localStorage.setItem(KEY, JSON.stringify({ ...s, mode: 'fide', tc }));
    } catch {
      /* private mode */
    }
    const c = saved.color === 'white' || saved.color === 'black' ? saved.color : Math.random() < 0.5 ? 'white' : 'black';
    void goto(`/play/fide?r=${level}&tc=${tc}&c=${c}${mine.games ? `&me=${mine.rating}` : ''}`);
  }
</script>

<section class="play-card" class:compact aria-labelledby="pc-h">
  <img class="art" src="/art/play.webp" alt="" width="243" height="256" />
  <div class="head">
    <h2 id="pc-h" class="display">{$t('home.play.h')}</h2>
    <p class="lvl">{$t('home.play.level', { level: levelName(level) })}</p>
  </div>

  <div class="clocks" role="radiogroup" aria-label={$t('home.play.clock')}>
    {#each CLOCKS as c (c.tc)}
      <button role="radio" aria-checked={tc === c.tc} class:on={tc === c.tc} onclick={() => (tc = c.tc)}>
        <Icon name={c.icon} size={16} />
        <strong class="num">{c.name}</strong>
        <span>{c.kind}</span>
      </button>
    {/each}
  </div>

  <button class="go" onclick={play}><Icon name="play" size={20} />{$t('home.play.go', { tc: clock.name })}</button>

  <nav class="other" aria-label={$t('home.play.other')}>
    <a href="/friends"><Icon name="users" size={16} />{$t('home.play.friend')}</a>
    <a href="/play?mode=online"><Icon name="globe" size={16} />{$t('home.play.online')}</a>
    <a href="/play/tournament"><Icon name="trophy" size={16} />{$t('home.play.tournament')}</a>
    <a href="/play"><Icon name="dots" size={16} />{$t('home.play.more')}</a>
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
  /* Tall enough that the clocks start below the picture. */
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
  .clocks {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .clocks button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 8px 2px 7px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    background: color-mix(in srgb, currentColor 6%, transparent);
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }
  .clocks button:active {
    transform: scale(0.97);
  }
  .clocks strong {
    font-size: 15.5px;
    white-space: nowrap;
  }
  .clocks span {
    font-size: 11.5px;
    opacity: 0.7;
  }
  .clocks button.on {
    background: color-mix(in srgb, var(--gold) 22%, transparent);
    border-color: var(--gold);
  }
  .clocks button.on :global(svg) {
    color: var(--gold);
  }
  .go {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 56px;
    border: 0;
    border-radius: 16px;
    background: linear-gradient(180deg, #f7cd62, #edb040 55%, #d99a24);
    box-shadow:
      0 6px 0 #b07816,
      0 12px 24px rgba(237, 176, 64, 0.28);
    color: #0b1426;
    font: inherit;
    font-family: var(--font-title);
    font-size: 21px;
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
    .clocks,
    .go,
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
