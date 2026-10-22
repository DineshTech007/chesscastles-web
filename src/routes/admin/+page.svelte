<script lang="ts">
  import { PLANS_ON } from '$lib/plans';
  /**
   * The admin page (hidden from players): dashboard and analytics, players and
   * plans, plan settings, reports, and the team. The server checks the role on
   * every call; this page only shows what the role allows.
   */
  import { onMount } from 'svelte';
  import { session } from '$lib/auth';
  import { adminMe, type Can, type Role } from '$lib/admin';
  import Dashboard from '$lib/admin/Dashboard.svelte';
  import Players from '$lib/admin/Players.svelte';
  import PlanSettings from '$lib/admin/PlanSettings.svelte';
  import Reports from '$lib/admin/Reports.svelte';
  import Team from '$lib/admin/Team.svelte';
  import FairPlay from '$lib/admin/FairPlay.svelte';
  import Feedback from '$lib/admin/Feedback.svelte';
  import Registrations from '$lib/admin/Registrations.svelte';
  import Wishes from '$lib/admin/Wishes.svelte';
  import WhatsApp from '$lib/admin/WhatsApp.svelte';
  import AdminPanel from '$lib/classroom/AdminPanel.svelte';

  type Tab = 'dashboard' | 'registrations' | 'players' | 'castleclass' | 'fairplay' | 'plans' | 'reports' | 'feedback' | 'wishes' | 'whatsapp' | 'team';
  let tab = $state<Tab>('dashboard');
  let role = $state<{ role: Role; can: Can[] } | undefined>();
  let denied = $state(false);
  let openUid = $state<string | undefined>();
  /** A player to make a CastlesClass coach (from Players): the CastlesClass tab opens their rights. */
  let coachFor = $state<{ uid: string; name: string } | undefined>();

  $effect(() => {
    if ($session.status !== 'in') return;
    adminMe().then(
      (r) => (role = r),
      () => (denied = true),
    );
  });
  onMount(() => {
    const fromHash = () => {
      const h = location.hash.slice(1) as Tab;
      if (['dashboard', 'registrations', 'players', 'castleclass', 'fairplay', 'plans', 'reports', 'feedback', 'wishes', 'whatsapp', 'team'].includes(h)) tab = h;
    };
    fromHash();
    // The dashboard's tiles link to #reports and #feedback.
    addEventListener('hashchange', fromHash);
    return () => removeEventListener('hashchange', fromHash);
  });
  const go = (t: Tab) => {
    tab = t;
    history.replaceState(history.state, '', `#${t}`);
  };
  // Phones: the tabs scroll sideways; the chosen one comes into view.
  let tabRow = $state<HTMLElement | undefined>();
  $effect(() => {
    void tab;
    tabRow?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  const tabs = $derived(
    (
      [
        ['dashboard', 'Dashboard', 'view'],
        ['registrations', 'Registrations', 'view'],
        ['players', 'Players', 'view'],
        ['castleclass', 'CastlesClass', 'view'],
        ['fairplay', 'Fair play', 'view'],
        ['plans', PLANS_ON ? 'Plans & offers' : 'Site banner', 'view'],
        ['reports', 'Reports', 'reports'],
        ['feedback', 'Feedback', 'reports'],
        ['wishes', 'Kind words', 'owner'],
        ['whatsapp', 'WhatsApp', 'owner'],
        ['team', 'Team & log', 'owner'],
      ] as [Tab, string, Can][]
    ).filter(([, , c]) => role?.can.includes(c)),
  );
</script>

<svelte:head>
  <title>Admin · Chess Castles</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if $session.status === 'out' || denied}
  <!-- To anyone but an admin this is an ordinary missing page. -->
  <div class="card gate"><h1 class="title">Page not found</h1><a class="btn" href="/">Home</a></div>
{:else if !role}
  <div class="card gate"></div>
{:else}
  <header class="head">
    <h1 class="display">Admin</h1>
    <span class="pill">{role.role}</span>
  </header>
  <div class="segmented tabs" role="group" aria-label="Admin" bind:this={tabRow}>
    {#each tabs as [k, label] (k)}<button aria-pressed={tab === k} onclick={() => go(k)}>{label}</button>{/each}
  </div>
  <div class="body">
    {#if tab === 'dashboard'}
      <Dashboard />
    {:else if tab === 'registrations'}
      <Registrations />
    {:else if tab === 'players'}
      <Players can={role.can} {openUid} onmakecoach={(p) => ((coachFor = p), go('castleclass'))} />
    {:else if tab === 'castleclass'}
      <p class="label">CastlesClass coaches and their rights, classes live now, and problems in class. <a href="/castleclass/admin">Open on its own page</a></p>
      <AdminPanel add={coachFor} />
    {:else if tab === 'fairplay'}
      <FairPlay can={role.can} />
    {:else if tab === 'plans'}
      <PlanSettings can={role.can} />
    {:else if tab === 'reports'}
      <Reports onopen={(uid) => ((openUid = uid), go('players'))} />
    {:else if tab === 'feedback'}
      <Feedback onopen={(uid) => ((openUid = uid), go('players'))} />
    {:else if tab === 'wishes'}
      <Wishes />
    {:else if tab === 'whatsapp'}
      <WhatsApp />
    {:else if tab === 'team'}
      <Team />
    {/if}
  </div>
{/if}

<style>
  .gate {
    max-width: 420px;
    margin: 60px auto;
    padding: 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }
  .gate h1 {
    margin: 0;
    font-size: 20px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .head h1 {
    margin: 0;
  }
  /* Ten tabs: each as wide as its name (never squeezed over each other); on a phone the row scrolls sideways. */
  .tabs {
    max-width: 100%;
    width: fit-content;
    margin-bottom: 16px;
    grid-auto-columns: max-content;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  /* Phones: the row fades at its right edge, so it shows there are more tabs to swipe to. */
  @media (max-width: 720px) {
    .tabs {
      -webkit-mask-image: linear-gradient(to right, #000 82%, transparent);
      mask-image: linear-gradient(to right, #000 82%, transparent);
      padding-right: 40px;
    }
  }
  .tabs button {
    white-space: nowrap;
    padding: 0 14px;
  }
</style>
