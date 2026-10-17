<script lang="ts">
  /** Chess Castles plans: Free, Premium and Elite, with what each includes. */
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { FIDE_DISCLAIMER } from '$lib/heroFeatures';
  import { track } from '$lib/analytics';
  import {
    FEATURES,
    FEATURE_INFO,
    GATE_INFO,
    PLANS,
    PLAN_INFO,
    QUOTA_INFO,
    RANK,
    currentPlan,
    inviteLink,
    launchOn,
    limitText,
    loadPlanSettings,
    myPlan,
    planSettings,
    untilText,
    type Gate,
    type Plan,
    type Quota,
  } from '$lib/plans';

  let yearly = $state(true);
  let interested = $state<Plan | undefined>();
  let copied = $state(false);
  onMount(() => void loadPlanSettings(true));

  const config = $derived($planSettings.config);
  const launch = $derived($planSettings.launch);
  const price = (p: Plan) => (p === 'free' ? 0 : yearly ? config.prices[p].year : config.prices[p].month);
  const perMonth = (p: Plan) => (p === 'free' ? 0 : Math.round(config.prices[p].year / 12));
  const offerEnds = $derived(new Date(launch.until + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }));

  /** The few lines on each card. */
  const highlights = (p: Plan): string[] => {
    const l = config.limits;
    const PER = { day: ' a day', week: ' a week', month: ' a month', ever: '' };
    const line = (f: (typeof FEATURES)[number]) => {
      const x = l[f][p];
      return x.n === null ? `Unlimited ${FEATURE_INFO[f].many}` : `${x.n} ${x.n === 1 ? FEATURE_INFO[f].one : FEATURE_INFO[f].many}${PER[x.per]}`;
    };
    const out = [line('fide_game'), line('review'), line('guru'), line('insights')];
    if (p === 'free') out.push('Online play, puzzles, books and friends: free');
    if (RANK[p] >= RANK[config.gates.bot_opening]) out.push('Choose the bot’s opening');
    if (p === 'elite') out.push('Coach tools for your students');
    return out;
  };
  const gateCell = (g: Gate, p: Plan) => RANK[p] >= RANK[config.gates[g]];
  const quotaCell = (q: Quota, p: Plan) => config.quotas[q][p].toLocaleString();

  /** The comparison as rows (the phone's cards). */
  const compareRows = $derived.by(() => {
    const rows: { label: string; values: Record<Plan, string | boolean> }[] = [];
    const all = (f: (p: Plan) => string | boolean) => Object.fromEntries(PLANS.map((p) => [p, f(p)])) as Record<Plan, string | boolean>;
    for (const f of FEATURES) rows.push({ label: FEATURE_INFO[f].label, values: all((p) => limitText(config.limits[f][p])) });
    for (const q of Object.keys(config.quotas) as Quota[]) rows.push({ label: QUOTA_INFO[q], values: all((p) => quotaCell(q, p)) });
    for (const g of Object.keys(config.gates) as Gate[]) rows.push({ label: GATE_INFO[g], values: all((p) => gateCell(g, p)) });
    rows.push({ label: 'Analysis board with engine', values: all(() => 'Unlimited') });
    rows.push({ label: 'Online play, lobby and arenas', values: all(() => 'Free') });
    return rows;
  });

  function interest(p: Plan) {
    interested = p;
    track('interest', p);
  }
  async function copyInvite(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* the link is shown anyway */
    }
  }
</script>

<svelte:head>
  <title>Plans · Chess Castles</title>
  <meta name="description" content="Chess Castles plans: Free, Premium and Elite. Every pawn can become a Queen." />
</svelte:head>

<section class="hero">
  <p class="eyebrow">Plans</p>
  <h1 class="title">Every pawn can become a Queen</h1>
  <p class="sub">Start free. Grow with more FIDE-rated games, deep reviews and your own AI coach.</p>
  {#if $session.status === 'in' && $myPlan}
    <p class="mine">
      Your plan: <strong><PlanBadge plan={$myPlan.plan} size={20} /> {PLAN_INFO[$myPlan.plan].name}</strong>{#if $myPlan.until} until {untilText($myPlan.until)}{/if}
      {#if $myPlan.source === 'launch'}(launch offer){:else if $myPlan.source === 'referral'}(invite reward){/if}
    </p>
  {/if}
</section>

{#if launchOn(launch)}
  <div class="offer card">
    <PlanBadge plan={launch.plan} size={44} />
    <div>
      <strong>Launch offer: {PLAN_INFO[launch.plan].name} free for {launch.days} days.</strong>
      <span>Everyone who signs in before {offerEnds} gets it. No card, no payment.</span>
    </div>
    {#if $session.status !== 'in'}<button class="btn primary" onclick={() => startSignIn()}>Sign in free</button>{/if}
  </div>
{/if}

<div class="toggle segmented" role="group" aria-label="Billing">
  <button aria-pressed={!yearly} onclick={() => (yearly = false)}>Monthly</button>
  <button aria-pressed={yearly} onclick={() => (yearly = true)}>Yearly · save 33%</button>
</div>

<div class="cards">
  {#each PLANS as p (p)}
    {@const info = PLAN_INFO[p]}
    {@const mine = $session.status === 'in' && $currentPlan === p}
    <article class="plan card" class:featured={p === 'premium'} class:mine>
      {#if p === 'premium'}<span class="ribbon">Most popular</span>{/if}
      <header>
        <PlanBadge plan={p} size={58} />
        <h2 class="title">{info.name}</h2>
        <span class="label">{info.tag}</span>
      </header>
      <p class="price">
        {#if p === 'free'}<strong class="num">₹0</strong> <span class="label">forever</span>
        {:else}<strong class="num">₹{price(p).toLocaleString('en-IN')}</strong> <span class="label">/ {yearly ? 'year' : 'month'}</span>
          {#if yearly}<span class="label pm">₹{perMonth(p)} a month</span>{/if}
        {/if}
      </p>
      <p class="blurb">{info.blurb}</p>
      <ul>
        {#each highlights(p) as h (h)}<li><Icon name="check" size={16} color="var(--accent)" />{h}</li>{/each}
      </ul>
      {#if mine}
        <span class="btn block current">Your plan</span>
      {:else if p === 'free'}
        {#if $session.status !== 'in'}<button class="btn block" onclick={() => startSignIn()}>Start free</button>{/if}
      {:else if interested === p}
        <p class="thanks" role="status">Thanks! Paid plans open soon{launchOn(launch) ? `; until then ${PLAN_INFO[launch.plan].name} is free in the launch offer` : ''}.</p>
      {:else}
        <button class="btn primary block" onclick={() => interest(p)}>I want {info.name}</button>
        <span class="label soon">Payments open soon</span>
      {/if}
    </article>
  {/each}
</div>

<section class="compare card" aria-labelledby="cmp-h">
  <h2 id="cmp-h" class="title">Compare the plans</h2>
  <div class="scroll">
    <table>
      <thead>
        <tr><th scope="col">Feature</th>{#each PLANS as p (p)}<th scope="col"><PlanBadge plan={p} size={18} /> {PLAN_INFO[p].name}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each FEATURES as f (f)}
          <tr><th scope="row">{FEATURE_INFO[f].label}</th>{#each PLANS as p (p)}<td>{limitText(config.limits[f][p])}</td>{/each}</tr>
        {/each}
        {#each Object.keys(config.quotas) as q (q)}
          <tr><th scope="row">{QUOTA_INFO[q as Quota]}</th>{#each PLANS as p (p)}<td class="num">{quotaCell(q as Quota, p)}</td>{/each}</tr>
        {/each}
        {#each Object.keys(config.gates) as g (g)}
          <tr>
            <th scope="row">{GATE_INFO[g as Gate]}</th>
            {#each PLANS as p (p)}<td>{#if gateCell(g as Gate, p)}<Icon name="check" size={16} color="var(--accent)" label="Included" />{:else}<span class="label">—</span>{/if}</td>{/each}
          </tr>
        {/each}
        <tr><th scope="row">Analysis board with engine</th>{#each PLANS as p (p)}<td>Unlimited</td>{/each}</tr>
        <tr><th scope="row">Online play, lobby and arenas</th>{#each PLANS as p (p)}<td>Free</td>{/each}</tr>
        <tr><th scope="row">Books, friends, watch, leaderboards, CC Rating</th>{#each PLANS as p (p)}<td>Free</td>{/each}</tr>
      </tbody>
    </table>
  </div>
  <!-- Phones: one small card per feature (the table's plan columns don't fit). -->
  <ul class="cmp-cards">
    {#each compareRows as r (r.label)}
      <li>
        <strong>{r.label}</strong>
        <div class="cmp-grid">
          {#each PLANS as p (p)}
            <span class="cmp-cell" class:mine={$session.status === 'in' && $currentPlan === p}>
              <span class="label"><PlanBadge plan={p} size={14} /> {PLAN_INFO[p].name}</span>
              <span class="v">{r.values[p] === true ? '✓' : r.values[p] === false ? '—' : r.values[p]}</span>
            </span>
          {/each}
        </div>
      </li>
    {/each}
  </ul>
  <p class="label fine">{FIDE_DISCLAIMER}</p>
</section>

{#if $session.status === 'in' && $myPlan}
  <section class="invite card" aria-labelledby="inv-h">
    <h2 id="inv-h" class="title">Invite friends, get {PLAN_INFO.premium.name} free</h2>
    <p>Each friend who joins with your link gives you {$myPlan.referral.days} days of {PLAN_INFO.premium.name}, after any plan you have now. {$myPlan.referral.invited ? `You’ve invited ${$myPlan.referral.invited} so far.` : ''}</p>
    <div class="link-row">
      <input readonly value={inviteLink($myPlan.referral.code)} aria-label="Your invite link" onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
      <button class="btn" onclick={() => copyInvite($myPlan!.referral.code)}><Icon name="copy" size={16} />{copied ? 'Copied' : 'Copy'}</button>
    </div>
  </section>
{/if}

<section class="faq" aria-labelledby="faq-h">
  <h2 id="faq-h" class="title">Questions</h2>
  <details><summary>Is online play free?</summary><p>Yes, always, on every plan: quick pairing, the lobby, challenges and arena tournaments.</p></details>
  <details><summary>How do I pay?</summary><p>Paid plans open soon, with UPI and cards. Until then, nobody is charged: the launch offer and invite rewards are free.</p></details>
  <details><summary>Can I cancel or get a refund?</summary><p>Cancel any time and keep your plan until the end of the period you paid for. Your first payment for a plan is refunded in full if you ask within 7 days. See the <a href="/legal/refunds">refund policy</a>.</p></details>
  <details><summary>What happens when a limit is reached?</summary><p>That feature waits until the next day (or week). Everything else keeps working. Limits reset at midnight, India time.</p></details>
  <details><summary>Is Elite only for coaches?</summary><p>Elite has everything in Premium, plus coach tools: share a link, students join, and you see their progress and games and set them homework. Students stay on their own plan.</p></details>
  <details><summary>Can children use Chess Castles?</summary><p>Yes. Messages are only between friends, and a parent should agree before any paid plan. See the <a href="/legal/privacy">privacy policy</a>.</p></details>
</section>

<style>
  .fine {
    margin: 12px 0 0;
    font-size: 12px;
  }
  .hero {
    text-align: center;
    margin: 8px auto 18px;
    max-width: 680px;
  }
  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 12.5px;
  }
  h1 {
    margin: 6px 0;
    font-size: clamp(26px, 4vw, 38px);
  }
  .sub {
    margin: 0;
    color: var(--text-2);
  }
  .mine {
    margin: 10px 0 0;
  }
  .offer {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    margin: 0 auto 18px;
    max-width: 860px;
    border: 1px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 10%, var(--card));
  }
  .offer div {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .offer span:not(.big-piece) {
    color: var(--text-2);
    font-size: 14px;
  }
  .toggle {
    max-width: 340px;
    margin: 0 auto 18px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    align-items: stretch;
  }
  .plan {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 18px;
  }
  .plan.featured {
    border: 2px solid var(--gold);
  }
  .plan.mine {
    box-shadow: 0 0 0 2px var(--action) inset;
  }
  .ribbon {
    position: absolute;
    top: -11px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--gold);
    color: #0b1426;
    font-size: 12px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }
  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  header h2 {
    margin: 4px 0 0;
    font-size: 22px;
  }
  .price {
    margin: 0;
    text-align: center;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
  }
  .price strong {
    font-size: 28px;
  }
  .pm {
    flex-basis: 100%;
  }
  .blurb {
    margin: 0;
    color: var(--text-2);
    font-size: 14px;
    text-align: center;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
    flex: 1;
  }
  li {
    display: flex;
    gap: 7px;
    align-items: flex-start;
    font-size: 14px;
  }
  li :global(svg) {
    flex: none;
    margin-top: 2px;
  }
  .current {
    justify-content: center;
    opacity: 0.8;
    cursor: default;
  }
  .soon {
    text-align: center;
    margin-top: -4px;
  }
  .thanks {
    margin: 0;
    font-size: 14px;
    text-align: center;
    color: var(--text);
  }
  .compare {
    margin-top: 22px;
    padding: 18px;
  }
  .compare h2,
  .invite h2,
  .faq h2 {
    margin: 0 0 12px;
  }
  .cmp-cards {
    display: none;
    list-style: none;
    margin: 0;
    padding: 0;
    flex-direction: column;
    gap: 10px;
  }
  .cmp-cards li {
    padding: 12px;
    border-radius: 12px;
    background: var(--raised);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cmp-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .cmp-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--card);
  }
  .cmp-cell.mine {
    box-shadow: 0 0 0 2px var(--accent) inset;
  }
  .cmp-cell .label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
  }
  .cmp-cell .v {
    font-weight: 700;
  }
  @media (max-width: 640px) {
    .scroll {
      display: none;
    }
    .cmp-cards {
      display: flex;
    }
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    min-width: 620px;
  }
  th,
  td {
    padding: 9px 10px;
    border-bottom: 1px solid var(--border);
    text-align: center;
  }
  th[scope='row'] {
    text-align: left;
    font-weight: 600;
  }
  thead th:first-child {
    text-align: left;
  }
  thead th {
    font-size: 13px;
    color: var(--accent);
    white-space: nowrap;
  }
  .invite {
    margin-top: 18px;
    padding: 18px;
  }
  .invite p {
    margin: 0 0 10px;
    color: var(--text-2);
  }
  .link-row {
    display: flex;
    gap: 8px;
  }
  .link-row input {
    flex: 1;
    min-width: 0;
    height: 42px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 10px;
    font: inherit;
  }
  .link-row .btn {
    gap: 6px;
  }
  .faq {
    margin: 22px 0 8px;
    max-width: 760px;
  }
  details {
    border-bottom: 1px solid var(--border);
    padding: 10px 2px;
  }
  summary {
    cursor: pointer;
    font-weight: 700;
  }
  details p {
    margin: 8px 0 2px;
    color: var(--text-2);
  }
  @media (max-width: 1100px) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 560px) {
    .cards {
      grid-template-columns: minmax(0, 1fr);
    }
    .offer {
      flex-wrap: wrap;
    }
  }
</style>
