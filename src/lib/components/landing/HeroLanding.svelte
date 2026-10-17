<script lang="ts">
  /**
   * The landing: what visitors see first (home when not signed in, and
   * /features for ads). Everything a chess site has, plus the five features
   * only Chess Castles has.
   */
  import Board from '$lib/components/Board.svelte';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import FeatureArt from './FeatureArt.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { track } from '$lib/analytics';
  import { FIDE_DISCLAIMER, HERO_FEATURES } from '$lib/heroFeatures';
  import { PLAN_INFO, launchOn, planSettings } from '$lib/plans';

  /** `closing`: end with the "Every pawn can become a Queen" call (the /features page). */
  let { closing = true }: { closing?: boolean } = $props();
  /** The Scholar's mate threat, the first trap every student meets. */
  const FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const shapes = [{ orig: 'h5' as const, dest: 'f7' as const, brush: 'green' }];
  const launch = $derived($planSettings.launch);

  const EVERYTHING: { icon: IconName; title: string; text: string; href: string }[] = [
    { icon: 'globe', title: 'Play online', text: 'Quick pairing, lobby and friends', href: '/play?mode=online' },
    { icon: 'puzzle', title: 'Puzzles', text: 'Daily puzzle and 17 themes', href: '/puzzles' },
    { icon: 'analyse', title: 'Analysis board', text: 'Engine, import, board editor', href: '/analysis' },
    { icon: 'watch', title: 'Watch live', text: 'Top events and friends’ games', href: '/watch' },
    { icon: 'trophy', title: 'Tournaments', text: 'FIDE tournaments and arenas', href: '/play/tournament' },
    { icon: 'eye', title: 'Vision Gym', text: 'Blindfold training', href: '/vision' },
    { icon: 'book', title: 'Chess classics', text: 'Read and listen', href: '/books' },
    { icon: 'star', title: 'Leaderboards', text: 'CC Rating, puzzles, study', href: '/leaderboard' },
  ];
  const go = (id: string) => track('feature', `landing_${id}`);
</script>

<div class="landing">
  <section class="hero">
    <div class="copy">
      <p class="eyebrow">Learn · Play · Conquer</p>
      <h1 class="display">Everything chess. <span class="gold">Plus five things you won’t find anywhere else.</span></h1>
      <p class="sub">Play online, solve puzzles, analyse and watch the world’s best live, all free. Then go further with five features built only for Chess Castles.</p>
      <div class="ctas">
        <a class="btn primary big" href="/play?mode=fide" onclick={() => go('hero_play')}><Icon name="play" size={18} fill color="currentColor" />Play a FIDE-rated opponent<sup>*</sup></a>
        {#if $session.status !== 'in'}
          <button class="btn big" onclick={() => (go('hero_signin'), startSignIn())}>Sign in free</button>
        {/if}
      </div>
      {#if launchOn(launch) && $session.status !== 'in'}
        <p class="offer"><PlanBadge plan={launch.plan} size={22} /><span><strong>Launch offer:</strong> {PLAN_INFO[launch.plan].name} free for {launch.days} days. No card needed.</span></p>
      {/if}
      <ul class="trust" aria-label="Chess Castles in numbers">
        <li><strong class="num">5.4M</strong><span>tournament games</span></li>
        <li><strong class="num">3,865</strong><span>openings</span></li>
        <li><strong class="num">1000–2800</strong><span>FIDE-rated opponents*</span></li>
      </ul>
    </div>
    <div class="visual" aria-hidden="true">
      <div class="board-wrap">
        <Board fen={FEN} {shapes} viewOnly coordinates={false} label="A chess position" />
      </div>
      <div class="float f1"><span class="dot"></span>FIDE 1800 · thinking…</div>
      <div class="float f2"><span class="bang">#</span>Mate in one</div>
      <div class="float f3"><Icon name="coach" size={16} color="var(--accent)" />Guru: the f7 square is weak!</div>
    </div>
  </section>

  <section class="only" aria-labelledby="only-h">
    <header class="sec-head">
      <p class="eyebrow"><Icon name="sparkle" size={14} color="var(--accent)" /> Only on Chess Castles</p>
      <h2 id="only-h" class="display">Five features no other chess site gives you</h2>
    </header>
    <div class="bento">
      {#each HERO_FEATURES as f, i (f.id)}
        <a class="feat card" class:wide={i === 0} href={f.href} onclick={() => go(f.id)}>
          <div class="art-box"><FeatureArt id={f.id} /></div>
          <div class="feat-text">
            <span class="num-tag num">0{i + 1}</span>
            <h3 class="title">{f.title}{f.id === 'fide' ? '*' : ''}</h3>
            <p>{f.promise}</p>
            <ul class="facts">{#each f.facts as x (x)}<li>{x}</li>{/each}</ul>
            <span class="go">{f.cta} <Icon name="chevron" size={16} /></span>
          </div>
        </a>
      {/each}
    </div>
  </section>

  <p class="disclaimer label">* {FIDE_DISCLAIMER}</p>

  <section class="all" aria-labelledby="all-h">
    <header class="sec-head">
      <p class="eyebrow">And everything you expect</p>
      <h2 id="all-h" class="display">One place for all your chess</h2>
    </header>
    <div class="tiles">
      {#each EVERYTHING as e (e.href)}
        <a class="tile card" href={e.href}>
          <span class="ic"><Icon name={e.icon} size={22} color="var(--accent)" /></span>
          <span class="tt"><strong>{e.title}</strong><span class="label">{e.text}</span></span>
        </a>
      {/each}
    </div>
  </section>

  {#if closing}
  <section class="close card">
    <div class="pieces" aria-hidden="true">
      <PlanBadge plan="pawn" size={40} /><PlanBadge plan="bishop" size={44} /><PlanBadge plan="rook" size={48} /><PlanBadge plan="queen" size={56} />
    </div>
    <h2 class="display">Every pawn can become a Queen.</h2>
    <p>Start free today. Your castle is waiting.</p>
    <div class="ctas center">
      {#if $session.status !== 'in'}<button class="btn primary big" onclick={() => (go('close_signin'), startSignIn())}>Start free</button>{/if}
      <a class="btn big" href="/plans">See plans</a>
    </div>
  </section>
  {/if}
</div>

<style>
  .landing {
    display: flex;
    flex-direction: column;
    gap: 56px;
    margin-bottom: 32px;
  }
  .eyebrow {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    font-weight: 800;
    font-size: 12.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  /* ---- hero */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 40px;
    align-items: center;
    padding: 28px 0 0;
  }
  h1 {
    margin: 12px 0 14px;
    font-size: clamp(32px, 4.4vw, 54px);
    line-height: 1.05;
    letter-spacing: -0.01em;
  }
  .gold {
    background: linear-gradient(100deg, #f7d27a, #edb040 45%, #c98a1b);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  :global([data-theme='light']) .gold {
    background: linear-gradient(100deg, #b07a1c, #8a5a12);
    -webkit-background-clip: text;
    background-clip: text;
  }
  .sub {
    margin: 0;
    font-size: clamp(16px, 1.4vw, 19px);
    color: var(--text-2);
    max-width: 560px;
  }
  .ctas {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 22px;
  }
  .ctas.center {
    justify-content: center;
  }
  .ctas .btn {
    gap: 8px;
  }
  .offer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 0;
    font-size: 14.5px;
    color: var(--text-2);
  }
  .trust {
    list-style: none;
    display: flex;
    gap: 28px;
    flex-wrap: wrap;
    margin: 26px 0 0;
    padding: 0;
  }
  .trust li {
    display: flex;
    flex-direction: column;
  }
  .trust strong {
    font-size: 22px;
    color: var(--text);
  }
  .trust span {
    font-size: 13px;
    color: var(--muted);
  }
  .visual {
    position: relative;
    padding: 18px 26px;
  }
  .board-wrap {
    border-radius: 14px;
    overflow: hidden;
    box-shadow:
      0 30px 60px -20px rgba(0, 0, 0, 0.55),
      0 0 0 1px var(--border);
    transform: perspective(1200px) rotateY(-6deg) rotateX(3deg);
  }
  .float {
    position: absolute;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 13px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.5);
    font-weight: 700;
    font-size: 13.5px;
    white-space: nowrap;
    animation: bob 5s ease-in-out infinite;
  }
  .f1 {
    top: 0;
    left: 0;
  }
  .f2 {
    top: 64%;
    right: 0;
    animation-delay: -1.6s;
  }
  .f3 {
    bottom: 0;
    left: 8%;
    animation-delay: -3.2s;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--win);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--win) 25%, transparent);
  }
  .bang {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #a855f7;
    color: #fff;
    font-size: 12px;
    font-weight: 900;
  }
  @keyframes bob {
    50% {
      transform: translateY(-6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .float {
      animation: none;
    }
  }
  /* ---- the five */
  .sec-head {
    text-align: center;
    margin-bottom: 22px;
  }
  .sec-head h2 {
    margin: 8px 0 0;
    font-size: clamp(26px, 3vw, 38px);
  }
  .bento {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
  .feat {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    color: var(--text);
    text-decoration: none;
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
    background:
      radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%),
      var(--card);
    transition:
      transform 0.18s ease,
      border-color 0.18s ease,
      box-shadow 0.18s ease;
  }
  .feat:hover {
    transform: translateY(-3px);
    border-color: var(--accent);
    box-shadow: 0 18px 40px -18px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .feat.wide {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    gap: 28px;
    padding: 24px 28px;
  }
  .feat.wide .art-box {
    flex: 0 1 420px;
  }
  .feat.wide .feat-text {
    flex: 1;
  }
  .feat.wide h3 {
    font-size: 26px;
  }
  .feat.wide p {
    font-size: 16px;
    max-width: 560px;
  }
  .art-box {
    border-radius: 12px;
    padding: 12px;
    background: color-mix(in srgb, var(--bg) 60%, transparent);
    border: 1px solid var(--border-soft);
  }
  .feat-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .num-tag {
    font-size: 13px;
    font-weight: 900;
    color: var(--accent);
    letter-spacing: 0.08em;
  }
  .feat h3 {
    margin: 0;
    font-size: 20px;
    line-height: 1.2;
  }
  .feat p {
    margin: 0;
    color: var(--text-2);
    font-size: 14.5px;
  }
  .facts {
    list-style: none;
    padding: 0;
    margin: 2px 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .facts li {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--border-soft);
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-top: 4px;
    font-weight: 800;
    color: var(--accent);
  }
  .disclaimer {
    margin: -36px auto 0;
    max-width: 820px;
    text-align: center;
    font-size: 12.5px;
  }
  /* ---- everything else */
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    color: var(--text);
    text-decoration: none;
  }
  .tile:hover {
    border-color: var(--accent);
  }
  .ic {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex: none;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .tt {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .tt .label {
    font-size: 12.5px;
  }
  /* ---- closing */
  .close {
    text-align: center;
    padding: 36px 20px;
    border: 1px solid var(--accent);
    background:
      radial-gradient(80% 120% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%),
      var(--card);
  }
  .pieces {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 10px;
  }
  .close h2 {
    margin: 16px 0 6px;
    font-size: clamp(26px, 3vw, 36px);
  }
  .close p {
    margin: 0;
    color: var(--text-2);
  }
  @media (max-width: 1200px) {
    .bento {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 1100px) {
    .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 860px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
    }
    .visual {
      max-width: 440px;
      margin: 0 auto;
      width: 100%;
    }
  }
  @media (max-width: 640px) {
    .landing {
      gap: 40px;
    }
    .bento {
      grid-template-columns: minmax(0, 1fr);
    }
    .feat.wide {
      grid-column: auto;
      flex-direction: column;
      align-items: stretch;
    }
    .tiles {
      grid-template-columns: minmax(0, 1fr);
    }
    .trust {
      gap: 18px;
    }
    .float {
      font-size: 12px;
      padding: 7px 10px;
    }
  }
</style>
