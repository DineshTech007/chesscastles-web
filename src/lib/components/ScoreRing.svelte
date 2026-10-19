<script lang="ts">
  /** A ring showing a percentage in the middle: for the report card (accuracy, score). */
  let { value, label, sub = '', color = 'var(--gold)', size = 112 }: { value: number; label: string; sub?: string; color?: string; size?: number } = $props();
  const R = 44;
  const C = 2 * Math.PI * R;
  const v = $derived(Math.max(0, Math.min(100, value)));
</script>

<div class="ring" style="--c: {color}">
  <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="{label}: {Math.round(v)} percent">
    <circle cx="50" cy="50" r={R} class="track" />
    <circle cx="50" cy="50" r={R} class="arc" stroke-dasharray="{(C * v) / 100} {C}" transform="rotate(-90 50 50)" />
    <text x="50" y="55" text-anchor="middle" class="num">{Math.round(v)}%</text>
  </svg>
  <strong>{label}</strong>
  {#if sub}<span class="label">{sub}</span>{/if}
</div>

<style>
  .ring {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .track {
    fill: none;
    stroke: var(--raised);
    stroke-width: 9;
  }
  .arc {
    fill: none;
    stroke: var(--c);
    stroke-width: 9;
    stroke-linecap: round;
    transition: stroke-dasharray 0.8s ease;
  }
  text {
    fill: var(--text);
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 24px;
  }
  strong {
    margin-top: 2px;
    font-size: 15px;
  }
  .label {
    font-size: 12.5px;
  }
</style>
