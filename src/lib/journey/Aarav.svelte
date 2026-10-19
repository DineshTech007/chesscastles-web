<script lang="ts">
  /** Aarav's portrait: a drawn picture of a boy at a chessboard, in the brand's navy and gold (he is a story character). */
  let { size = 160 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Aarav, drawn: a boy at a chessboard">
  <defs>
    <linearGradient id="aarav-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14213d" /><stop offset="1" stop-color="#0b1426" /></linearGradient>
    <linearGradient id="aarav-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe28a" /><stop offset="1" stop-color="#c98a1e" /></linearGradient>
  </defs>
  <circle cx="80" cy="80" r="78" fill="url(#aarav-bg)" stroke="#edb040" stroke-width="3" />
  <!-- the board -->
  <g transform="translate(26 112)">
    {#each Array(8) as _, i (i)}
      {#each Array(2) as __, j (j)}
        <rect x={i * 13.5} y={j * 9} width="13.5" height="9" fill={(i + j) % 2 ? '#b58863' : '#f0d9b5'} />
      {/each}
    {/each}
  </g>
  <!-- a knight and a king on the board -->
  <text x="43" y="128" font-size="15" fill="#1b1b1b" font-family="serif">♞</text>
  <text x="96" y="129" font-size="15" fill="#fff" font-family="serif">♔</text>
  <!-- shoulders and shirt -->
  <path d="M38 118c6-20 22-30 42-30s36 10 42 30" fill="#2a4a8a" />
  <path d="M60 92l20 16 20-16" fill="none" stroke="#edb040" stroke-width="3" stroke-linecap="round" />
  <!-- neck and head -->
  <rect x="71" y="74" width="18" height="16" rx="6" fill="#c98a5a" />
  <ellipse cx="80" cy="56" rx="24" ry="27" fill="#d9a06a" />
  <!-- hair -->
  <path d="M55 50c2-18 14-28 25-28s23 10 25 28c-6-8-14-11-25-11s-19 3-25 11z" fill="#1a1a1a" />
  <!-- eyes, brows, smile -->
  <circle cx="71" cy="57" r="2.6" fill="#1a1a1a" />
  <circle cx="89" cy="57" r="2.6" fill="#1a1a1a" />
  <path d="M66 51q5-3 10 0M84 51q5-3 10 0" fill="none" stroke="#1a1a1a" stroke-width="1.6" stroke-linecap="round" />
  <path d="M71 68q9 7 18 0" fill="none" stroke="#7a3b22" stroke-width="2" stroke-linecap="round" />
  <!-- the gold rook pin -->
  <path d="M118 36v-6h3v3h3v-3h3v3h3v-3h3v6h-2v10h2v3h-15v-3h2v-10z" fill="url(#aarav-gold)" />
</svg>
