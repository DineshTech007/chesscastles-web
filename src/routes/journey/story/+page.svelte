<script lang="ts">
  /**
   * The case study: what the practice account's sessions on Chess Castles show
   * about going from 1500 to 2500, written from its record
   * (reports/aarav-data.json). Every figure is from the data; nothing is
   * invented around it.
   */
  import journey from '$lib/journey/journey.json';
  import Aarav from '$lib/journey/Aarav.svelte';
  import Icon from '$lib/components/Icon.svelte';

  const { hero, target, reached } = journey;
  /** One session's routine, in order: what a player can copy. */
  const PLAN = [
    ['Game 1', 'Rapid 15+10 against the FIDE-rated opponent at the account’s level.', '/play/fide'],
    ['Game 2', 'The same, one level up (100 points above).', '/play/fide'],
    ['Review', 'After each game, Analyse → Report: find the turning point, the one move that decided it.', '/games'],
    ['Opening course', 'One of three courses in turn (Caro-Kann, Jobava London, Chebanenko Slav): the course page, one model game played through, the trainer. Only then the line.', '/learn?tab=openings'],
    ['One more thing', 'One section of Learn in turn: tactics, puzzles, strategy, a Guru review, endgames, the database, a master’s endgame, a blindfold puzzle, a live game, a new opening, traps, a book chapter, the leaderboard, the weekly plan.', '/learn'],
    ['Games 3 and 4', 'From the course’s line, at the account’s level.', '/learn/study/caro-kann'],
    ['Game 5', 'A different opening from the trainer’s catalogue each session, played from move one.', '/learn?tab=openings&sub=trainer'],
    ['Profile', 'Read "How you play": accuracy, opening / middlegame / endgame, sharp / calm. The low number is the next session’s work.', '/profile'],
  ];
</script>

<svelte:head>
  <title>From 1500 to 2500: the case study · Chess Castles</title>
  <meta name="description" content="What a practice account's sessions on Chess Castles show about going from 1500 to 2500: the losses, the routine, the openings, the numbers, and a study plan to copy." />
</svelte:head>

<div class="page">
  <a class="back" href="/journey"><Icon name="back" size={16} />Aarav's journey</a>

  <article class="card">
    <header>
      <Aarav size={110} />
      <div>
        <p class="eyebrow label">Case study</p>
        <h1 class="display">From 1500 to {reached ? target : hero.now}: what the record shows</h1>
        <p class="label">{hero.sessions} sessions · {hero.games} rapid games · {hero.record}</p>
      </div>
    </header>

    <aside class="honest">
      <strong>What this is.</strong> Aarav is Chess Castles' practice account. It follows the <a href="/learn/roadmap">roadmap</a> session after session, with its moves chosen by a chess engine at a beginner's setting that was turned up one notch after each session of study. Everything below is from its record on Chess Castles: the games, the ratings, the openings, the lessons, the puzzles, the mistakes. A child takes two or three years for this road; the account took {hero.sessions} sessions. What transfers is the routine, not the speed.
    </aside>

    <h2>1. The start: three sessions, 1500 → 1353</h2>
    <p>The account's first game, as White against the FIDE 1500 opponent at 15+10, was a win by checkmate in 39 moves at 94% accuracy. The next step was the one most beginners take: it opened the Caro-Kann course, read the page, and played three games from the Advance Variation the same session. It lost all three, checkmated in 30, 31 and 31 moves. Session two: one win, four losses. Session three: one win, four losses. After three sessions the CC Rating stood at 1353.</p>
    <p>The review explains every one of those losses in the same way. Under each game it names a turning point: "19.Qf3 by You, 25% of the winning chances gone in one move"; "12...Bb4, 30%"; "17...Qxe5, 54%"; "12...b6, 17%". In session two the marked moves were 17.Rae1 and 19.Qf3 (both blunders); in session three, 5...Qb6, 17...Qxe5, 12...Bb4, 8...c5. Not ten small errors a game: one move, every time. That is the first finding, and it held for all 20 losses on the road.</p>

    <h2>2. The routine that turned it: sessions 4 to 10, 1353 → 1619</h2>
    <p>From session four the order changed: the course page, one model game of the line played through, the trainer, and only then the games from the line. The result was immediate: five wins out of five, 1353 → 1454, including the three games from the Caro-Kann line as Black (+20, +19, +18). The same order was kept for the rest of the road, with the three courses in turn (Caro-Kann as Black, Jobava London as White, Chebanenko Slav as Black).</p>
    <p>The numbers behind that: the first 9 games from a line seen the same session went 1 win, 8 losses. The next 90, with the course page, a model game and the trainer first, went 71 wins, 14 draws, 5 losses. Learn a line before you play it.</p>
    <p>The profile's "How you play" page explained what to study next. After five reviewed games it read: accuracy 89%, opening 87, middlegame 90, endgame 95, sharp moments 57, calm moves 90. Sharp moments are positions where one move is much better than the rest, which is tactics, and 57 was the low number. Tactics and reviews came first, and the sharp number rose session by session: 73, 87, 81, 84, 90, 96, 92, 96, 98. The rating followed it: 1502 at session five, 1619 at session ten. The numbers move first, then the results.</p>
    <p>The "one more thing" per session, each taking a few minutes: a Guru review of one of the account's own games (the turning point told as a story, with each side's accuracy by phase); the last game checked against the 5.4 million games in the database (the account's position was reached by 15,28,575 database games at move one, by 1,908 at move five, and by none at move six, where the game left the database); a rook endgame from Gukesh's own game against Panelo (Gijon 2022), "Win it", move by move; a blindfold puzzle typed as notation (the first solved: h4#); a live grandmaster game watched with the engine on.</p>

    <h2>3. Many openings: sessions 14 to 22, 1619 → 2017</h2>
    <p>From session 14 the last game of every session used a different opening from the trainer's catalogue, trained for two moves and then played from move one: the Najdorf, the Catalan, the Petrov, the English, the Grünfeld (the one loss of the set), the King's Gambit, the Berlin, the Dragon, the Slav, the Sveshnikov, the Pirc, the Queen's Indian, the Semi-Slav, the Benoni, the Italian, the Queen's Gambit, the French, the Ruy Lopez, the Nimzo-Indian, the Scotch, the King's Indian, the London: 23 games, 19 wins. Game two of every session was played a level up (100 points above the account): 37 such games, 28 wins, 5 draws.</p>
    <p>Rated puzzles in this stretch: four of four solved, puzzle rating 1508 → 1606. The library's first book opened was Capablanca's <em>Chess Fundamentals</em>, a chapter at a time. The longest game of the road came at session 26: 269 plies against the 2200, a draw by the fifty-move rule.</p>

    <h2>4. Master numbers: sessions 23 to {hero.sessions}, 2017 → {reached ? target : hero.now}</h2>
    <p>No game was lost after session 18. From 2000 up the results were wins and draws: against 2300 and 2400 (sessions 26 to 30), against 2500 (sessions 31 to 36, as Black and as White), and against 2600 (a win in session 35, a draw in session 36). The draws tell their own story: of 21 draws on the whole road, 17 were by threefold repetition, two by stalemate, one by the fifty-move rule, one with no mating material: the engine's way of taking a half point when it finds no progress, which a human would do less often.</p>
    <p>Session 36 ended at 2499, one point short. Session 37 crossed the line: a win against the 2500 as White, a win against the 2600 as Black, a draw and two more wins from the Chebanenko line, 2520. The profile at the end: accuracy 97%, opening 98, middlegame 95, endgame 97, sharp moments 97; 0.2 mistakes a game.</p>

    <h2>5. The study plan, to copy</h2>
    <p>One session is about ninety minutes for a person (about fifteen for the account, which never thinks for long). The order matters more than the time.</p>
    <table>
      <thead><tr><th>Step</th><th>What</th><th>Where</th></tr></thead>
      <tbody>
        {#each PLAN as [step, what, href] (step)}<tr><td><strong>{step}</strong></td><td>{what}</td><td><a {href}>{href.replace('/learn?tab=openings&sub=trainer', 'Learn → Trainer').replace('/learn?tab=openings', 'Learn → Openings').replace('/learn/study/caro-kann', 'the course').replace('/play/fide', 'Play')}</a></td></tr>{/each}
      </tbody>
    </table>

    <h2>6. What the record says works, and what doesn't</h2>
    <ul>
      <li><strong>Works:</strong> slow games only; the review's turning point after every game; a line learned (course page, model game, trainer) before it is played; one new opening a session; game two a level up; reading the profile's low number.</li>
      <li><strong>Doesn't:</strong> playing a line the session it was first seen (1 win in 9); skipping the review (every loss was one move, and the review names it).</li>
      <li><strong>Not shown by this record:</strong> how long a person needs; the practice account's strength rose by setting, a person's by time. Expect the same order of events over two or three years, with the numbers on the profile moving before the rating.</li>
    </ul>
    <p class="label fine">The milestone posts, one per hundred points, are at <a href="/journey">Aarav's journey</a>; the roadmap for your own road is at <a href="/learn/roadmap">Learn → Roadmap</a>. FIDE ratings and titles come only from rated tournaments; CC Rating measures games here against FIDE-rated opponents.</p>
  </article>
</div>

<style>
  .page {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  article {
    padding: 22px 24px;
  }
  header {
    display: flex;
    gap: 18px;
    align-items: center;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  header p {
    margin: 0;
  }
  .eyebrow {
    color: var(--accent);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 12px;
  }
  h1 {
    margin: 4px 0 4px;
    font-size: 28px;
  }
  .honest {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--raised);
    border: 1px solid var(--border);
    margin: 0 0 14px;
    line-height: 1.5;
  }
  h2 {
    margin: 22px 0 8px;
    font-size: 20px;
  }
  article > p,
  article li {
    line-height: 1.6;
    font-size: 16px;
  }
  article > p {
    margin: 0 0 12px;
  }
  ul {
    margin: 0 0 12px;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14.5px;
    margin: 0 0 12px;
  }
  th,
  td {
    text-align: left;
    padding: 7px 8px;
    border-bottom: 1px solid var(--border-soft);
    vertical-align: top;
  }
  .fine {
    margin-top: 16px;
    font-size: 13.5px;
  }
</style>
