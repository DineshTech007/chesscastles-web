<script lang="ts">
  /**
   * The end of a game, over the board (owner's request, 2026-10-21): after a win, "You won!" with a trophy and a
   * burst of confetti; after a loss or a draw, Play again first, then three ways to learn from it: this game in the
   * analysis board, puzzles and lessons. Closing it leaves the board and the result as they were.
   */
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  type Side = { name: string; initials: string; photo?: string; rating?: string };
  let {
    outcome,
    onsignin,
    reason,
    me,
    opponent,
    ratingChange,
    againLabel = 'Play again',
    onagain,
    againHref,
    analyseHref,
    guruHref,
    harder,
    extra,
    onclose,
  }: {
    outcome: 'won' | 'lost' | 'draw';
    /** How it ended: "Checkmate", "Your opponent ran out of time"… */
    reason: string;
    me: Side;
    opponent: Side;
    /** A rated game: the new rating and how it moved. */
    ratingChange?: { label: string; after: number; delta: number };
    againLabel?: string;
    onagain?: () => void;
    /** Instead of `onagain`: a page to go to (a new online game, the tournament). */
    againHref?: string;
    analyseHref?: string;
    guruHref?: string;
    /** After a win: a stronger opponent to try next. */
    harder?: { label: string; href: string };
    /** More under the buttons (after three losses in a row: a slower game or a lower level). */
    extra?: Snippet;
    /** A visitor (not signed in): signing in keeps the game (owner's request, 2026-10-21: more visitors as members). */
    onsignin?: () => void;
    onclose: () => void;
  } = $props();

  const HEAD = { won: 'You won!', lost: 'You lost', draw: 'Draw' } as const;
  const ART = { won: 'trophy', lost: 'play', draw: 'friends' } as const;
  const COLORS = ['#f2c14e', '#edb040', '#38d2ff', '#22c55e', '#f472b6', '#ffffff', '#a78bfa'];
  // svelte-ignore state_referenced_locally
  const confetti =
    outcome === 'won'
      ? Array.from({ length: 36 }, (_, i) => ({
          x: 4 + Math.random() * 92,
          delay: Math.random() * 0.5,
          dur: 1.5 + Math.random() * 1.3,
          drift: (Math.random() - 0.5) * 80,
          spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
          w: 6 + Math.random() * 5,
          h: 8 + Math.random() * 8,
          c: COLORS[i % COLORS.length],
        }))
      : [];

  let box = $state<HTMLDivElement | undefined>();
  onMount(() => box?.focus());
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

{#snippet avatar(s: Side, mine: boolean)}
  <div class="side" class:mine>
    <span class="av">{#if s.photo}<img src={s.photo} alt="" />{:else}{s.initials}{/if}</span>
    <span class="nm">{s.name}</span>
    {#if mine && ratingChange}
      <span class="rt num">{ratingChange.label} {ratingChange.after}
        <b class:up={ratingChange.delta > 0} class:down={ratingChange.delta < 0}>{ratingChange.delta >= 0 ? '+' : ''}{ratingChange.delta}</b></span>
    {:else if s.rating}
      <span class="rt num">{s.rating}</span>
    {/if}
  </div>
{/snippet}

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="sheet {outcome}" role="dialog" aria-modal="true" aria-labelledby="go-h" tabindex="-1" bind:this={box}>
  {#if confetti.length}
    <div class="confetti" aria-hidden="true">
      {#each confetti as c, i (i)}
        <span style="left: {c.x}%; width: {c.w}px; height: {c.h}px; background: {c.c}; animation-delay: {c.delay}s; animation-duration: {c.dur}s; --drift: {c.drift}px; --spin: {c.spin}deg"></span>
      {/each}
    </div>
  {/if}
  <button class="x" onclick={onclose} aria-label="Close and look at the board"><Icon name="close" size={18} /></button>

  <div class="top">
    <img class="art" src="/art/{ART[outcome]}-256.webp" srcset="/art/{ART[outcome]}-256.webp 256w, /art/{ART[outcome]}.webp 512w" sizes="120px" alt="" width="120" height="120" />
    <h2 id="go-h" class="display head">{HEAD[outcome]}</h2>
    <p class="reason">{reason}</p>
  </div>

  <div class="vs">
    {@render avatar(me, true)}
    <span class="vs-x">vs</span>
    {@render avatar(opponent, false)}
  </div>

  <div class="actions">
    {#if againHref}
      <a class="btn primary again" href={againHref}><Icon name="replay" size={20} />{againLabel}</a>
    {:else if onagain}
      <button class="btn primary again" onclick={onagain}><Icon name="replay" size={20} />{againLabel}</button>
    {/if}

    {#if outcome === 'won'}
      <div class="two">
        {#if guruHref}<a class="btn" href={guruHref}><Icon name="coach" size={18} />Review with Guru</a>{/if}
        {#if analyseHref}<a class="btn" href={analyseHref}><Icon name="analyse" size={18} />Analyse</a>{/if}
      </div>
      {#if harder}<a class="harder" href={harder.href} data-sveltekit-reload>Ready for more? Play {harder.label}<Icon name="chevron" size={16} /></a>{/if}
    {:else}
      <p class="learn-h">{outcome === 'lost' ? 'Every game makes you stronger. Learn from this one:' : 'Learn from this game:'}</p>
      <div class="tiles">
        {#if analyseHref}
          <a class="tile" href={analyseHref}><span class="ic"><Icon name="analyse" size={20} /></span><strong>Analyse</strong><span class="t-sub">See where it turned</span></a>
        {/if}
        <a class="tile" href="/puzzles"><span class="ic"><Icon name="puzzle" size={20} /></span><strong>Puzzles</strong><span class="t-sub">Sharpen your eye</span></a>
        <a class="tile" href="/learn"><span class="ic"><Icon name="learn" size={20} /></span><strong>Learn</strong><span class="t-sub">Lessons with Guru</span></a>
      </div>
      {#if guruHref}<a class="guru-link" href={guruHref}><Icon name="coach" size={16} />Review this game with Guru</a>{/if}
    {/if}
    {#if extra}{@render extra()}{/if}
    {#if onsignin}
      <div class="join">
        <p><strong>Keep this game.</strong> Sign in free: your games and rating stay in your account on every device, you climb the leaderboard and play your friends.</p>
        <button class="btn primary" onclick={onsignin}>Sign in free</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(5, 8, 20, 0.62);
    animation: fade 0.25s ease-out;
  }
  .sheet {
    --tone: var(--gold);
    position: fixed;
    z-index: 91;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(400px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 22px 18px 18px;
    border-radius: 22px;
    border: 1px solid color-mix(in srgb, var(--tone) 55%, var(--border));
    background:
      radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--tone) 22%, transparent), transparent 70%),
      var(--card);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    outline: none;
    animation: pop 0.38s cubic-bezier(0.2, 1.2, 0.4, 1);
  }
  .sheet.lost {
    --tone: #7d8bb5;
  }
  .sheet.draw {
    --tone: var(--live);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translate(-50%, -46%) scale(0.9);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .x {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text) 8%, transparent);
    color: var(--text-2);
    cursor: pointer;
  }
  .top {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .art {
    width: 120px;
    height: 120px;
    object-fit: contain;
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.35));
  }
  .won .art {
    animation: rise 0.7s cubic-bezier(0.2, 1.3, 0.4, 1) 0.1s both;
  }
  .lost .art,
  .draw .art {
    width: 96px;
    height: 96px;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(18px) scale(0.6) rotate(-8deg);
    }
  }
  .head {
    margin: 6px 0 0;
    font-size: 42px;
    line-height: 1;
    color: var(--tone);
  }
  .won .head {
    background: linear-gradient(180deg, #ffe39a, #edb040 60%, #c98a1b);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  :global(:root[data-theme='light']) .won .head {
    background: none;
    color: var(--gold);
  }
  .reason {
    margin: 4px 0 0;
    color: var(--text-2);
    font-size: 15px;
  }
  .vs {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 12px 8px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }
  .vs-x {
    font-weight: 800;
    color: var(--muted);
    font-size: 13px;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 0;
    text-align: center;
  }
  .av {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: var(--raised);
    border: 2px solid var(--border);
    font-weight: 800;
    font-size: 15px;
  }
  .side.mine .av {
    border-color: var(--tone);
  }
  .av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .nm {
    max-width: 100%;
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rt {
    font-size: 12.5px;
    color: var(--text-2);
  }
  .rt b {
    margin-left: 2px;
  }
  .rt .up {
    color: var(--win);
  }
  .rt .down {
    color: var(--loss);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .again {
    min-height: 54px;
    font-size: 18px;
    gap: 8px;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .two .btn {
    gap: 6px;
    font-size: 14.5px;
    padding: 0 8px;
  }
  .harder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-weight: 700;
    color: var(--gold);
    text-decoration: none;
  }
  .learn-h {
    margin: 2px 0 0;
    text-align: center;
    font-size: 14px;
    color: var(--text-2);
  }
  .tiles {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 12px 6px 10px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    text-decoration: none;
    text-align: center;
  }
  .tile:hover {
    border-color: var(--gold);
  }
  .tile .ic {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(135deg, #f7d27a, #edb040 50%, #c98a1b);
    color: #0b1426;
    margin-bottom: 2px;
  }
  .tile strong {
    font-size: 14.5px;
  }
  .t-sub {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.25;
  }
  .guru-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-weight: 700;
    font-size: 14px;
    color: var(--gold);
    text-decoration: none;
  }
  .join {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px dashed color-mix(in srgb, var(--gold) 60%, var(--border));
    background: color-mix(in srgb, var(--gold) 8%, transparent);
  }
  .join p {
    flex: 1;
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
  }
  .join strong {
    color: var(--text);
  }
  .join .btn {
    flex: none;
  }
  .confetti {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    border-radius: inherit;
  }
  .confetti span {
    position: absolute;
    top: -16px;
    border-radius: 2px;
    opacity: 0;
    animation-name: fall;
    animation-timing-function: cubic-bezier(0.25, 0.6, 0.5, 1);
    animation-fill-mode: forwards;
  }
  @keyframes fall {
    0% {
      opacity: 1;
      transform: translate(0, 0) rotate(0);
    }
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--drift), 420px) rotate(var(--spin));
    }
  }
</style>
