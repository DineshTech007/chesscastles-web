<script lang="ts" module>
  let n = 0;
</script>

<script lang="ts">
  /** A gold coin with the castle on it (the Treasury's gold). */
  let { size = 18, title = '' }: { size?: number; title?: string } = $props();
  const id = `cg${++n}`;
</script>

<svg class="coin" width={size} height={size} viewBox="0 0 24 24" role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title || undefined}>
  <defs>
    <radialGradient id="{id}a" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff4c2" />
      <stop offset=".45" stop-color="#f5c451" />
      <stop offset="1" stop-color="#b87a12" />
    </radialGradient>
    <linearGradient id="{id}b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe9a3" />
      <stop offset="1" stop-color="#c98a1b" />
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="11" fill="#9a6410" />
  <circle cx="12" cy="11.4" r="10.4" fill="url(#{id}a)" />
  <circle cx="12" cy="11.4" r="7.6" fill="none" stroke="#c98a1b" stroke-width="1" opacity=".8" />
  <path d="M8.2 15.6V10.2h1.5v1.3h1.1v-1.3h2.4v1.3h1.1v-1.3h1.5v5.4z" fill="url(#{id}b)" stroke="#8a5a0e" stroke-width=".7" stroke-linejoin="round" />
  <path d="M5 7.5a8 8 0 0 1 5-3.6" stroke="#fffbe6" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75" />
</svg>

<style>
  .coin {
    display: inline-block;
    flex: none;
    vertical-align: -0.18em;
    filter: drop-shadow(0 1px 1px rgba(60, 35, 0, 0.35));
  }
</style>
