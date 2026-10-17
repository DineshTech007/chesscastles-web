<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { fenOf, keyOf, positionFromFen, START_FEN, uciToMove } from '$lib/chess/position';
  import { polyglotKey } from '$lib/chess/polyglot';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import { LEGENDS } from '$lib/coach/content/legends';
  import { LANGS, tr, type Lang } from '$lib/coach/i18n';
  import { loadCoach, markDone, updateCoach } from '$lib/coach/progress';
  import { POINTS, study } from '$lib/study/progress';
  import type { Lesson, Slide } from '$lib/coach/types';
  import { speak, speaking, stopSpeaking, voicesReady } from '$lib/coach/voice';
  import { playMoveSound } from '$lib/sound';

  /** A lesson's slides, shown one by one with the board, Guru's words and the voice. */
  let { lesson, back = '/coach', backLabel = 'All lessons' }: { lesson: Lesson; back?: string; backLabel?: string } = $props();
  const id = $derived(lesson.id);
  let index = $state(0);
  let lang = $state<Lang>('en');
  let voiceOn = $state(true);
  let voiceName: string | undefined;
  // The board.
  let pos = $state<Chess>(positionFromFen(START_FEN));
  let lastMove = $state<Key[] | undefined>();
  let shapes = $state<DrawShape[]>([]);
  let playing = $state(false);
  let token = 0;

  const slide = $derived<Slide | undefined>(lesson.slides[index]);
  const total = $derived(lesson.slides.length);
  const fen = $derived(fenOf(pos));

  onMount(async () => {
    const prefs = loadCoach();
    lang = prefs.lang;
    voiceOn = prefs.voice;
    voiceName = prefs.voices[prefs.lang];
    await voicesReady();
    show(0);
  });
  onDestroy(() => {
    token++;
    stopSpeaking();
  });

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const marks = (s: Slide): DrawShape[] => (s.marks ?? []).map((sq) => ({ orig: sq as Key, brush: 'yellow' }));

  /** Shows slide i: its position, then plays its moves, then its arrows; reads the text aloud. */
  async function show(i: number) {
    const t = ++token;
    index = i;
    const s = lesson.slides[i];
    pos = positionFromFen(s.fen);
    lastMove = undefined;
    shapes = marks(s);
    playing = false;
    if (voiceOn) void speak(tr(s.text, lang), lang, voiceName);
    // Finishing a lesson (the first time) counts as study for the streak.
    if (i === lesson.slides.length - 1 && markDone(lesson.id) && !lesson.id.startsWith('review-')) study.log('lesson', POINTS.lessonFinished, lesson.title);
    if (s.moves?.length) {
      playing = true;
      await wait(700);
      for (const uci of s.moves) {
        if (t !== token) return;
        const m = uciToMove(uci);
        if (!m || !pos.isLegal(m)) break;
        playMoveSound(pos, m);
        const next = pos.clone();
        next.play(m);
        pos = next;
        lastMove = [keyOf(m.from), keyOf(m.to)];
        await wait(s.moves.length > 8 ? 650 : 900);
      }
      if (t !== token) return;
      playing = false;
    }
    shapes = [...marks(s), ...(s.arrows ?? []).map((a) => ({ orig: a.from as Key, dest: a.to as Key, brush: a.brush ?? 'green' }))];
  }

  function go(d: number) {
    const i = index + d;
    if (i >= 0 && i < total) show(i);
  }

  function setLang(l: Lang) {
    lang = l;
    voiceName = loadCoach().voices[l];
    updateCoach({ lang: l });
    if (slide && voiceOn) void speak(tr(slide.text, l), l, voiceName);
  }

  function toggleVoice() {
    voiceOn = !voiceOn;
    updateCoach({ voice: voiceOn });
    if (!voiceOn) stopSpeaking();
    else if (slide) void speak(tr(slide.text, lang), lang, voiceName);
  }

  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  }

  /** The practice position: given by the slide, or where its moves end. */
  const practiceHref = $derived.by(() => {
    if (!slide || slide.practice === false || playing) return undefined;
    const p = slide.practice ?? {};
    let at = p.fen;
    if (!at) {
      const q = positionFromFen(slide.fen);
      for (const u of slide.moves ?? []) {
        const m = uciToMove(u);
        if (m && q.isLegal(m)) q.play(m);
      }
      if (q.isEnd()) return undefined;
      at = fenOf(q);
    }
    const side = p.side ?? positionFromFen(at).turn;
    return `/coach/practice?fen=${encodeURIComponent(at)}&side=${side}&from=${encodeURIComponent(id)}`;
  });

  const gameHref = $derived(slide?.game ? `/analysis?db=${slide.game.id}&key=${polyglotKey(positionFromFen(slide.fen)).toString(16)}` : undefined);
</script>

<svelte:window onkeydown={onkey} />

<div class="lesson">
    <section class="board-col" aria-label="Board">
      <div class="board-box">
        <Board {fen} orientation={slide?.orientation ?? 'white'} turnColor={pos.turn} {lastMove} check={pos.isCheck()} {shapes} viewOnly label="Lesson board" onswipe={(d) => go(d === 'forward' ? 1 : -1)} />
      </div>
      <div class="nav">
        <button class="icon-btn" onclick={() => go(-1)} disabled={index === 0} aria-label="Previous slide"><Icon name="back" /></button>
        <button class="icon-btn" onclick={() => show(index)} disabled={!slide?.moves?.length} aria-label="Play the moves again" title="Play the moves again"><Icon name="replay" /></button>
        <span class="count num">{Math.min(index + 1, total)} / {total}</span>
        <button class="btn primary next" onclick={() => go(1)} disabled={index >= total - 1}>Next<Icon name="chevron" size={18} color="currentColor" /></button>
      </div>
    </section>

    <section class="talk card" aria-label="Chess Guru">
      <header>
        <a class="back" href={back} aria-label={backLabel}><Icon name="back" size={18} /></a>
        <div class="titles">
          <h1 class="title">{lesson.title}</h1>
          <span class="label">{lesson.section} · {lesson.level.charAt(0).toUpperCase() + lesson.level.slice(1)}</span>
        </div>
        <select value={lang} onchange={(e) => setLang((e.currentTarget as HTMLSelectElement).value as Lang)} aria-label="Guru speaks">
          {#each LANGS as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
        </select>
        <button class="icon-btn" onclick={toggleVoice} aria-pressed={voiceOn} title={voiceOn ? 'Voice on' : 'Voice off'}>
          <Icon name={voiceOn ? 'speaker' : 'mute'} size={18} />
        </button>
      </header>
      <div class="progress" aria-hidden="true">
        {#each lesson.slides as _, i (i)}<button class:done={i < index} class:now={i === index} onclick={() => show(i)} tabindex="-1" aria-label="Slide {i + 1}"></button>{/each}
      </div>

      <div class="guru">
        <GuruAvatar size={84} talking={$speaking} />
        <div class="bubble" {lang}>
          {#if slide}
            <p>{tr(slide.text, lang)}</p>
            {#if voiceOn}
              <button class="replay" onclick={() => speak(tr(slide.text, lang), lang, voiceName)}><Icon name="speaker" size={15} />Listen again</button>
            {/if}
          {:else}
            <p class="label">Loading the lesson…</p>
          {/if}
        </div>
      </div>

      {#if slide?.game}
        <a class="game-ref" href={gameHref}>
          <Icon name="book" size={16} />
          <span>{slide.game.white} – {slide.game.black}, {slide.game.event}{slide.game.year && !slide.game.event.includes(String(slide.game.year)) ? ` ${slide.game.year}` : ''}</span>
          {#if slide.game.legend && LEGENDS[slide.game.legend]}<span class="pill gold">{LEGENDS[slide.game.legend].name}</span>{/if}
        </a>
      {/if}

      <div class="actions">
        {#if practiceHref}
          <a class="btn practice" href={practiceHref}><Icon name="robot" size={18} />Practice this position with the engine</a>
        {/if}
        {#if index >= total - 1}
          <a class="btn primary" href={back}><Icon name="check" size={18} color="currentColor" />Lesson complete: choose the next one</a>
        {/if}
      </div>
      <p class="keys label">Keys: ← → move between slides.</p>
    </section>
  </div>

<style>
  .lesson {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 440px;
    gap: 20px;
    padding: 20px 24px;
    max-width: 1340px;
    margin: 0 auto;
    align-items: start;
  }
  .board-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }
  .board-box,
  .nav {
    width: min(100%, calc(100vh - 110px), 760px);
  }
  .board-box {
    aspect-ratio: 1;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .count {
    flex: 1;
    text-align: center;
    color: var(--muted);
    font-size: 15px;
  }
  .next {
    gap: 6px;
    min-width: 120px;
  }
  .talk {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    position: sticky;
    top: 16px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .back {
    color: var(--muted);
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
  }
  .titles {
    flex: 1;
    min-width: 0;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    line-height: 1.2;
  }
  .titles .label {
    font-size: 12.5px;
  }
  select {
    height: 34px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-size: 14px;
  }
  .progress {
    display: flex;
    gap: 3px;
  }
  .progress button {
    flex: 1;
    min-width: 4px;
    height: 6px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: var(--border);
    cursor: pointer;
  }
  .progress .done {
    background: var(--win);
  }
  .progress .now {
    background: var(--brand);
  }
  .guru {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .bubble {
    flex: 1;
    background: var(--raised);
    border-radius: 16px;
    border-top-left-radius: 4px;
    padding: 14px 16px;
    min-height: 120px;
  }
  .bubble p {
    margin: 0;
    font-size: 17px;
    line-height: 1.6;
  }
  .replay {
    margin-top: 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13.5px;
    cursor: pointer;
    padding: 0;
  }
  .game-ref {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 12px;
    background: var(--gold-soft);
    color: var(--text);
    font-size: 14px;
    text-decoration: none;
  }
  .game-ref span:first-of-type {
    flex: 1;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .actions .btn {
    gap: 8px;
    min-height: 46px;
  }
  .practice {
    border: 2px solid var(--brand);
  }
  .keys {
    margin: 0;
    font-size: 12px;
  }
  @media (max-width: 1100px) {
    .lesson {
      grid-template-columns: minmax(0, 1fr) 380px;
    }
  }
  @media (max-width: 860px) {
    .lesson {
      grid-template-columns: 1fr;
      padding: 12px 16px 24px;
    }
    .board-box,
    .nav {
      width: min(100%, 560px);
    }
    .talk {
      position: static;
    }
    .keys {
      display: none;
    }
  }
</style>
