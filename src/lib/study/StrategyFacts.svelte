<script lang="ts">
  /**
   * What happens after the opening in a line, counted from its games
   * (scripts/study/strategy.py): castling, the typical pawn moves of both
   * sides (and how the student's side scored with and without them), where the
   * pieces stand, queen trades, the usual endgame. Every sentence is a count,
   * so it is always true; the plan that scored best is pointed out.
   */
  import type { Lang } from '$lib/coach/i18n';
  import type { StrategyFacts } from './studyData';

  let { facts, side, lang }: { facts: StrategyFacts; side: 'white' | 'black'; lang: Lang } = $props();

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const ME = { en: 'You', hi: 'तुम', mr: 'तू' };
  const opp = $derived(side === 'white' ? 'Black' : 'White');
  const mv = (who: 'me' | 'them', sq: string) => {
    const black = (who === 'me') === (side === 'black');
    return black ? `...${sq}` : sq;
  };
  const PIECE: Record<string, Record<Lang, string>> = { N: { en: 'knight', hi: 'knight', mr: 'knight' }, B: { en: 'bishop', hi: 'bishop', mr: 'bishop' } };
  const EG: Record<string, Record<Lang, string>> = {
    rook: { en: 'rook endgames', hi: 'rook endgames', mr: 'rook endgames' },
    'rook-minor': { en: 'rook and minor piece endgames', hi: 'rook और minor piece वाले endgames', mr: 'rook आणि minor piece चे endgames' },
    minor: { en: 'bishop and knight endgames', hi: 'bishop और knight वाले endgames', mr: 'bishop आणि knight चे endgames' },
    pawn: { en: 'pawn endgames', hi: 'pawn endgames', mr: 'pawn endgames' },
    queen: { en: 'queen endgames', hi: 'queen endgames', mr: 'queen endgames' },
  };

  const lines = $derived.by(() => {
    const f = facts;
    const out: { text: string; key?: boolean }[] = [];
    const L = lang;
    // The plan that scored best: a pawn move of the student's side, played in 25%+ of games, 4+ points better than without it.
    // A pawn push (not a capture) of the student's side, played in 25-90% of games (a real choice), that scored 4+ points better than going without it.
    const best = (f.pawns.me ?? []).filter((p) => p.push !== false && p.share >= 0.25 && p.share <= 0.9 && p.without !== null && p.with - p.without >= 0.04).sort((a, b) => b.with - b.without! - (a.with - a.without!))[0];
    if (best) {
      const m = mv('me', best.sq);
      out.push({
        key: true,
        text: {
          en: `Scored best: ${m}, played in ${pct(best.share)} of games. You score ${pct(best.with)} in games with it and ${pct(best.without!)} in games without it.`,
          hi: `सबसे अच्छा score: ${m}, जो ${pct(best.share)} games में खेला गया। इसके साथ वाले games में तुम्हारा score ${pct(best.with)} है और इसके बिना ${pct(best.without!)}।`,
          mr: `सगळ्यात चांगला score: ${m}, जे ${pct(best.share)} games मध्ये खेळलं गेलं. ते असलेल्या games मध्ये तुझा score ${pct(best.with)} आहे आणि ते नसलेल्या games मध्ये ${pct(best.without!)}.`,
        }[L],
      });
    }
    const myPawns = (f.pawns.me ?? []).filter((p) => p !== best).map((p) => `${mv('me', p.sq)} (${pct(p.share)})`);
    if (myPawns.length)
      out.push({ text: { en: `Your typical pawn moves after the opening: ${myPawns.join(', ')}.`, hi: `Opening के बाद तुम्हारी आम pawn moves: ${myPawns.join(', ')}।`, mr: `Opening नंतर तुझ्या नेहमीच्या pawn moves: ${myPawns.join(', ')}.` }[L] });
    const theirPawns = (f.pawns.them ?? []).map((p) => `${mv('them', p.sq)} (${pct(p.share)})`);
    if (theirPawns.length)
      out.push({ text: { en: `Expect from ${opp}: ${theirPawns.join(', ')}.`, hi: `${opp} से उम्मीद रखो: ${theirPawns.join(', ')}।`, mr: `${opp} कडून अपेक्षा ठेव: ${theirPawns.join(', ')}.` }[L] });
    const c = f.castle;
    if (c?.me && c?.them) {
      const me = c.me;
      const them = c.them;
      out.push({
        text: {
          en: `Castling: you castle kingside in ${pct(me['O-O'] ?? 0)} of games and queenside in ${pct(me['O-O-O'] ?? 0)}; ${opp} castles kingside in ${pct(them['O-O'] ?? 0)} and queenside in ${pct(them['O-O-O'] ?? 0)}.`,
          hi: `Castling: तुम ${pct(me['O-O'] ?? 0)} games में kingside और ${pct(me['O-O-O'] ?? 0)} में queenside castling करते हो; ${opp} ${pct(them['O-O'] ?? 0)} में kingside और ${pct(them['O-O-O'] ?? 0)} में queenside।`,
          mr: `Castling: तू ${pct(me['O-O'] ?? 0)} games मध्ये kingside आणि ${pct(me['O-O-O'] ?? 0)} मध्ये queenside castling करतोस; ${opp} ${pct(them['O-O'] ?? 0)} मध्ये kingside आणि ${pct(them['O-O-O'] ?? 0)} मध्ये queenside.`,
        }[L],
      });
      if ((them['O-O-O'] ?? 0) >= 0.25 && (me['O-O'] ?? 0) >= 0.4)
        out.push({ text: { en: 'Opposite-side castling is common here: pawn storms against the kings decide many games, so count every tempo.', hi: 'यहाँ अलग-अलग तरफ़ castling आम है: king पर pawn storm से बहुत से games तय होते हैं, इसलिए हर tempo गिनो।', mr: 'इथे वेगवेगळ्या बाजूंना castling सामान्य आहे: king वरच्या pawn storm ने बरेच games ठरतात, म्हणून प्रत्येक tempo मोज.' }[L] });
    }
    if (f.pieces?.length) {
      const ps = f.pieces.map((p) => `${PIECE[p.p[0]][L]} ${p.p.slice(1)} (${pct(p.share)})`).join(', ');
      out.push({ text: { en: `Where your pieces stand at move 15: ${ps}.`, hi: `Move 15 पर तुम्हारे pieces कहाँ होते हैं: ${ps}।`, mr: `Move 15 ला तुझे pieces कुठे असतात: ${ps}.` }[L] });
    }
    if (f.queens >= 0.15)
      out.push({ text: { en: `The queens come off by move 25 in ${pct(f.queens)} of games.`, hi: `${pct(f.queens)} games में move 25 तक queens trade हो जाती हैं।`, mr: `${pct(f.queens)} games मध्ये move 25 पर्यंत queens trade होतात.` }[L] });
    const eg = Object.entries(f.endgames ?? {})[0];
    if (eg) out.push({ text: { en: `The most common endgame: ${EG[eg[0]]?.en ?? eg[0]} (${pct(eg[1])} of games). Practise them in the endgame lessons.`, hi: `सबसे आम endgame: ${EG[eg[0]]?.hi ?? eg[0]} (${pct(eg[1])} games)। Endgame lessons में इनका अभ्यास करो।`, mr: `सगळ्यात सामान्य endgame: ${EG[eg[0]]?.mr ?? eg[0]} (${pct(eg[1])} games). Endgame lessons मध्ये त्यांचा सराव कर.` }[L] });
    return out;
  });
</script>

<div class="facts">
  <span class="title">After the opening: what happens in {facts.games.toLocaleString('en-IN')} games of this line</span>
  <ul>
    {#each lines as l, i (i)}<li class:key={l.key}>{l.text}</li>{/each}
  </ul>
  <span class="label note">Counted from the real games of this line ({ME[lang]}: {side === 'white' ? 'White' : 'Black'}).</span>
</div>

<style>
  .facts {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--raised);
  }
  .facts .title {
    font-size: 15px;
  }
  ul {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    line-height: 1.5;
  }
  li.key {
    color: var(--win);
    font-weight: 600;
  }
  .note {
    font-size: 12px;
  }
</style>
