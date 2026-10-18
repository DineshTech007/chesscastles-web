<script lang="ts">
  /**
   * A real endgame from a master's game: the student plays the master's side
   * and finds each move. A different move the engine rates as just as good is
   * accepted ("good move too"), then the game's move is played so the lesson
   * follows the real game. Guru explains each master move with checked facts.
   */
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import TeacherBadge from './TeacherBadge.svelte';
  import { destsOf, fenOf, keyOf, moveFromKeys, moveToUci, positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
  import { sameMove } from '$lib/study/openingTree';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { engine } from '$lib/engine/stockfish';
  import { LEGENDS } from '$lib/coach/content/legends';
  import { fill, LANGS, tr, type L10n, type Lang } from '$lib/coach/i18n';
  import { loadCoach, updateCoach } from '$lib/coach/progress';
  import { speak, stopSpeaking, voicesReady } from '$lib/coach/voice';
  import { playMoveSound } from '$lib/sound';
  import { POINTS, study } from '$lib/study/progress';
  import { CATS, GOALS, KIND_TIP, SAY, shortName, type Teacher } from './content';
  import { eventLabel, lessonTitle, opponentOf, saveStars, type MasterLesson } from './data';
  import { endgameNotes, endNoteText, type EndNote } from './notes';
  import { noteText, type Note } from '$lib/coach/explain';
  import { openingNotes } from '$lib/coach/facts';

  /**
   * `teacher`: one of the endgame teachers. Or, for a middlegame lesson from a
   * model game (opening study), `player` names the strong player, `tips` are
   * the intro (the line's plans), `title` the lesson's name and `starsId` where
   * the stars are kept.
   */
  let {
    lesson,
    teacher,
    nextHref,
    player,
    tips,
    title,
    starsId,
  }: {
    lesson: MasterLesson;
    teacher?: Teacher;
    nextHref?: string;
    player?: string;
    tips?: L10n[];
    title?: string;
    starsId?: string;
  } = $props();
  const middlegame = $derived(!teacher);

  type Phase = 'intro' | 'yours' | 'checking' | 'theirs' | 'done';
  /** Why a move is good: an endgame fact, or an opening and tactics fact (middlegame lessons). */
  type AnyNote = { end: EndNote } | { open: Note };
  interface Line {
    text: L10n;
    vars: Record<string, string | number>;
    notes?: AnyNote[];
    tone: 'guru' | 'good' | 'only' | 'miss' | 'reply' | 'end';
  }

  const name = $derived(teacher ? (LEGENDS[teacher.id]?.name ?? teacher.id) : (player ?? ''));
  const opponent = $derived(opponentOf(lesson));
  const cat = $derived(CATS.find((c) => c.id === lesson.cat));
  const teacherMoves = $derived(lesson.plies.filter((p) => p.e !== undefined).length);

  let lang = $state<Lang>('en');
  let voiceOn = $state(true);
  let voiceName: string | undefined;
  let phase = $state<Phase>('intro');
  // The page remounts this component for each lesson.
  let pos = $state<Chess>(positionFromFen(untrack(() => lesson.fen)));
  let shown = $state(untrack(() => lesson.fen));
  let lastMove = $state<Key[] | undefined>();
  let shapes = $state<DrawShape[]>([]);
  let index = $state(0);
  let tries = 0;
  let missedHere = false;
  let misses = $state(0);
  let hints = $state(0);
  let found = $state(0);
  let stars = $state(0);
  let lines = $state<Line[]>([]);
  let sans = $state<string[]>([]);
  let token = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (ms: number, fn: () => void) => {
    const t = token;
    const id = setTimeout(() => {
      timers.delete(id);
      if (t === token) fn();
    }, ms);
    timers.add(id);
  };

  onMount(async () => {
    const prefs = loadCoach();
    lang = prefs.lang;
    voiceOn = prefs.voice;
    voiceName = prefs.voices[prefs.lang];
    await voicesReady();
  });
  onDestroy(() => {
    token++;
    for (const t of timers) clearTimeout(t);
    stopSpeaking();
  });

  const vars = $derived({ teacher: shortName(name), full: name, opponent, event: eventLabel(lesson) });
  const lineText = (l: Line) => [fill(tr(l.text, lang), l.vars), ...(l.notes ?? []).map((n) => ('end' in n ? endNoteText(n.end, lang) : noteText(n.open, lang)))].join(' ');

  function say(text: L10n, tone: Line['tone'], extra: Record<string, string | number> = {}, notes?: AnyNote[], voice = true) {
    const l: Line = { text, vars: { ...vars, ...extra }, notes, tone };
    lines = [...lines.slice(-5), l];
    if (voice && voiceOn) void speak(lineText(l), lang, voiceName);
  }

  const introText = $derived.by(() => {
    if (!cat) return [fill(tr(SAY.game, lang), vars), fill(tr(SAY.middlegame, lang), vars), ...(tips ?? []).map((t) => tr(t, lang))];
    const tip = lesson.cat === 'minor' && lesson.kind ? KIND_TIP[lesson.kind] : cat.tip;
    return [fill(tr(SAY.game, lang), vars), fill(tr(GOALS[lesson.goal].text, lang), vars), tr(tip, lang)];
  });

  function start() {
    token++;
    pos = positionFromFen(lesson.fen);
    shown = lesson.fen;
    lastMove = undefined;
    shapes = [];
    index = 0;
    tries = 0;
    missedHere = false;
    misses = 0;
    hints = 0;
    found = 0;
    stars = 0;
    sans = [];
    lines = [];
    // On a phone the board is above the panel: bring it back into view.
    if (window.innerWidth <= 900) document.querySelector('.board-col')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    yourTurn();
  }

  function yourTurn() {
    tries = 0;
    missedHere = false;
    phase = 'yours';
    say(SAY.yourMove, 'guru', {}, undefined, false);
  }

  /** Plays a ply of the game on the real position. */
  function play(uci: string): { san: string; notes: AnyNote[] } | undefined {
    const m = uciToMove(uci);
    if (!m || !pos.isLegal(m)) return undefined;
    const san = sanOf(pos, m);
    const notes: AnyNote[] = endgameNotes(pos, m).map((n) => ({ end: n }));
    // In the middlegame, the opening and tactics facts (development, castling, pins, forks...) too.
    if (middlegame && notes.length < 2) for (const n of openingNotes(pos, m).slice(0, 2 - notes.length)) notes.push({ open: n });
    playMoveSound(pos, m);
    const next = pos.clone();
    next.play(m);
    pos = next;
    shown = fenOf(next);
    lastMove = [keyOf(m.from), keyOf(m.to)];
    sans = [...sans, san];
    index++;
    return { san, notes };
  }

  /** The master's move is on the board: then the opponent's reply, or the end. */
  function afterTeacher() {
    if (index >= lesson.plies.length) return later(900, finish);
    phase = 'theirs';
    later(1100, () => {
      const r = play(lesson.plies[index].u);
      if (r) say(SAY.reply, 'reply', { san: r.san }, undefined, false);
      if (index >= lesson.plies.length) return later(700, finish);
      later(350, yourTurn);
    });
  }

  function teacherPlays(tone: 'good' | 'only' | 'miss', text: L10n) {
    const ply = lesson.plies[index];
    const r = play(ply.u);
    shapes = [];
    if (!r) return finish();
    say(text, tone, { san: r.san }, r.notes);
    if (ply.c && tone !== 'miss') say(SAY.only, 'only', {}, undefined, false);
    afterTeacher();
  }

  const band = (s: number) => (s >= 150 ? 1 : s <= -150 ? -1 : 0);

  async function onmove(orig: Key, dest: Key) {
    if (phase !== 'yours') return;
    const ply = lesson.plies[index];
    const expected = uciToMove(ply.u);
    let m = moveFromKeys(pos, orig, dest);
    // A promotion: the piece the master chose (the board always offers a queen).
    if (m.promotion && expected?.promotion && expected.from === m.from && expected.to === m.to) m = { ...m, promotion: expected.promotion };
    if (!pos.isLegal(m)) return;
    if (sameMove(fenOf(pos), moveToUci(m), ply.u)) {
      if (!missedHere) found++;
      return teacherPlays(ply.c ? 'only' : 'good', SAY.correct);
    }
    // Another move: show it, and ask the engine whether it is as good.
    phase = 'checking';
    const t = token;
    const tried = pos.clone();
    playMoveSound(pos, m);
    tried.play(m);
    shown = fenOf(tried);
    lastMove = [orig, dest];
    const info = tried.isEnd() ? undefined : await engine.evaluate(fenOf(tried), 12, 1, 1500);
    if (t !== token) return;
    let score: number | undefined;
    if (tried.isCheckmate()) score = 2000;
    else if (tried.isStalemate() || tried.isInsufficientMaterial()) score = 0;
    else if (info) {
      const white = info.mate !== undefined ? (info.mate > 0 ? 2000 : -2000) : Math.max(-2000, Math.min(2000, info.cp ?? 0));
      score = lesson.color === 'white' ? white : -white;
    }
    const e = ply.e ?? 0;
    const asGood = score !== undefined && (score >= e - 60 || (!ply.c && band(score) >= band(e) && score >= e - 250 && (band(e) < 1 || score >= 150)));
    if (asGood) {
      if (!missedHere) found++;
      later(900, () => {
        shown = fenOf(pos);
        teacherPlays('good', SAY.alsoGood);
      });
      return;
    }
    tries++;
    if (!missedHere) {
      missedHere = true;
      misses++;
    }
    say(lesson.goal === 'hold' ? SAY.retryHold : SAY.retry, 'miss', {}, undefined, tries >= 2 ? false : true);
    later(800, () => {
      shown = fenOf(pos);
      lastMove = undefined;
      if (tries >= 2) return reveal();
      phase = 'yours';
    });
  }

  function reveal() {
    const m = uciToMove(lesson.plies[index].u);
    if (!m) return;
    phase = 'checking';
    if (!missedHere) {
      missedHere = true;
      misses++;
    }
    shapes = [{ orig: keyOf(m.from), dest: keyOf(m.to), brush: 'green' }];
    later(1300, () => teacherPlays('miss', SAY.reveal));
  }

  function hint() {
    if (phase !== 'yours') return;
    const m = uciToMove(lesson.plies[index].u);
    if (!m) return;
    hints++;
    shapes = [{ orig: keyOf(m.from), brush: 'yellow' }];
  }

  function finish() {
    phase = 'done';
    shapes = [];
    const slips = misses + hints;
    stars = slips === 0 ? 3 : slips <= 2 ? 2 : 1;
    if (saveStars(teacher?.id ?? starsId ?? 'study', lesson.game, stars)) study.log('lesson', POINTS.lessonFinished, `${name}: ${title ?? lessonTitle(lesson)}`);
    const won = lesson.result !== '1/2-1/2';
    const text = lesson.end === 'end' ? (won ? SAY.endWin : SAY.endDraw) : lesson.end === 'decisive' ? SAY.decisive : won ? SAY.laterWin : SAY.laterDraw;
    say(text, 'end');
  }

  function setLang(l: Lang) {
    lang = l;
    voiceName = loadCoach().voices[l];
    updateCoach({ lang: l });
  }
  function toggleVoice() {
    voiceOn = !voiceOn;
    updateCoach({ voice: voiceOn });
    if (!voiceOn) stopSpeaking();
  }

  const interactive = $derived(phase === 'yours' && shown === fenOf(pos));
  const dests = $derived(interactive ? destsOf(pos) : new Map());
  const moveNo = $derived(phase === 'done' ? teacherMoves : Math.min(teacherMoves, Math.floor(index / 2) + 1));
</script>

<div class="lesson">
  <section class="board-col" aria-label="Lesson board">
    {#if lines.length && phase !== 'intro'}
      {@const l = lines[lines.length - 1]}
      <p class="phone-say line {l.tone}" aria-hidden="true">{phase === 'checking' ? 'Checking your move…' : lineText(l)}</p>
    {/if}
    <div class="board-box">
      <Board
        fen={shown}
        orientation={lesson.color}
        turnColor={pos.turn}
        movable={interactive ? lesson.color : undefined}
        {dests}
        {lastMove}
        check={pos.isCheck() && shown === fenOf(pos)}
        {shapes}
        label="Lesson board"
        {onmove}
      />
    </div>
    {#if phase !== 'intro' && phase !== 'done'}
      <div class="tools">
        <button class="btn" onclick={hint} disabled={phase !== 'yours'}><Icon name="bulb" size={16} />Hint</button>
        <button class="btn" onclick={reveal} disabled={phase !== 'yours'}><Icon name="eye" size={16} />Show {shortName(name)}'s move</button>
        <button class="btn ghost" onclick={start}><Icon name="replay" size={16} />Restart</button>
      </div>
    {/if}
  </section>

  <aside class="panel side" aria-label="Lesson">
    <div class="who">
      {#if teacher}<TeacherBadge id={teacher.id} group={teacher.group} size={44} />{:else}<span class="initials" aria-hidden="true">{name.split(/[ ,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>{/if}
      <div class="who-text">
        <span class="title">{name}</span>
        <span class="label">vs {opponent} · {eventLabel(lesson)}</span>
      </div>
    </div>
    <div class="meta">
      {#if cat}
        <span class="pill goal {lesson.goal}">{GOALS[lesson.goal].label}</span>
        <span class="label">{lessonTitle(lesson).split(' vs ')[0]}</span>
      {:else}
        <span class="pill goal win">Middlegame</span>
        {#if title}<span class="label">{title}</span>{/if}
      {/if}
      {#if phase !== 'intro'}<span class="label progress">Move {moveNo} of {teacherMoves}</span>{/if}
    </div>

    {#if phase === 'intro'}
      <div class="talk">
        {#each introText as p (p)}<p>{p}</p>{/each}
      </div>
      <button class="btn primary big" onclick={() => (start(), voiceOn && void speak(introText.join(' '), lang, voiceName))}>
        <Icon name="play" size={18} />Start the lesson
      </button>
    {:else}
      <div class="talk" aria-live="polite">
        {#each lines as l, i (i + lines.length)}
          <p class="line {l.tone}" class:old={i < lines.length - 2}>
            {#if l.tone === 'good' || l.tone === 'only'}<Icon name="check" size={16} color="var(--win)" />{:else if l.tone === 'miss'}<Icon name="undo" size={16} color="var(--engine)" />{:else if l.tone === 'end'}<Icon name="trophy" size={16} color="var(--gold)" />{/if}
            <span>{lineText(l)}</span>
          </p>
        {/each}
        {#if phase === 'checking'}<p class="line guru"><span class="label">Checking your move…</span></p>{/if}
      </div>
    {/if}

    {#if phase === 'done'}
      <div class="result">
        <span class="stars" aria-label="{stars} of 3 stars">
          {#each [1, 2, 3] as s (s)}<Icon name="star" size={30} color={s <= stars ? 'var(--gold)' : 'var(--border)'} />{/each}
        </span>
        <span class="label">You found {found} of {teacherMoves} moves{hints ? ` · ${hints} ${hints === 1 ? 'hint' : 'hints'}` : ''}.</span>
        <div class="end-btns">
          {#if nextHref}<a class="btn primary" href={nextHref}>Next lesson<Icon name="chevron" size={16} /></a>{/if}
          <button class="btn" onclick={start}><Icon name="replay" size={16} />Try again</button>
          <a class="btn ghost" href="/analysis?db={lesson.game}&key={polyglotKey(positionFromFen(lesson.fen)).toString(16)}">See the whole game</a>
        </div>
      </div>
    {/if}

    {#if sans.length}
      <p class="moves label">
        {#each sans as s, i (i)}<span class:mine={i % 2 === 0}>{s}</span>{' '}{/each}
      </p>
    {/if}

    <div class="prefs">
      <div class="segmented" role="group" aria-label="Guru's language">
        {#each LANGS as l (l.id)}
          <button aria-pressed={lang === l.id} onclick={() => setLang(l.id)}>{l.name}</button>
        {/each}
      </div>
      <button class="icon-btn" onclick={toggleVoice} aria-label={voiceOn ? 'Turn the voice off' : 'Turn the voice on'} title="Voice">
        <Icon name={voiceOn ? 'speaker' : 'mute'} size={18} />
      </button>
    </div>
  </aside>
</div>

<style>
  .initials {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 18px;
    color: var(--live);
    background: color-mix(in srgb, var(--live) 16%, var(--card));
    border: 2px solid color-mix(in srgb, var(--live) 60%, transparent);
  }
  .lesson {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: 20px;
    align-items: start;
  }
  .board-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .board-box {
    width: 100%;
    max-width: min(640px, calc(100vh - 140px));
    margin: 0 auto;
  }
  .tools {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }
  .who {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .who-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .who-text .title {
    font-size: 18px;
  }
  .meta {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .progress {
    margin-left: auto;
  }
  .goal.win {
    color: var(--win);
  }
  .goal.squeeze {
    color: var(--live);
  }
  .goal.hold {
    color: var(--engine);
  }
  .talk {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 120px;
  }
  .talk p {
    margin: 0;
    line-height: 1.5;
  }
  .line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--raised);
  }
  .line :global(svg) {
    flex: none;
    margin-top: 3px;
  }
  .line.old {
    opacity: 0.6;
  }
  .line.only {
    background: color-mix(in srgb, var(--gold) 16%, var(--raised));
  }
  .line.miss {
    background: color-mix(in srgb, var(--engine) 12%, var(--raised));
  }
  .line.reply {
    background: transparent;
    color: var(--muted);
    padding: 2px 10px;
  }
  .line.end {
    background: color-mix(in srgb, var(--win) 14%, var(--raised));
  }
  .big {
    height: 48px;
    font-size: 16px;
  }
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .stars {
    display: flex;
    gap: 4px;
  }
  .end-btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .moves {
    margin: 0;
    line-height: 1.6;
    word-break: break-word;
  }
  .moves .mine {
    color: var(--text);
    font-weight: 600;
  }
  .prefs {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--border-soft);
    padding-top: 12px;
  }
  .phone-say {
    display: none;
    margin: 0;
    font-size: 14px;
  }
  @media (max-width: 900px) {
    .lesson {
      grid-template-columns: 1fr;
    }
    .phone-say {
      display: block;
    }
    .board-box {
      max-width: 100%;
    }
  }
</style>
