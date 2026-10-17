<svelte:head><title>About · Chess Castles</title></svelte:head>

<div class="page">
  <h1 class="display">About Chess Castles</h1>
  <p>Chess Castles is a chess site and Android app for players in India: play, learn, analyse, watch and follow ratings in one place. It is free to start, with optional plans.</p>

  <section class="card thanks">
    <h2 class="title">Thank you, Lichess ♥</h2>
    <p>
      Online games, arena tournaments, live broadcasts, the puzzle collection and the names of our openings come from
      <a href="https://lichess.org" target="_blank" rel="noopener">Lichess</a>, the free and open-source chess server run by a non-profit
      association. Thank you to the Lichess team and its volunteers for keeping their API open to everyone. If you enjoy playing
      here, please consider <a href="https://lichess.org/patron" target="_blank" rel="noopener">supporting Lichess</a>.
    </p>
  </section>

  <section class="card">
    <h2 class="title">FIDE-rated opponents</h2>
    <p>
      Our FIDE-rated opponents are computer opponents made to play in the style of players at the FIDE rating you pick: their
      openings, their plans, their use of the clock and their mistakes. They are not real people and not FIDE-rated players.
      Your results against them make your CC Rating, Chess Castles' own rating, which is not an official FIDE rating.
    </p>
    <p class="label">Chess Castles is not affiliated with or endorsed by FIDE (Fédération Internationale des Échecs).</p>
  </section>

  <section class="card">
    <h2 class="title">Games, data and AI</h2>
    <ul>
      <li>
        <strong>Over-the-board games</strong>: the opening book, the FIDE-rated opponents and the 5.4 million game database use games from
        <a href="https://caissabase.co.uk" target="_blank" rel="noopener">CaissaBase</a>, a free collection of tournament games (moves only, no annotations). Thank you to its maintainer.
      </li>
      <li><strong>Chess Guru</strong> is an AI coach, built with Llama (Meta's Llama 3.3 and Llama 4, under their community licences), run on Cloudflare Workers AI. Guru is a character, not a titled player.</li>
      <li><strong>Human-like play</strong>: the Maia-3 model by the CSSLab, University of Toronto (<a href="https://github.com/CSSLab/maia3" target="_blank" rel="noopener">AGPL-3.0</a>).</li>
      <li><strong>Engine</strong>: Stockfish 19 (GPL-3.0).</li>
      <li><strong>Ratings and events</strong>: the public FIDE rating list and All India Chess Federation event pages. They may be incomplete or out of date.</li>
      <li><strong>Your own games</strong> for Game Insights come from chess.com's and Lichess's public game archives, only when you ask.</li>
    </ul>
  </section>

  <section class="card">
    <h2 class="title">Open-source software</h2>
    <ul>
      <li><a href="https://github.com/lichess-org/chessground" target="_blank" rel="noopener">chessground</a>: the board, by Lichess (GPL-3.0-or-later)</li>
      <li><a href="https://github.com/niklasf/chessops" target="_blank" rel="noopener">chessops</a>: chess rules, by Niklas Fiekas (GPL-3.0-or-later)</li>
      <li><a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">Stockfish.js</a>: Stockfish 19 in the browser (GPL-3.0)</li>
      <li><a href="https://github.com/CSSLab/maia3" target="_blank" rel="noopener">Maia-3</a> (AGPL-3.0); the browser worker from the <a href="https://github.com/CSSLab/maia-platform-frontend" target="_blank" rel="noopener">Maia Chess platform</a> (GPL-3.0), run with <a href="https://github.com/microsoft/onnxruntime" target="_blank" rel="noopener">ONNX Runtime Web</a> (MIT)</li>
      <li><a href="https://github.com/lichess-org/chess-openings" target="_blank" rel="noopener">Lichess chess-openings</a>: the 3,865 opening names (CC0); puzzles from the <a href="https://database.lichess.org" target="_blank" rel="noopener">Lichess puzzle database</a> (CC0)</li>
      <li>Endgame lessons are checked against the <a href="https://tablebase.lichess.ovh" target="_blank" rel="noopener">Lichess tablebase</a></li>
      <li><a href="https://svelte.dev" target="_blank" rel="noopener">Svelte and SvelteKit</a> (MIT), <a href="https://firebase.google.com" target="_blank" rel="noopener">Firebase</a> (Apache-2.0)</li>
      <li>Pieces: Colin M.L. Burnett (cburnett), GPL</li>
      <li>Books: public-domain chess classics from <a href="https://www.gutenberg.org" target="_blank" rel="noopener">Project Gutenberg</a> and <a href="https://en.wikisource.org" target="_blank" rel="noopener">Wikisource</a> (Capablanca, Staunton, Philidor, Franklin, Poe and others)</li>
    </ul>
    <p class="label">Chess Castles' website is free software under the GNU Affero General Public License v3.0 or later, like the libraries it builds on. Its source code is on <a href="https://github.com/DineshTech007/chesscastles-web" target="_blank" rel="noopener">GitHub</a>.</p>
  </section>

  <p class="label">FIDE, Lichess, chess.com and their logos are trademarks of their owners, used only to name them. Chess Castles is independent and not connected with any of them.</p>
</div>

<style>
  .page {
    max-width: 760px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  h1 {
    font-size: 42px;
  }
  p {
    margin: 0;
    color: var(--text-2);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
.thanks {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .card .title {
    font-size: 19px;
  }
  ul {
    margin: 0;
    padding-left: 20px;
    color: var(--text-2);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
