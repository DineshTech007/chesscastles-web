<script lang="ts">
  /** The coach starts games: a simul, the game zone (students in pairs), or a game against one student. */
  import type { Live } from './live.svelte';

  let { live, fen, onclose }: { live: Live; fen: string; onclose: () => void } = $props();
  let mode = $state<'simul' | 'pair' | 'coach'>('simul');
  let color = $state<'white' | 'black' | 'random'>('white');
  let from = $state<'start' | 'board'>('start');
  let clock = $state('0+0');
  let who = $state('');
  const students = $derived(live.people.filter((p) => !p.coach && p.online));
  const CLOCKS: [string, string][] = [
    ['0+0', 'No clock'],
    ['3+2', '3+2'],
    ['5+0', '5+0'],
    ['10+0', '10+0'],
    ['15+10', '15+10'],
  ];
  function start() {
    const [minutes, inc] = clock.split('+').map(Number);
    live.startGames({ mode, color, root: from === 'board' ? fen : undefined, uid: mode === 'coach' ? who : undefined, minutes, inc });
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />
<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Start games">
  <h2>🎮 Game zone</h2>
  <div class="chips" role="group" aria-label="Kind">
    <button class="chip" class:on={mode === 'simul'} onclick={() => (mode = 'simul')}>Simul: me vs everyone</button>
    <button class="chip" class:on={mode === 'pair'} onclick={() => (mode = 'pair')}>Students in pairs</button>
    <button class="chip" class:on={mode === 'coach'} onclick={() => (mode = 'coach')}>Me vs one student</button>
  </div>
  <p class="muted small">
    {mode === 'simul'
      ? `You play all ${students.length} students here at once; "Next board" takes you to the next game waiting for you.`
      : mode === 'pair'
        ? 'Students here are paired at random; an odd one out plays you. You watch every game.'
        : 'One game; put it on the class board so everyone can watch.'}
  </p>
  {#if mode === 'coach'}
    <label class="field">
      <span>Student</span>
      <select bind:value={who}>
        <option value="">Pick a student…</option>
        {#each students as s (s.uid)}<option value={s.uid}>{s.name}</option>{/each}
      </select>
    </label>
  {/if}
  {#if mode !== 'pair'}
    <div class="field" role="group" aria-label="Your colour">
      <span>Your colour</span>
      <div class="chips">
        <button class="chip" class:on={color === 'white'} onclick={() => (color = 'white')}>White</button>
        <button class="chip" class:on={color === 'black'} onclick={() => (color = 'black')}>Black</button>
        <button class="chip" class:on={color === 'random'} onclick={() => (color = 'random')}>Mixed</button>
      </div>
    </div>
  {/if}
  <div class="field" role="group" aria-label="Start from">
    <span>Start from</span>
    <div class="chips">
      <button class="chip" class:on={from === 'start'} onclick={() => (from = 'start')}>The start</button>
      <button class="chip" class:on={from === 'board'} onclick={() => (from = 'board')}>The class board's position</button>
    </div>
  </div>
  <div class="field" role="group" aria-label="Clock">
    <span>Clock</span>
    <div class="chips">
      {#each CLOCKS as [v, l] (v)}<button class="chip" class:on={clock === v} onclick={() => (clock = v)}>{l}</button>{/each}
    </div>
  </div>
  <div class="row">
    <button class="btn ghost" onclick={onclose}>Cancel</button>
    <button class="btn primary" onclick={start} disabled={!students.length || (mode === 'coach' && !who) || (mode === 'pair' && students.length < 2)}>Start</button>
  </div>
  {#if !students.length}<p class="muted small">No student is in the class yet.</p>{/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(5, 10, 20, 0.55);
  }
  .dialog {
    position: fixed;
    z-index: 81;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 24px));
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
  h2 {
    margin: 0;
    font: 700 22px var(--font-title);
  }
  .chips,
  .row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .row {
    justify-content: flex-end;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: var(--muted);
  }
  select {
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 8px;
    font: 600 14px var(--font-body);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
    margin: 0;
  }
</style>
