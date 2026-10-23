<script lang="ts" module>
  let n = 0;
</script>

<script lang="ts">
  /** A cut gem (the Treasury's gems): rare, for milestones. */
  let { size = 18, title = '' }: { size?: number; title?: string } = $props();
  const id = `gm${++n}`;
</script>

<svg class="gem" width={size} height={size} viewBox="0 0 24 24" role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title || undefined}>
  <defs>
    <linearGradient id="{id}a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b9f6ff" />
      <stop offset=".5" stop-color="#3cc8e6" />
      <stop offset="1" stop-color="#7c5cf0" />
    </linearGradient>
  </defs>
  <path d="M6.5 3h11l4.5 6-10 12L2 9z" fill="url(#{id}a)" stroke="#2a3f8f" stroke-width=".9" stroke-linejoin="round" />
  <path d="M2 9h20M6.5 3 9 9l3 12M17.5 3 15 9l-3 12M9 9l3-6 3 6" fill="none" stroke="#e8fdff" stroke-width=".8" stroke-linejoin="round" opacity=".7" />
  <path d="M9 9h6l-3 12z" fill="#ffffff" opacity=".18" />
</svg>

<style>
  .gem {
    display: inline-block;
    flex: none;
    vertical-align: -0.18em;
    filter: drop-shadow(0 1px 1px rgba(10, 30, 80, 0.35));
  }
</style>
