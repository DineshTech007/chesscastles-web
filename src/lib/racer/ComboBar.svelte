<script lang="ts">
  /**
   * The combo (Puzzle Racer): right answers in a row, a bar filling towards the next bonus (combo 5: +1 point,
   * 12: +2, 20: +3, 30: +4, then +4 every 10), and the four bonus steps lighting up as they are reached.
   */
  let { combo }: { combo: number } = $props();

  const STEPS = [5, 12, 20, 30];
  const next = $derived(combo < 30 ? STEPS.find((s) => s > combo)! : Math.floor(combo / 10) * 10 + 10);
  const prev = $derived(combo < 5 ? 0 : combo < 30 ? STEPS[STEPS.indexOf(next) - 1] : next - 10);
  const fill = $derived(Math.min(1, (combo - prev) / (next - prev)));
  const reached = $derived(STEPS.filter((s) => combo >= s).length);
</script>

<div class="combo" aria-label="Combo {combo}">
  <span class="n num" class:hot={combo >= 5}>{combo}<small>combo</small></span>
  <div class="right">
    <div class="bar"><span style="width: {fill * 100}%"></span></div>
    <div class="steps">
      {#each ['+1', '+2', '+3', '+4'] as s, i (s)}<span class:on={i < reached}>{s}</span>{/each}
    </div>
  </div>
</div>

<style>
  .combo {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .n {
    display: flex;
    flex-direction: column;
    align-items: center;
    font: 800 30px/1 'Barlow Condensed', var(--font-title);
    color: #8ea0c4;
    min-width: 46px;
  }
  .n.hot {
    color: #38d2ff;
    text-shadow: 0 0 12px rgba(56, 210, 255, 0.6);
  }
  .n small {
    font: 700 9px var(--font-body);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .bar {
    height: 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #22d3ee, #38bdf8, #a78bfa);
    transition: width 0.3s ease-out;
  }
  .steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .steps span {
    text-align: center;
    font: 800 11px var(--font-body);
    padding: 2px 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--muted);
    transform: skewX(-12deg);
  }
  .steps span.on {
    background: linear-gradient(90deg, #22d3ee, #a78bfa);
    color: #0b1426;
  }
</style>
