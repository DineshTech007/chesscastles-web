<script lang="ts">
  /** For parents: is it safe, what does it cost, how does my child start. */
  import Icon from '$lib/components/Icon.svelte';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { PLAN_INFO, PLANS_ON, launchOn, planSettings } from '$lib/plans';

  const launch = $derived($planSettings.launch);
  const SAFE = [
    { icon: 'users', title: 'Messages only between friends', text: 'Two players can message each other only after both have agreed to be friends. There is no chat with strangers, in games or anywhere else.' },
    { icon: 'eye', title: 'Photos stay private', text: 'A profile photo is shown only to friends. Players are shown by the display name they choose.' },
    { icon: 'flag', title: 'Block and report', text: 'Anyone can be removed or blocked at once, and any player can be reported. Reports are read by the Chess Castles team.' },
    { icon: 'shield', title: 'No advertising', text: 'Chess Castles shows no ads and never sells data. We don’t track children’s behaviour for advertising.' },
    { icon: 'lock', title: 'Your data, your choice', text: 'You can see, correct or delete your child’s data at any time by writing to us. We follow India’s data protection law (DPDP Act).' },
    { icon: 'trophy', title: 'Fair play', text: 'Games are checked for cheating, so your child plays fair games and their progress is real.' },
  ] as const;
</script>

<svelte:head>
  <title>For parents · Chess Castles</title>
  <meta name="description" content="Chess Castles for parents: a safe place for children to learn and play chess. Messages only between friends, no ads, a free plan, clear prices in rupees and a 7-day refund." />
</svelte:head>

<div class="page">
  <header class="hero card">
    <p class="eyebrow">For parents</p>
    <h1 class="display">A safe place for your child to learn chess</h1>
    <p class="sub">Lessons with Chess Guru in English, Hindi or Marathi, puzzles, games against opponents at your child’s level, and a weekly plan, without strangers, ads or surprises.</p>
    <div class="ctas">
      {#if $session.status !== 'in'}<button class="btn primary big" onclick={() => startSignIn()}>Create a free account</button>{/if}
      <a class="btn big" href="/play?mode=fide">Let my child play now</a>
    </div>
    <p class="label">Your child can start playing without an account. An account (sign in with Google) keeps their games and progress.</p>
  </header>

  <section aria-labelledby="safe-h">
    <h2 id="safe-h" class="title">Is it safe for my child?</h2>
    <div class="grid">
      {#each SAFE as s (s.title)}
        <div class="card item">
          <span class="ic"><Icon name={s.icon} size={20} color="var(--accent)" /></span>
          <div><strong>{s.title}</strong><p>{s.text}</p></div>
        </div>
      {/each}
    </div>
  </section>

  <section class="card block" aria-labelledby="cost-h">
    <h2 id="cost-h" class="title">What does it cost?</h2>
    {#if !PLANS_ON}
    <ul>
      <li><strong>Everything is free right now</strong>: games, puzzles, lessons, Game Review, Insights, books and the analysis board, with no daily limits and no payments.</li>
      <li>Nobody can be charged: there is nothing to buy.</li>
    </ul>
    {:else}
    <ul>
      <li><PlanBadge plan="free" size={18} /> <strong>{PLAN_INFO.free.name} is free</strong>, for ever: games, puzzles, lessons, books and the analysis board, with a few daily limits.</li>
      {#if launchOn(launch)}
        <li><PlanBadge plan={launch.plan} size={18} /> <strong>Launch offer:</strong> every new account gets {PLAN_INFO[launch.plan].name} free for {launch.days} days. No card is asked for.</li>
      {/if}
      <li>Paid plans start at ₹{$planSettings.config.prices.premium.month} a month. Paid plans are not on sale yet, so nobody can be charged by accident.</li>
      <li>When they are: cancel any time, a full refund within 7 days of the first payment, and a refund if your child paid without your permission. See the <a href="/legal/refunds">refund policy</a>.</li>
    </ul>
    <a class="more" href="/plans">Compare the plans <Icon name="chevron" size={16} /></a>
    {/if}
  </section>

  <section class="card block" aria-labelledby="start-h">
    <h2 id="start-h" class="title">How does my child start?</h2>
    <ol>
      <li><strong>Sign in with Google</strong> (your account or your child’s). It takes a few seconds and no new password.</li>
      <li>Open <a href="/coach">Coach</a> for lessons with Chess Guru. Pick English, हिन्दी or मराठी.</li>
      <li>Play a <a href="/play?mode=fide">FIDE-level opponent</a> at your child’s level (start at 1000–1200 for a beginner). These are computer opponents that play like players of that rating.</li>
      <li>Do the <a href="/puzzles">daily puzzle</a> and follow the weekly plan in <a href="/learn">Learn</a>.</li>
      <li>Playing real people online needs a free <a href="https://lichess.org" target="_blank" rel="noopener">Lichess</a> account, a non-profit chess site. You can add it later.</li>
    </ol>
  </section>

  <section class="card block contact" aria-labelledby="contact-h">
    <h2 id="contact-h" class="title">Questions?</h2>
    <p>Write to us at <a href="mailto:support@chesscastles.com">support@chesscastles.com</a> or from <a href="/help">Help</a>. We reply within 2 working days.</p>
    <p class="label">Read more: <a href="/legal/privacy">privacy policy</a> (section 4 is about children) · <a href="/legal/terms">terms</a> · <a href="/legal/fair-play">fair play</a>.</p>
  </section>
</div>

<style>
  .page {
    max-width: 920px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .hero {
    padding: 26px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
    background:
      radial-gradient(90% 90% at 100% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%),
      var(--card);
  }
  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 12.5px;
  }
  h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1.08;
  }
  .sub {
    margin: 0;
    color: var(--text-2);
    font-size: 17px;
  }
  .ctas {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .hero > .label {
    margin: 0;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 21px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .item {
    padding: 14px 16px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .ic {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .item p {
    margin: 4px 0 0;
    color: var(--text-2);
    font-size: 14.5px;
  }
  .block {
    padding: 20px 22px;
  }
  ul,
  ol {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  ul {
    list-style: none;
    padding-left: 0;
  }
  .more {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-top: 12px;
    font-weight: 700;
  }
  .contact p {
    margin: 0 0 8px;
  }
  @media (max-width: 640px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .hero {
      padding: 20px 16px;
    }
    .block {
      padding: 16px;
    }
  }
</style>
