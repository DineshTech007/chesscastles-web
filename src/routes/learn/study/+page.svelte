<script lang="ts">
  /** The opening study section: each opening with its lines, plans, trainer, model games, puzzles and play. */
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { fenOf, playSans } from '$lib/chess/position';
  import { STUDY_OPENINGS } from '$lib/study/openingStudy';
</script>

<svelte:head>
  <title>Opening study · Chess Castles</title>
  <meta name="description" content="Study an opening completely: its main lines and middlegame plans, a trainer, model games of strong players, puzzles from real games, and games against a FIDE-rated opponent." />
</svelte:head>

<div class="page">
  <a class="back" href="/learn"><Icon name="back" size={16} />Learn</a>
  <header>
    <h1 class="display">Opening study</h1>
    <p class="intro">
      Everything for one opening in one place: the main lines and the plans behind them, a trainer to learn the moves, model games of strong
      players, puzzles from real games in that opening (middlegame and endgame, three levels), and games against a FIDE-rated opponent in the line
      you choose.
    </p>
  </header>
  <div class="grid">
    {#each STUDY_OPENINGS as o (o.id)}
      <a class="card o" href="/learn/study/{o.id}">
        <div class="b" aria-hidden="true"><Board fen={fenOf(playSans(o.root))} orientation={o.side} viewOnly coordinates={false} label={o.name} /></div>
        <span class="pill">You play {o.side === 'white' ? 'White' : 'Black'}</span>
        <span class="title name">{o.name}</span>
        <span class="label">{o.root}</span>
        <span class="label">{o.lines.length} lines: {o.lines.map((l) => l.name).join(', ')}</span>
        <span class="go">Study it <Icon name="chevron" size={14} /></span>
      </a>
    {/each}
  </div>
</div>

<style>
  .page {
    max-width: 1140px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 14px;
    width: fit-content;
  }
  h1 {
    margin: 0;
    font-size: 44px;
  }
  .intro {
    margin: 6px 0 0;
    max-width: 780px;
    color: var(--muted);
    line-height: 1.5;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 16px;
  }
  .o {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    color: var(--text);
    text-decoration: none;
    align-items: flex-start;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .o:hover {
    border-color: var(--brand);
    transform: translateY(-1px);
    text-decoration: none;
  }
  .b {
    width: 100%;
    margin-bottom: 6px;
  }
  .name {
    font-size: 22px;
  }
  .pill {
    font-size: 12px;
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--brand);
    font-weight: 600;
    margin-top: 4px;
  }
</style>
