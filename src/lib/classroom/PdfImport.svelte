<script lang="ts">
  /**
   * A puzzle PDF to class questions (owner, 2026-10-22: promised to an academy's coach). The PDF is read on this
   * computer and never uploaded: its diagrams are found and read, the coach checks the pieces once (one name per
   * group of look-alike pieces) and fixes any diagram. The answers come from the PDF itself where it prints them
   * (under a diagram, or a solutions part by number), from the engine, or from the coach.
   */
  import Board from '$lib/components/Board.svelte';
  import BoardEditor from '$lib/components/BoardEditor.svelte';
  import type { Item } from './api';
  import { sanLine } from './tasks';
  import { LABEL_NAME, LABELS, type Label } from './pdf/fen';
  import AnswerEdit from './pdf/AnswerEdit.svelte';
  import { answerNow, answerOf, confidenceOf, itemsOf, pdfAnswer, positionOf, rename, scanPdf, type AnswerMode, type Diagram, type Progress, type Scan } from './pdf/scan';

  let { onitems, onclose }: { onitems: (items: Item[]) => void; onclose: () => void } = $props();

  let step = $state<'pick' | 'reading' | 'review' | 'answers'>('pick');
  let progress = $state<Progress | undefined>();
  let error = $state('');
  let fileName = $state('');
  // The scan is big (pictures, numbers): kept raw, and `v` moves on when it changes.
  let scan = $state.raw<Scan | undefined>();
  let v = $state(0);
  let showPieces = $state(false);
  // Raw: the diagram itself (a proxy would be another object, and the fix would not reach the scan).
  let editing = $state.raw<Diagram | undefined>();
  let answering = $state.raw<{ d: Diagram; fen: string; line: string[] } | undefined>();
  let dragging = $state(false);
  let mode = $state<AnswerMode>('both');

  async function read(file: File | undefined) {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return void (error = 'Choose a PDF file.');
    error = '';
    fileName = file.name;
    step = 'reading';
    try {
      const s = await scanPdf(file, (p) => (progress = p));
      scan = s;
      v++;
      if (!s.diagrams.length) {
        error = 'No chess diagrams were found in this PDF. Diagrams printed as pictures or in a chess font both work; a photo of a page may not.';
        step = 'pick';
        return;
      }
      // The answers the PDF prints when it prints them all; with the engine for the rest otherwise.
      const found = s.diagrams.filter((d) => pdfAnswer(d, positionOf(d, s.groups).fen)).length;
      mode = found === s.diagrams.length ? 'pdf' : found ? 'both' : 'engine';
      step = 'review';
    } catch (e) {
      error = (e as Error)?.message?.includes('password') ? 'This PDF is locked with a password.' : 'This PDF could not be read.';
      step = 'pick';
    }
  }

  const live = $derived.by(() => {
    void v;
    const s = scan;
    if (!s) return [];
    return s.diagrams
      .map((d, n) => {
        const pos = positionOf(d, s.groups);
        const now = answerNow(d, pos.fen, mode);
        return { d, n, ...pos, fen: now.fen, answer: now.answer, need: now.need, inPdf: !!pdfAnswer(d, pos.fen), conf: confidenceOf(d, s.groups) };
      })
      .filter((x) => !x.d.removed);
  });
  const ready = $derived(live.filter((x) => !x.problem));
  const inPdf = $derived(ready.filter((x) => x.inPdf).length);
  const needEngine = $derived(ready.filter((x) => x.need).length);
  const answered = $derived(ready.filter((x) => x.answer?.line.length));
  const groups = $derived.by(() => {
    void v;
    return scan ? [...scan.groups].sort((a, b) => LABELS.indexOf(a.label) - LABELS.indexOf(b.label) || b.count - a.count) : [];
  });
  /** The groups by the piece they are read as: one row per piece, a small picture per look. */
  const rows = $derived(LABELS.map((l) => ({ l, gs: groups.filter((g) => g.label === l) })).filter((r) => r.gs.length));
  const weak = $derived(groups.filter((g) => !g.fixed && g.score < 0.75).length);

  function setSide(d: Diagram, side: 'white' | 'black') {
    d.side = side;
    d.sideFrom = 'coach';
    v++;
  }
  function allSides(side: 'white' | 'black' | 'printed') {
    for (const d of scan?.diagrams ?? []) {
      if (side === 'printed') {
        if (d.sideFrom === 'coach') d.sideFrom = 'guess';
      } else setSide(d, side);
    }
    v++;
  }
  function relabel(id: number, label: Label) {
    if (!scan) return;
    rename(scan, id, label);
    v++;
  }

  /** One square of a diagram's picture, for a group's sample. */
  const spriteStyle = (s: { d: number; i: number }) => {
    const d = scan?.diagrams[s.d];
    if (!d) return '';
    const col = s.i % 8, row = Math.floor(s.i / 8);
    return `background-image: url(${d.crop}); background-size: 800% 800%; background-position: ${(col / 7) * 100}% ${(row / 7) * 100}%`;
  };
  const FROM = { pdf: '📄 PDF', engine: '⚙ Engine', coach: '✍ Yours' } as const;

  // ----- the engine, only for the diagrams that still need it under the choice made
  let solving = $state(0);
  let toSolve = $state(0);
  let cancelled = false;
  async function next() {
    step = 'answers';
    cancelled = false;
    const todo = ready.filter((x) => x.need);
    toSolve = todo.length;
    for (const [k, x] of todo.entries()) {
      if (cancelled) return;
      solving = k + 1;
      try {
        const a = await answerOf(x.fen);
        x.d.engine = { fen: x.fen, line: a.line, note: a.note };
      } catch {
        x.d.engine = { fen: x.fen, line: [], note: 'The engine could not look at this one.' };
      }
      v++;
    }
    solving = 0;
  }
  const titleOf = (x: (typeof live)[number], k: number) => (x.d.caption && x.d.caption.length <= 60 ? x.d.caption : `${fileName.replace(/\.pdf$/i, '')} · puzzle ${x.d.number ?? k + 1}`);
  function use() {
    onitems(itemsOf(answered.map((x, k) => ({ fen: x.answer!.fen, line: x.answer!.line, title: titleOf(x, k) }))));
  }
  function close() {
    cancelled = true;
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !editing && !answering && close()} />
<div class="scrim" role="presentation" onclick={close}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Puzzles from a PDF">
  <header>
    <h2>Puzzles from a PDF</h2>
    <button class="btn ghost" onclick={close} aria-label="Close">✕</button>
  </header>

  {#if step === 'pick'}
    <label class="drop" class:over={dragging} ondragover={(e) => (e.preventDefault(), (dragging = true))} ondragleave={() => (dragging = false)} ondrop={(e) => (e.preventDefault(), (dragging = false), read(e.dataTransfer?.files?.[0]))}>
      <input type="file" accept="application/pdf,.pdf" onchange={(e) => read(e.currentTarget.files?.[0])} />
      <b>Choose a puzzle PDF</b>
      <span class="muted">or drop it here. Diagrams are found and read on this computer: the PDF is not uploaded.</span>
      <span class="muted small">Works best with printed diagrams (ChessBase, books, worksheets) and board screenshots. Solutions printed in the PDF become the answers. Up to 40 pages of diagrams.</span>
    </label>
    {#if error}<p class="err">{error}</p>{/if}
  {:else if step === 'reading'}
    <div class="progress">
      <b>{progress?.stage === 'pieces' ? 'Recognising the pieces…' : `Reading page ${progress?.page ?? 1} of ${progress?.pages ?? '…'}`}</b>
      <div class="bar"><span style="width: {progress ? (progress.stage === 'pieces' ? 100 : ((progress.page - 1) / progress.pages) * 100) : 4}%"></span></div>
      <span class="muted">{progress?.found ?? 0} diagrams found so far in {fileName}</span>
    </div>
  {:else if step === 'review' && scan}
    <div class="bar-row">
      <span><b>{live.length}</b> diagrams on {scan.read} {scan.read === 1 ? 'page' : 'pages'}{scan.pages > scan.read ? ` (first ${scan.read} of ${scan.pages})` : ''} · <b>{ready.length}</b> ready</span>
      <div class="chips" role="group" aria-label="Side to move for all">
        <span class="muted small">To move:</span>
        <button class="chip" onclick={() => allSides('printed')}>As printed</button>
        <button class="chip" onclick={() => allSides('white')}>All White</button>
        <button class="chip" onclick={() => allSides('black')}>All Black</button>
      </div>
      <button class="chip" class:on={showPieces} onclick={() => (showPieces = !showPieces)}>Check the pieces{weak ? ` (${weak} to look at)` : ''}</button>
    </div>
    <div class="chips answers-choice" role="group" aria-label="Answers">
      <span class="muted small">Answers:</span>
      <button class="chip" class:on={mode === 'pdf'} onclick={() => (mode = 'pdf')} disabled={!inPdf}>From the PDF (found for {inPdf} of {ready.length})</button>
      <button class="chip" class:on={mode === 'engine'} onclick={() => (mode = 'engine')}>By the engine</button>
      <button class="chip" class:on={mode === 'both'} onclick={() => (mode = 'both')} disabled={!inPdf}>PDF where found, engine for the rest</button>
    </div>

    {#if showPieces}
      <div class="pieces">
        <p class="muted small">Every look of every piece in the PDF, by what it was read as. Tap a picture to correct it: every diagram with that piece changes, and pieces that look the same follow.{weak ? ` The ${weak} ringed in gold are the least sure.` : ''}</p>
        {#each rows as r (r.l)}
          <div class="prow">
            <span class="pname">{LABEL_NAME[r.l]}</span>
            <div class="tiles">
              {#each r.gs as g (g.id)}
                <label class="tile" class:weak={!g.fixed && g.score < 0.75} title="{LABEL_NAME[g.label]} ×{g.count}{g.runner ? ` (next best: ${g.runner})` : ''}">
                  <span class="sample" style={spriteStyle(g.sample)}></span>
                  {#if g.count > 1}<span class="n">{g.count}</span>{/if}
                  <select value={g.label} onchange={(e) => relabel(g.id, e.currentTarget.value as Label)} aria-label="This piece is">
                    {#each LABELS as l (l)}<option value={l}>{LABEL_NAME[l]}</option>{/each}
                  </select>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="grid">
      {#each live as x (x.d.id)}
        <div class="card" class:bad={!!x.problem} class:check={!x.problem && x.conf < 0.75}>
          <div class="pair">
            <img src={x.d.crop} alt="Diagram {x.n + 1} as printed" />
            <div class="mini"><Board fen={x.fen} orientation={x.flipped ? 'black' : 'white'} viewOnly coordinates={false} label="Diagram {x.n + 1} as read" /></div>
          </div>
          <div class="meta">
            <span class="num">#{x.d.number ?? x.n + 1} · page {x.d.page}</span>
            {#if x.problem}<span class="tag bad">⚠ {x.problem}</span>{:else if x.conf < 0.75}<span class="tag check">Check it</span>{:else}<span class="tag ok">✓ Read</span>{/if}
          </div>
          {#if x.d.caption}<span class="caption muted small">{x.d.caption}</span>{/if}
          {#if !x.problem}
            <div class="ans">
              {#if x.answer?.line.length}
                <span class="from {x.answer.from}">{FROM[x.answer.from]}</span>
                <span class="san">{sanLine(x.answer.fen, x.answer.line)}</span>
              {:else if x.need}
                <span class="muted small">⚙ The engine will find the answer</span>
              {:else}
                <span class="muted small">No answer in the PDF: left out (or give one)</span>
              {/if}
              <button class="btn ghost small-btn" onclick={() => (answering = { d: x.d, fen: x.fen, line: x.answer?.line ?? [] })}>{x.answer?.line.length ? 'Change' : 'Answer…'}</button>
            </div>
          {/if}
          <div class="row">
            <div class="seg" role="group" aria-label="To move">
              <button class:on={x.fen.split(' ')[1] === 'w'} onclick={() => setSide(x.d, 'white')}>White to play</button>
              <button class:on={x.fen.split(' ')[1] === 'b'} onclick={() => setSide(x.d, 'black')}>Black to play</button>
            </div>
            <button class="btn small-btn" onclick={() => (editing = x.d)}>Fix</button>
            <button class="btn ghost small-btn" onclick={() => ((x.d.removed = true), v++)} aria-label="Remove diagram {x.n + 1}">✕</button>
          </div>
        </div>
      {/each}
    </div>
    <div class="go">
      <button class="btn ghost" onclick={() => ((step = 'pick'), (scan = undefined))}>Another PDF</button>
      <button class="btn primary big" disabled={!ready.length || (!needEngine && !answered.length)} onclick={next}>{needEngine ? `Find ${needEngine} ${needEngine === 1 ? 'answer' : 'answers'} with the engine` : `Next: ${answered.length} puzzles`}</button>
    </div>
  {:else if step === 'answers'}
    <div class="progress">
      {#if solving}
        <b>The engine is solving puzzle {solving} of {toSolve}…</b>
        <div class="bar"><span style="width: {((solving - 1) / Math.max(1, toSolve)) * 100}%"></span></div>
      {:else}
        <b>{answered.length} puzzles ready{ready.length > answered.length ? ` · ${ready.length - answered.length} without an answer left out` : ''}</b>
      {/if}
    </div>
    <ol class="answers">
      {#each ready as x, k (x.d.id)}
        <li class:bad={!x.answer?.line.length && !x.need}>
          <span class="t">{titleOf(x, k)}</span>
          <span class="muted small">{x.fen.split(' ')[1] === 'w' ? 'White' : 'Black'} to play · page {x.d.page}</span>
          {#if x.answer?.line.length}
            <span><span class="from {x.answer.from}">{FROM[x.answer.from]}</span> {sanLine(x.answer.fen, x.answer.line)}{x.answer.note ? ` (${x.answer.note})` : ''}</span>
          {:else if x.need}
            <span class="muted">Waiting for the engine…</span>
          {:else}
            <span>No answer: left out</span>
          {/if}
        </li>
      {/each}
    </ol>
    <div class="go">
      <button class="btn ghost" onclick={() => ((cancelled = true), (solving = 0), (step = 'review'))}>Back</button>
      <button class="btn primary big" disabled={!!solving || !answered.length} onclick={use}>Use these {answered.length} puzzles</button>
    </div>
  {/if}
</div>

{#if editing}
  {@const d = editing}
  <div class="scrim top" role="presentation" onclick={() => (editing = undefined)}></div>
  <div class="dialog editor" role="dialog" aria-modal="true" aria-label="Fix the position">
    <h2>Fix diagram {d.number ?? (scan?.diagrams.indexOf(d) ?? 0) + 1}</h2>
    <p class="muted small">Put the pieces as printed and choose whose move it is, then press "Analyse this position" to keep it.</p>
    <div class="fix">
      <img src={d.crop} alt="As printed" />
      <BoardEditor
        fen={scan ? positionOf(d, scan.groups).fen : undefined}
        onapply={(fen) => {
          d.manual = fen;
          editing = undefined;
          v++;
        }}
        oncancel={() => (editing = undefined)}
      />
    </div>
  </div>
{/if}
{#if answering}
  {@const a = answering}
  <div class="scrim top" role="presentation" onclick={() => (answering = undefined)}></div>
  <div class="dialog editor" role="dialog" aria-modal="true" aria-label="The answer">
    <h2>The answer to diagram {a.d.number ?? (scan?.diagrams.indexOf(a.d) ?? 0) + 1}</h2>
    <div class="fix">
      <img src={a.d.crop} alt="As printed" />
      <AnswerEdit
        fen={a.fen}
        line={a.line}
        onsave={(line) => {
          a.d.coach = { fen: a.fen, line };
          answering = undefined;
          v++;
        }}
        oncancel={() => (answering = undefined)}
      />
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 84;
    background: rgba(5, 10, 20, 0.55);
  }
  .scrim.top {
    z-index: 86;
  }
  .dialog {
    position: fixed;
    z-index: 85;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(1100px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-panel);
    padding: 16px 18px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .dialog.editor {
    z-index: 87;
    width: min(1040px, calc(100vw - 24px));
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font: 700 22px var(--font-title);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
  }
  .err {
    color: var(--loss);
    margin: 0;
  }
  .drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 40px 20px;
    border: 2px dashed var(--border);
    border-radius: var(--r-card);
    text-align: center;
    cursor: pointer;
  }
  .drop.over,
  .drop:hover {
    border-color: var(--gold);
    background: var(--gold-soft);
  }
  .drop input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .drop b {
    font: 700 20px var(--font-title);
  }
  .progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
  }
  .bar {
    height: 10px;
    border-radius: 6px;
    background: var(--raised);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--gold);
    transition: width 0.3s;
  }
  .bar-row {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .chips {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .pieces {
    border: 1px solid var(--border);
    border-radius: var(--r-card);
    padding: 10px 12px;
  }
  .prow {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 4px 0;
    border-top: 1px solid var(--border-soft);
  }
  .pname {
    width: 110px;
    flex: none;
    font-weight: 700;
    font-size: 13px;
  }
  .tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tile {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
  }
  .tile.weak {
    border-color: var(--gold);
  }
  .tile:hover {
    border-color: var(--live);
  }
  .sample {
    position: absolute;
    inset: 0;
    border-radius: 4px;
    background-color: #fff;
  }
  .tile .n {
    position: absolute;
    right: -4px;
    bottom: -4px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 3px;
    font: 700 10px var(--font-body);
  }
  /* The native list opens on the picture: the select itself is invisible. */
  .tile select {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 12px;
    background: var(--raised);
    border: 1px solid var(--border);
  }
  .card.bad {
    border-color: var(--loss);
  }
  .card.check {
    border-color: var(--gold);
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .pair img {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 6px;
    background: #fff;
  }
  .mini :global(.board) {
    pointer-events: none;
    box-shadow: none;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  .tag {
    font-weight: 700;
    font-size: 12px;
  }
  .tag.ok {
    color: var(--win);
  }
  .tag.bad {
    color: var(--loss);
  }
  .tag.check {
    color: var(--gold);
  }
  .caption {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .seg {
    display: flex;
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    flex: 1;
    background: none;
    border: 0;
    color: var(--muted);
    padding: 5px 4px;
    font: 600 12px var(--font-body);
    cursor: pointer;
  }
  .seg button.on {
    background: var(--gold-soft);
    color: var(--gold);
  }
  .small-btn {
    padding: 5px 10px;
    font-size: 13px;
  }
  .go {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    position: sticky;
    bottom: -16px;
    z-index: 5;
    background: var(--card);
    padding: 8px 0 0;
  }
  .answers {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 55vh;
    overflow: auto;
  }
  .answers li {
    display: flex;
    flex-direction: column;
  }
  .answers-choice .chip:disabled {
    opacity: 0.45;
  }
  .ans {
    display: flex;
    gap: 6px;
    align-items: baseline;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .ans .san {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }
  .from {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--card);
    white-space: nowrap;
  }
  .from.pdf {
    color: var(--live);
  }
  .from.engine {
    color: var(--engine);
  }
  .from.coach {
    color: var(--gold);
  }
  .answers li.bad {
    color: var(--loss);
  }
  .answers .t {
    font-weight: 700;
  }
  .fix {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 14px;
    align-items: start;
  }
  .fix img {
    width: 100%;
    border-radius: 6px;
    background: #fff;
  }
  @media (max-width: 720px) {
    .fix {
      grid-template-columns: 1fr;
    }
    .fix img {
      max-width: 220px;
    }
  }
</style>
