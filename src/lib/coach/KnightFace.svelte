<script lang="ts">
  /**
   * Chess Guru: a friendly knight-coach with round glasses, a white
   * moustache and a gold scarf. He blinks, and his mouth moves while he talks.
   */
  let { size = 64, talking = false, ring = true }: { size?: number; talking?: boolean; ring?: boolean } = $props();
  const uid = $props.id();
</script>

<svg class="guru" class:talking width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Chess Guru">
  <defs>
    <linearGradient id="gBg-{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2a3f6e" />
      <stop offset="1" stop-color="#173a9c" />
    </linearGradient>
    <linearGradient id="gHead-{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbf4e6" />
      <stop offset="1" stop-color="#e6d6bb" />
    </linearGradient>
    <linearGradient id="gMane-{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3bf4f" />
      <stop offset="1" stop-color="#d8952a" />
    </linearGradient>
    <clipPath id="gClip-{uid}"><circle cx="80" cy="80" r="76" /></clipPath>
  </defs>

  <circle cx="80" cy="80" r="78" fill="url(#gBg-{uid})" />
  {#if ring}<circle cx="80" cy="80" r="76" fill="none" stroke="#edb040" stroke-width="4" />{/if}

  <g clip-path="url(#gClip-{uid})">
    <!-- Mane along the back of the neck -->
    <path d="M52 52 C40 58 36 72 38 86 C34 96 36 110 42 122 L60 124 C54 104 54 80 62 58 Z" fill="url(#gMane-{uid})" stroke="#9a6a1c" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M44 70 q-6 6 -2 14 M42 92 q-6 6 -1 14 M46 110 q-5 5 -1 12" fill="none" stroke="#9a6a1c" stroke-width="2" stroke-linecap="round" />

    <!-- Head: a knight facing right -->
    <path
      d="M58 126 C52 104 50 82 58 62 C62 50 66 44 70 40 L68 22 L82 34 C94 32 108 38 116 50 C124 60 130 70 134 80 C137 87 134 94 127 96 L112 98 C106 99 101 102 98 108 C96 114 99 120 104 126 Z"
      fill="url(#gHead-{uid})"
      stroke="#1b2a4a"
      stroke-width="3.5"
      stroke-linejoin="round"
    />
    <!-- Ear -->
    <path d="M70 40 L68 22 L82 34" fill="#e6d6bb" stroke="#1b2a4a" stroke-width="3" stroke-linejoin="round" />
    <path d="M72 30 L74 37" stroke="#c9b48f" stroke-width="2.5" stroke-linecap="round" />
    <!-- Nostril -->
    <ellipse cx="126" cy="82" rx="2.6" ry="2" fill="#1b2a4a" />

    <!-- Eyebrow -->
    <path class="brow" d="M88 46 q10 -7 22 -1" fill="none" stroke="#f4f4f4" stroke-width="5" stroke-linecap="round" />
    <path d="M88 46 q10 -7 22 -1" fill="none" stroke="#9aa3b5" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
    <!-- Eye -->
    <g class="eye">
      <ellipse cx="99" cy="59" rx="6" ry="7" fill="#fff" />
      <circle cx="100.5" cy="60" r="3.6" fill="#1b2a4a" />
      <circle cx="101.8" cy="58.6" r="1.2" fill="#fff" />
    </g>
    <!-- Round glasses -->
    <circle cx="99" cy="59" r="11" fill="rgba(255,255,255,0.12)" stroke="#edb040" stroke-width="3" />
    <path d="M88 57 L70 52" stroke="#edb040" stroke-width="2.5" stroke-linecap="round" />
    <path d="M110 58 L118 61" stroke="#edb040" stroke-width="2.5" stroke-linecap="round" />

    <!-- Cheek -->
    <ellipse cx="108" cy="78" rx="7" ry="4.5" fill="#f19a8e" opacity="0.55" />
    <!-- Smile, and an open mouth while talking -->
    <path class="smile" d="M108 99 q8 7 17 0" fill="none" stroke="#7a2e2e" stroke-width="2.6" stroke-linecap="round" />
    <ellipse class="mouth" cx="116.5" cy="101" rx="6" ry="3.4" fill="#7a2e2e" />
    <!-- Moustache curling up at the ends -->
    <path d="M101 88 C96 84 96 79 100 79 C100 84 104 87 110 87 C115 87 118 89 120 89 C123 89 127 87 131 87 C136 87 138 82 136 78 C141 81 141 89 134 92 C128 95 122 93 120 93 C116 93 110 95 104 93 C102 92 101 90 101 88 Z" fill="#fafafa" stroke="#1b2a4a" stroke-width="2.2" stroke-linejoin="round" />

    <!-- Gold scarf -->
    <path d="M50 118 C66 112 90 112 108 118 L112 140 C90 134 68 134 46 140 Z" fill="#edb040" stroke="#9a6a1c" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M56 124 C72 120 88 120 104 124" fill="none" stroke="#fff3cf" stroke-width="2" stroke-linecap="round" opacity="0.8" />
    <path d="M96 126 l8 26 l9 -3 l-7 -24 z" fill="#d8952a" stroke="#9a6a1c" stroke-width="2" stroke-linejoin="round" />
    <!-- Gold star badge -->
    <path d="M70 120 l2.6 5.3 5.9 0.9 -4.3 4.1 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.3 -4.1 5.9 -0.9 z" fill="#fff3cf" stroke="#9a6a1c" stroke-width="1.5" stroke-linejoin="round" />
  </g>
</svg>

<style>
  .guru {
    display: block;
    flex: none;
  }
  .eye {
    transform-origin: 99px 59px;
    animation: blink 4.5s infinite;
  }
  @keyframes blink {
    0%,
    94%,
    100% {
      transform: scaleY(1);
    }
    96% {
      transform: scaleY(0.1);
    }
  }
  .mouth {
    transform-origin: 116.5px 101px;
    opacity: 0;
  }
  .talking .smile {
    opacity: 0;
  }
  .talking .mouth {
    opacity: 1;
    animation: talk 0.28s infinite alternate ease-in-out;
  }
  @keyframes talk {
    from {
      transform: scaleY(0.35);
    }
    to {
      transform: scaleY(1.15);
    }
  }
  .talking .brow {
    animation: brow 1.4s infinite ease-in-out;
  }
  @keyframes brow {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-1.5px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .eye,
    .talking .mouth,
    .talking .brow {
      animation: none;
    }
  }
</style>
