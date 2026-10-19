<script lang="ts">
  import { onMount } from 'svelte';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { leaders, myVision, type Board, type Leader } from '$lib/vision/api';
  import { loadVision, saveVision, todayKey, type VisionRecord } from '$lib/vision/vision';

  let rec = $state<VisionRecord>({ rating: 1000, games: 0, solved: 0, bestSprint: 0, bestMemory: 0 });
  let board = $state<Board>('rating');
  let list = $state<Leader[] | undefined>();
  let listError = $state('');
  let myId = $state('');
  let sight = $state(0);

  onMount(() => {
    rec = loadVision();
    try {
      sight = Number(localStorage.getItem('k24.vision.sight')) || 0;
    } catch {
      /* none */
    }
  });

  // Signed in: the leaderboard's numbers are the ones that count.
  $effect(() => {
    if ($session.status !== 'in') return;
    void myVision().then((m) => {
      if (!m) return;
      myId = m.id;
      if (m.games) {
        rec = { ...rec, rating: m.rating, games: m.games, solved: m.solved, bestSprint: Math.max(rec.bestSprint, m.bestSprint) };
        saveVision(rec);
      }
    });
  });

  $effect(() => {
    const b = board;
    list = undefined;
    listError = '';
    leaders(b).then(
      (r) => (list = r.players),
      () => ((listError = "The leaderboard couldn't be loaded right now."), (list = [])),
    );
  });

  const MODES: { href: string; title: string; text: string; icon: IconName; stat: () => string }[] = [
    { href: '/vision/blind', title: 'Blindfold puzzles', text: 'The position as text, the opponent’s move in notation: find the winning move without a board. Rated.', icon: 'eye', stat: () => `Vision rating ${rec.rating}` },
    { href: '/vision/sprint', title: 'Vision Sprint', text: 'One minute of quick questions: square colours, diagonals, knight jumps, what a piece attacks.', icon: 'flame', stat: () => `Best ${rec.bestSprint}${rec.sprintDay === todayKey() ? ` · today ${rec.sprintToday}` : ''}` },
    { href: '/vision/memory', title: 'Move Memory', text: 'Follow a real opening from the start in your head, then say where the pieces are. Lines grow as you improve.', icon: 'history', stat: () => `Best ${rec.bestMemory} half-moves` },
    { href: '/vision/sight', title: 'Piece Sight', text: 'Tap every square a piece can reach, with other pieces in the way. The first step for beginners.', icon: 'knight', stat: () => `Best run ${sight}` },
  ];
  const BOARDS: { id: Board; label: string; unit: string }[] = [
    { id: 'rating', label: 'Vision rating', unit: '' },
    { id: 'today', label: "Today's sprint", unit: 'points' },
    { id: 'sprint', label: 'Best sprint', unit: 'points' },
  ];
</script>

<svelte:head><title>Blindfold Gym · Chess Castles</title></svelte:head>

<div class="page">
  <section class="hero card">
    <div class="intro">
      <span class="label eyebrow">Train the skill strong players have</span>
      <h1 class="display">Blindfold Gym</h1>
      <p>Grandmasters see the board in their heads: they calculate long lines, play blindfold, and spot tactics before they happen. Train that skill here, without a board.</p>
    </div>
    <div class="me">
      <span class="label">Your Vision rating</span>
      <strong class="display num big">{rec.rating}</strong>
      <span class="label">{rec.games ? `${rec.solved} of ${rec.games} blindfold puzzles solved` : 'No blindfold puzzles yet: start one below'}</span>
    </div>
  </section>

  <section class="modes">
    {#each MODES as m (m.href)}
      <a class="mode card" href={m.href}>
        <span class="m-icon"><Icon name={m.icon} size={26} color="var(--gold)" /></span>
        <span class="title m-title">{m.title}</span>
        <span class="m-text">{m.text}</span>
        <span class="label m-stat">{m.stat()}</span>
      </a>
    {/each}
  </section>

  <section class="card leaders" id="leaders" aria-labelledby="lb-h">
    <div class="lb-head">
      <h2 id="lb-h" class="title">Vision leaderboard</h2>
      <div class="segmented" role="group" aria-label="Leaderboard">
        {#each BOARDS as b (b.id)}<button aria-pressed={board === b.id} onclick={() => (board = b.id)}>{b.label}</button>{/each}
      </div>
    </div>
    {#if $session.status !== 'in'}
      <p class="label">Only signed-in players appear. <button class="link" onclick={() => startSignIn()}>Sign in</button> to join; every answer is checked by our server, so the board stays fair.</p>
    {/if}
    {#if !list}
      <div class="skel"></div>
    {:else if listError}
      <p class="label">{listError}</p>
    {:else if !list.length}
      <p class="label">{board === 'rating' ? 'No one has solved 5 rated blindfold puzzles yet. Be the first!' : 'No sprints yet today. Be the first!'}</p>
    {:else}
      <ol class="list">
        {#each list as p, i (p.id)}
          <li class:me={p.id === myId}>
            <span class="pos display" class:gold={i === 0} class:silver={i === 1} class:bronze={i === 2}>{i + 1}</span>
            <span class="name">{p.name}{p.id === myId ? ' (you)' : ''}</span>
            <span class="label">{board === 'rating' ? `${p.games} puzzles` : ''}</span>
            <span class="value num">{p.value}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</div>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hero {
    padding: 22px 24px;
    display: flex;
    gap: 20px;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    background:
      radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 55%),
      repeating-conic-gradient(color-mix(in srgb, var(--raised) 55%, transparent) 0% 25%, transparent 0% 50%) 0 0 / 56px 56px,
      var(--card);
  }
  .intro {
    max-width: 60ch;
  }
  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 12px;
  }
  h1 {
    margin: 2px 0 6px;
    font-size: 46px;
  }
  .intro p {
    margin: 0;
  }
  .me {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .big {
    font-size: 54px;
    line-height: 1;
    color: var(--gold);
  }
  .modes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
    gap: 12px;
  }
  .mode {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--text);
    text-decoration: none;
  }
  .mode:hover {
    outline: 2px solid var(--gold);
    text-decoration: none;
  }
  .m-icon {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--gold) 15%, transparent);
  }
  .m-title {
    font-size: 20px;
  }
  .m-text {
    font-size: 14px;
    color: var(--text-2);
    flex: 1;
  }
  .m-stat {
    color: var(--gold);
    font-weight: 600;
  }
  .leaders {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .lb-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .lb-head h2 {
    margin: 0;
    font-size: 20px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    display: grid;
    grid-template-columns: 40px 1fr auto 70px;
    gap: 10px;
    align-items: center;
    padding: 8px 4px;
    border-top: 1px solid var(--border);
  }
  .list li.me {
    background: color-mix(in srgb, var(--brand) 14%, transparent);
    border-radius: 8px;
  }
  .pos {
    font-size: 22px;
    text-align: center;
  }
  .pos.gold {
    color: #f0b54a;
  }
  .pos.silver {
    color: #b8c2d6;
  }
  .pos.bronze {
    color: #d08a52;
  }
  .name {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value {
    font-weight: 800;
    font-size: 18px;
    text-align: right;
    color: var(--gold);
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .skel {
    height: 160px;
  }
</style>
