# Chess Castles

**Learn · Play · Conquer** — the website at [chesscastles.com](https://chesscastles.com).

Everything chess in one place (online play, puzzles, analysis, live games, tournaments, books, friends and
leaderboards), plus:

1. **FIDE-rated opponents**: computer opponents that play in the style of players at each FIDE rating, from 1000 to 2800.
2. **A 5.4 million game database** beside every review.
3. **An AI opening trainer** built from the moves players at your level really play.
4. **Game Insights** from your chess.com and Lichess games, with a weekly study plan.
5. **Chess Guru**, an AI coach in English, Hindi and Marathi.

Chess Castles is not affiliated with or endorsed by FIDE, Lichess or chess.com.

## Stack

- SvelteKit 2 and Svelte 5 (TypeScript, Vite), built as a single-page app and served by a Cloudflare Worker
  (`wrangler.jsonc`).
- Board: [chessground](https://github.com/lichess-org/chessground); rules: [chessops](https://github.com/niklasf/chessops).
- Engine: Stockfish 19 (WebAssembly, in a Web Worker; `static/engine/` is copied from the `stockfish` package on install).
- Human-like play: [Maia-3](https://github.com/CSSLab/maia3) with ONNX Runtime Web, in a Web Worker (`static/maia-worker.js`).
- Opening book and game database: shards served by separate Workers (`src/lib/book/book.ts`, `src/lib/games/gamesDb.ts`),
  built from over-the-board games from [CaissaBase](https://caissabase.co.uk).
- Accounts: sign-in with Lichess (OAuth with PKCE), exchanged for a Firebase login.
- Players, friends, plans, analytics and the admin page talk to Chess Castles' API worker (not in this repository).
- Lichess API for online play, broadcasts, arenas and puzzles.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # types
npm test           # unit tests
npm run build      # static site in build/
```

Data files are not in this repository (they are built from public sources by the scripts in `scripts/`):
`static/data/` (FIDE rating lists, puzzles), `static/books/` (public-domain books), `static/maia/` (the Maia-3
model, from the [Maia Chess platform](https://github.com/CSSLab/maia-platform-frontend)) and `static/ort/`
(ONNX Runtime Web). Without them the matching features show nothing.

## Licence

Chess Castles' website is free software under the **GNU Affero General Public License v3.0 or later**
([LICENSE](LICENSE)). It builds on:

- chessground and chessops (GPL-3.0-or-later), Stockfish (GPL-3.0), Maia-3 (AGPL-3.0), the Maia Chess platform
  worker (GPL-3.0), ONNX Runtime Web (MIT), Svelte and SvelteKit (MIT), Firebase (Apache-2.0);
- the cburnett chess pieces by Colin M.L. Burnett (GPL);
- the other piece sets from Lichess's collection, each by its author under its own free licence (credited in the board
  picker, src/lib/pieceSets.ts);
- Lichess's chess-openings names and puzzle database (CC0);
- public-domain books from Project Gutenberg and Wikisource.

The names and logos “Chess Castles” and the Chess Castles crest are not covered by the licence: please don't use them
for another site or app.

## Thank you

To [Lichess](https://lichess.org), the free and open-source chess server, for its open API
([support Lichess](https://lichess.org/patron)); to the Stockfish, Maia and CaissaBase teams; and to everyone who
builds free chess software.
