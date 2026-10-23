<script lang="ts">
  /**
   * A Castle Cup's final results (owner, 2026-10-23: "after the tournament there should be a podium celebration:
   * whoever won should feel proud and come again"; "a proper representation of the completed tournament"):
   * - the podium: the three best kids (the FIDE-level players who fill the field are guests, never on it; a kid
   *   alone with them needs half the points), with fireworks;
   * - my finish: place, points, and the rating I played like (my performance);
   * - the best of each group;
   * - every player's round-by-round results (opponent's place, colour, win/draw/loss), points, tie-break and
   *   performance, and each of my games to look at on the analysis board;
   * - the next cups.
   */
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import Fireworks from '$lib/components/Fireworks.svelte';
  import { sounds } from '$lib/sound';
  import { GROUP_NAME, MIN_GAMES, type CupGame, type CupView, type Standing } from './api';

  let { v, me, name }: { v: CupView; me: string; name: string } = $props();

  const st = $derived(v.standings);
  /** The kids' podium (as the server's kidsPodium). */
  const podium = $derived.by((): Standing[] => {
    const kids = st.filter((r) => !r.bot && !r.out && r.played > 0);
    if (kids.length === 1) return kids[0].score * 2 >= kids[0].played ? kids : [];
    // A medal needs at least a point.
    return kids.filter((r) => r.score >= 1).slice(0, 3);
  });
  const mine = $derived(st.find((r) => r.uid === me));
  const myMedal = $derived(podium.findIndex((r) => r.uid === me) + 1);
  const groupBest = $derived.by(() => {
    const seen = new Set<string>();
    return st.filter((r) => !r.bot && !r.provisional && r.group !== 'open' && !seen.has(r.group) && seen.add(r.group));
  });
  const rankOf = $derived(new Map(st.map((r) => [r.uid, r.rank])));
  const rounds = $derived(Array.from({ length: v.rounds }, (_, i) => i + 1));
  /** One player's result in a round: "W 3" (beat the player in 3rd place), "½ 5", "L 2", "+" (a bye), "–". */
  function cell(uid: string, round: number): { text: string; kind: 'w' | 'd' | 'l' | 'bye' | 'none'; white?: boolean; game?: CupGame } {
    const g = v.games.find((x) => x.round === round && (x.white === uid || x.black === uid));
    if (!g) return { text: '–', kind: 'none' };
    if (!g.black) return { text: '+', kind: 'bye' };
    const white = g.white === uid;
    const opp = rankOf.get(white ? g.black : g.white) ?? '?';
    const kind = g.result === '1/2-1/2' ? 'd' : (g.result === '1-0') === white ? 'w' : 'l';
    return { text: `${kind === 'w' ? '1' : kind === 'd' ? '½' : '0'} · ${opp}`, kind, white, game: g };
  }
  const medal = (n: number) => ['🥇', '🥈', '🥉'][n - 1] ?? '';
  const myGames = $derived(v.games.filter((g) => g.black && (g.white === me || g.black === me)).sort((a, b) => a.round - b.round));
  const analyse = (g: CupGame) => `/analysis?moves=${g.moves.join(',')}&title=${encodeURIComponent(`${g.whiteName} – ${g.blackName} (${name}, round ${g.round})`)}${g.black === me ? '&side=black' : ''}`;
  const date = $derived(new Date(v.startAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }));

  // The fanfare once, when the results first show (for everyone: the champions are cheered).
  let party = $state(false);
  onMount(() => {
    party = podium.length > 0;
    if (myMedal) sounds.win();
    else if (podium.length) sounds.end();
  });
</script>

{#if party}<Fireworks rockets={myMedal ? 12 : 6} />{/if}

<section class="card final" aria-labelledby="fin-h">
  <p class="kicker">🏁 {$t('cups.finalH')} · {date}</p>
  <h2 id="fin-h" class="display">{name}</h2>

  {#if podium.length}
    <ol class="steps" aria-label={$t('cups.podiumH')}>
      {#each [1, 0, 2] as i (i)}
        {@const r = podium[i]}
        {#if r}
          <li class="step s{i + 1}" class:me={r.uid === me}>
            <span class="m">{medal(i + 1)}</span>
            <span class="n">{r.name}</span>
            <span class="sc num">{$t('cups.pts', { n: r.score })}</span>
            <span class="base" aria-hidden="true">{i + 1}</span>
          </li>
        {/if}
      {/each}
    </ol>
  {:else}
    <p class="muted center">{$t('cups.noPodium')}</p>
  {/if}

  {#if mine}
    <div class="you" class:gold={myMedal === 1} class:medal={myMedal > 0}>
      {#if myMedal}<span class="big-medal">{medal(myMedal)}</span>{/if}
      <div>
        <strong>{myMedal ? $t('cups.youMedal', { place: myMedal }) : $t('cups.yourPlace', { n: mine.rank, of: st.length, score: mine.score })}</strong>
        {#if mine.perf}<span>{$t('cups.playedLike', { r: mine.perf })}</span>{/if}
      </div>
    </div>
  {/if}

  {#if groupBest.length}
    <p class="groups">{#each groupBest as g (g.uid)}<span>🏅 {$t('cups.bestIn', { group: GROUP_NAME[g.group] })}: <b>{g.name}</b></span>{/each}</p>
  {/if}

  <div class="acts">
    <a class="btn primary" href="/cups">{$t('cups.nextCups')}</a>
    <a class="btn ghost" href="/awards">{$t('cups.seeAwards')}</a>
  </div>
</section>

<section class="card results" aria-labelledby="res-h">
  <h3 id="res-h">{$t('cups.resultsH')}</h3>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th class="nm">{$t('cups.player')}</th>
          {#each rounds as r (r)}<th class="rd">R{r}</th>{/each}
          <th class="num">{$t('cups.points')}</th>
          <th class="num">TB</th>
          <th class="num">{$t('cups.perf')}</th>
        </tr>
      </thead>
      <tbody>
        {#each st as r (r.uid)}
          <tr class:me={r.uid === me} class:out={r.out}>
            <td class="num">{r.rank}</td>
            <td class="nm">
              {r.name}
              <span class="sub">{r.rating} · <span class="grp g-{r.group}" title={r.provisional ? $t('cups.provisional', { n: MIN_GAMES }) : ''}>{GROUP_NAME[r.group]}{r.provisional ? '?' : ''}</span></span>
            </td>
            {#each rounds as rd (rd)}
              {@const c = cell(r.uid, rd)}
              <td class="rd {c.kind}" title={c.white === undefined ? '' : c.white ? 'White' : 'Black'}>
                {#if c.white !== undefined}<i class="col" class:w={c.white}></i>{/if}{c.text}
              </td>
            {/each}
            <td class="num b">{r.score}</td>
            <td class="num">{r.buch}</td>
            <td class="num">{r.perf ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="label small">{$t('cups.resultsKey')}</p>
</section>

{#if myGames.length}
  <section class="card mygames" aria-labelledby="mg-h">
    <h3 id="mg-h">{$t('cups.myGamesH')}</h3>
    <ul>
      {#each myGames as g (g.id)}
        {@const c = cell(me, g.round)}
        <li>
          <span class="r">R{g.round}</span>
          <span class="res {c.kind}">{c.kind === 'w' ? '1' : c.kind === 'd' ? '½' : '0'}</span>
          <span class="vs">{g.white === me ? g.blackName : g.whiteName}</span>
          {#if g.moves.length}<a class="btn small ghost" href={analyse(g)}>{$t('cups.analyse')}</a>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .card {
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .final {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    background:
      radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, var(--gold) 26%, transparent), transparent 70%),
      var(--card);
    border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
  }
  .kicker {
    margin: 0;
    font: 800 12px var(--font-body);
    letter-spacing: 0.06em;
    color: var(--muted);
    text-transform: uppercase;
  }
  h2 {
    margin: 0;
    font-size: 26px;
  }
  .steps {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 480px;
  }
  .step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    animation: rise 0.6s ease-out both;
  }
  .step.s1 {
    animation-delay: 0.5s;
  }
  .step.s2 {
    animation-delay: 0.25s;
  }
  @keyframes rise {
    from {
      transform: translateY(30px);
      opacity: 0;
    }
  }
  .step .m {
    font-size: 40px;
  }
  .step.s1 .m {
    font-size: 54px;
    animation: shine 2.4s ease-in-out infinite 1.2s;
  }
  @keyframes shine {
    50% {
      transform: scale(1.12) rotate(-6deg);
    }
  }
  .step .n {
    font-weight: 800;
    word-break: break-word;
    line-height: 1.15;
  }
  .step .sc {
    font-size: 12.5px;
    color: var(--muted);
    font-weight: 700;
  }
  .step .base {
    width: 100%;
    margin-top: 4px;
    display: grid;
    place-items: center;
    border-radius: 10px 10px 4px 4px;
    font: 800 22px var(--font-title);
    color: #1b1300;
    background: linear-gradient(180deg, #e5e7eb, #9ca3af);
    height: 54px;
  }
  .step.s1 .base {
    height: 86px;
    background: linear-gradient(180deg, #fde68a, var(--gold));
  }
  .step.s3 .base {
    height: 38px;
    background: linear-gradient(180deg, #fdba74, #c2410c);
  }
  .step.me .n {
    color: var(--gold);
  }
  .you {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 14px;
    background: var(--raised);
    text-align: left;
  }
  .you.medal {
    background: color-mix(in srgb, var(--gold) 18%, var(--raised));
    border: 1px solid var(--gold);
  }
  .you div {
    display: flex;
    flex-direction: column;
  }
  .you span {
    color: var(--muted);
    font-weight: 700;
    font-size: 14px;
  }
  .big-medal {
    font-size: 44px !important;
    color: inherit !important;
  }
  .groups {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }
  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .muted {
    color: var(--muted);
  }
  .center {
    text-align: center;
  }
  h3 {
    margin: 0 0 8px;
    font: 800 17px var(--font-title);
  }
  .scroll {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  th {
    text-align: left;
    font-size: 11.5px;
    color: var(--muted);
    padding: 4px 6px;
    white-space: nowrap;
  }
  td {
    padding: 6px;
    border-top: 1px solid var(--border);
    white-space: nowrap;
  }
  td.nm {
    white-space: normal;
    min-width: 120px;
    font-weight: 700;
  }
  .sub {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--muted);
  }
  tr.me td {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
  }
  tr.out td {
    opacity: 0.5;
  }
  .rd {
    text-align: center;
    font-weight: 700;
  }
  td.w {
    color: var(--win);
  }
  td.l {
    color: var(--loss);
  }
  td.bye,
  td.none {
    color: var(--muted);
  }
  .col {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #111;
    border: 1px solid #888;
    margin-right: 4px;
    vertical-align: middle;
  }
  .col.w {
    background: #fff;
  }
  .num {
    text-align: right;
  }
  .b {
    font-weight: 800;
  }
  .grp {
    font: 800 10.5px var(--font-body);
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--raised);
  }
  .g-u1200 {
    background: color-mix(in srgb, #22c55e 22%, var(--raised));
  }
  .g-u1400 {
    background: color-mix(in srgb, #38bdf8 22%, var(--raised));
  }
  .g-u1600 {
    background: color-mix(in srgb, #a855f7 22%, var(--raised));
  }
  .small {
    font-size: 12px;
  }
  .mygames ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mygames li {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mygames .r {
    font-weight: 800;
    color: var(--muted);
    width: 28px;
  }
  .mygames .res {
    font-weight: 800;
    width: 18px;
  }
  .res.w {
    color: var(--win);
  }
  .res.l {
    color: var(--loss);
  }
  .mygames .vs {
    flex: 1;
    font-weight: 700;
    min-width: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .step,
    .step.s1 .m {
      animation: none;
    }
  }
</style>
