<script lang="ts">
  /**
   * The improvement roadmap: what to do at each level, with the parts of Chess
   * Castles that do it, from a first game to the FIDE titles. Written for
   * beginners and parents; the figures from our own tester ("Aarav", a
   * beginner account that plays and studies here every day) are marked as such.
   */
  import Icon from '$lib/components/Icon.svelte';

  const STAGES = [
    {
      range: 'First games → 1200',
      name: 'Learn the game, stop hanging pieces',
      weeks: '4–8 weeks, 30 minutes a day',
      goal: 'Know the rules and the piece values; finish every game without leaving a piece to be taken for nothing.',
      steps: [
        { what: 'Chess Guru: the basics', how: 'Learn → Start → "Opening principles", "Piece values and good trades", then the checkmate lessons.', href: '/learn' },
        { what: 'Play rapid games against the 1400 FIDE-level opponent', how: 'Play → FIDE-rated play, 15+10. Never bullet or blitz yet: slow games teach, fast games only show the clock.', href: '/play/fide?r=1400&tc=2' },
        { what: 'Review every game', how: 'After the game press Analyse → Report. Find the one move that lost the game (the "turning point") and say in words why it was bad.', href: '/games' },
        { what: 'Puzzles, 10 a day', how: 'Puzzles → rated puzzles. The rating road map there goes Pawn → Knight → Bishop: stay until Knight.', href: '/puzzles' },
      ],
    },
    {
      range: '1200 → 1600',
      name: 'Tactics and one opening for each colour',
      weeks: '3–6 months, 45 minutes a day',
      goal: 'See forks, pins and back-rank mates before they happen; reach a playable middlegame from the opening every game.',
      steps: [
        { what: 'Tactics by theme', how: 'Puzzles → By theme: fork, pin, skewer, back rank, one theme a week. The profile’s "Sharp moments" number tells you when it is working.', href: '/puzzles/themes' },
        { what: 'One opening as White, one as Black', how: 'Learn → Openings → Courses: Jobava London for White; Caro-Kann or Chebanenko Slav for Black. Use the trainer until a line is marked learned, watch one model game of that line, and only then play it.', href: '/learn?tab=openings' },
        { what: 'Play the line against the FIDE-level opponents', how: 'The course’s "Play it" starts a game from the line’s position. Play your own level and one level up.', href: '/learn/study/caro-kann' },
        { what: 'Check your profile every week', how: 'Profile → "How you play": opening, middlegame, endgame, sharp and calm numbers show where the next hour should go.', href: '/profile' },
      ],
    },
    {
      range: '1600 → 2000',
      name: 'Endgames, plans and calculation',
      weeks: '6–12 months, 1 hour a day',
      goal: 'Convert a won position; hold a worse one; know the plan after the opening, not just the moves.',
      steps: [
        { what: 'Endgames with the masters', how: 'Learn → Masters: rook endgames first (they are half of all endgames), then king and pawn.', href: '/learn/masters' },
        { what: 'Strategy lessons and the weekly plan', how: 'Learn → Strategy, then Learn → Plan: Guru reads your games and gives the week’s tasks.', href: '/learn?tab=plan' },
        { what: 'Vision Gym', how: 'Blindfold puzzles and the sprint, 10 minutes a day: calculation needs a board in your head.', href: '/vision' },
        { what: 'The 5.4 million game database', how: 'Analyse → Database: after each of your games, see where your moves left the database and what strong players chose there.', href: '/analysis?tab=database' },
        { what: 'Widen the repertoire', how: 'Learn → Openings → Trainer: add a second opening for each colour (Italian or Scotch; Sicilian or Nimzo-Indian) so no opponent surprises you.', href: '/learn?tab=openings&sub=trainer' },
      ],
    },
    {
      range: '2000 → 2300 (CM, FM)',
      name: 'Depth: main lines, model games, real tournaments',
      weeks: '1–2 years, 2 hours a day',
      goal: 'A full repertoire with main lines to move 15; accuracy above 90% in slow games; a FIDE rating from real tournaments.',
      steps: [
        { what: 'Main-line openings', how: 'Ruy Lopez and Open Sicilian as White; Sicilian Najdorf or Sveshnikov, Nimzo-Indian or Grünfeld as Black (all in the trainer). Learn them from the database’s strongest players, not from memory alone.', href: '/learn?tab=openings&sub=trainer' },
        { what: 'Model games every day', how: 'Learn → Masters and the courses’ model games: one annotated grandmaster game a day, with the engine off first.', href: '/learn/masters' },
        { what: 'Play up', how: 'FIDE-level opponents 100–200 above you, classical (60+0 or 90+30), and review each game for the turning point.', href: '/play/fide?r=2200&tc=4' },
        { what: 'Real tournaments', how: 'Community → tournaments near you. A FIDE rating needs rated games against rated players: Chess Castles ratings are not FIDE ratings.', href: '/community' },
      ],
    },
    {
      range: '2300 → 2500 (IM, GM)',
      name: 'Norms, preparation, physical form',
      weeks: 'Years; this is a profession',
      goal: 'The GM title needs a FIDE rating of 2500 at some point plus three GM norms (strong results in international tournaments); the IM title 2400 plus three IM norms.',
      steps: [
        { what: 'Opening preparation against named opponents', how: 'Analyse → Database with the opponent’s games; the trainer for the exact lines.', href: '/analysis?tab=database' },
        { what: 'Calculation and endgame technique', how: 'Vision Gym every day; the masters’ endgames until every position is a known one.', href: '/vision' },
        { what: 'A coach and a schedule', how: 'At this level a human coach, sleep, and sport matter as much as study. Students → connect with a coach on Chess Castles.', href: '/students' },
      ],
    },
  ];

  const TITLES = [
    ['GM', 'Grandmaster', '2500 rating (once) + 3 norms'],
    ['IM', 'International Master', '2400 + 3 norms'],
    ['FM', 'FIDE Master', '2300 rating'],
    ['CM', 'Candidate Master', '2200 rating'],
    ['WGM / WIM / WFM / WCM', 'Women’s titles', '2300 / 2200 / 2100 / 2000, norms for WGM and WIM'],
  ];
</script>

<svelte:head>
  <title>Roadmap: from beginner to grandmaster · Chess Castles</title>
  <meta name="description" content="A clear improvement roadmap: what to study and play at every level from a first game to the FIDE titles, with the parts of Chess Castles that do each step." />
</svelte:head>

<div class="page">
  <a class="back" href="/learn"><Icon name="back" size={16} />Learn</a>
  <header class="card head">
    <p class="eyebrow label">Roadmap</p>
    <h1 class="display">From a first game to grandmaster</h1>
    <p class="lead">What to do at each level, in order, and where on Chess Castles to do it. One rule holds at every level: play slow games, review every one, and fix the single move that lost it.</p>
    <p class="label fine">FIDE is the world chess federation. Its ratings and titles come only from rated tournaments; Chess Castles ratings (CC Rating) measure your games here against FIDE-level opponents and are not FIDE ratings.</p>
  </header>

  <ol class="stages">
    {#each STAGES as s, i (s.range)}
      <li class="card stage">
        <div class="s-head">
          <span class="n num">{i + 1}</span>
          <div>
            <p class="label range">{s.range} · {s.weeks}</p>
            <h2 class="title">{s.name}</h2>
            <p class="goal">{s.goal}</p>
          </div>
        </div>
        <ul class="steps">
          {#each s.steps as st (st.what)}
            <li>
              <a href={st.href}><strong>{st.what}</strong></a>
              <span class="label">{st.how}</span>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ol>

  <section class="card found" aria-labelledby="found-h">
    <h2 id="found-h" class="title">What our tester found</h2>
    <p>
      Aarav is a beginner account that plays and studies here every day with a weak engine choosing its moves (one notch stronger after each day of study), so we can measure what helps. After ten sessions (50 rapid games, CC Rating 1500 → 1619):
    </p>
    <ul>
      <li>Every loss came from one move: the review’s turning point lost 15–30% of the winning chances in a single move. Reviewing that move is the whole lesson.</li>
      <li>Playing an opening line the day it was first seen: 1 win in the first 9 such games. Once the same courses were repeated with the trainer and a model game each time, the next 21 such games went 12 wins, 6 draws, 3 losses. Learn the line before you play it.</li>
      <li>The profile’s "sharp moments" number rose from 57 to 98 with daily puzzles and reviews, ahead of the rating. Tactics show up in the numbers first.</li>
      <li>Games against an opponent one level up (1600, 1700): 3 wins, a draw and 2 losses in 6, about the same as at the own level. Play up.</li>
    </ul>
    <p class="label">These are early numbers from one account; they are updated as the tester goes on.</p>
  </section>

  <section class="card titles" aria-labelledby="titles-h">
    <h2 id="titles-h" class="title">The FIDE titles</h2>
    <table>
      <thead><tr><th>Title</th><th>Name</th><th>Needs</th></tr></thead>
      <tbody>
        {#each TITLES as [t, name, needs] (t)}<tr><td><strong>{t}</strong></td><td>{name}</td><td>{needs}</td></tr>{/each}
      </tbody>
    </table>
    <p class="label">As in the FIDE Handbook in October 2026; norms are strong results in international tournaments, judged by the federation. See the <a href="/guide">Chess Guide</a> for the rules in plain words.</p>
  </section>
</div>

<style>
  .page {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .head {
    padding: 22px 22px 18px;
  }
  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 12px;
  }
  h1 {
    margin: 4px 0 8px;
    font-size: 34px;
  }
  .lead {
    margin: 0 0 8px;
    font-size: 17px;
    line-height: 1.5;
  }
  .fine {
    margin: 0;
  }
  .stages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .stage {
    padding: 18px 20px;
  }
  .s-head {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .n {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #0b1426;
    font-weight: 900;
  }
  .range {
    margin: 0;
  }
  h2 {
    margin: 2px 0 6px;
    font-size: 20px;
  }
  .goal {
    margin: 0;
    color: var(--text-2);
  }
  .steps {
    list-style: none;
    margin: 12px 0 0 48px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .steps li {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  @media (max-width: 599px) {
    .steps {
      margin-left: 0;
    }
  }
  .found,
  .titles {
    padding: 18px 20px;
  }
  .found h2,
  .titles h2 {
    margin: 0 0 8px;
  }
  .found p {
    margin: 0 0 8px;
  }
  .found ul {
    margin: 0 0 8px;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14.5px;
  }
  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-soft);
  }
</style>
