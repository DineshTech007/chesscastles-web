<script lang="ts">
  /**
   * Vijayadashami, launch day: a marigold toran drops in across the top, a greeting (English and Marathi) and
   * falling petals, then all of it lifts away slowly. Festive music ("Sita Ram Tarang", instrumental) starts
   * by itself when the browser allows it, otherwise with the first tap (phones often allow no sound before one),
   * and plays until the visitor stops it with the small Music button. Shown once per visit, on the day only (the layout decides that).
   */
  import { onDestroy, onMount } from 'svelte';
  import { DasaraMusic } from './dasaraMusic';

  let { onclose }: { onclose: () => void } = $props();

  const music = new DasaraMusic();
  let phase = $state<'in' | 'out'>('in');
  let card = $state(true);
  let playing = $state(false);
  let muted = false;
  /** The music starts once (with the first tap); after it ends or is stopped, taps leave it alone. */
  let started = false;
  let held = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  // Enough marigold swags to cross the widest screen.
  let units = $state(12);
  const petals = Array.from({ length: 16 }, (_, i) => ({
    left: (i * 61) % 100,
    delay: (i * 0.37) % 4,
    dur: 5 + ((i * 13) % 5),
    hue: i % 3 === 0 ? '#ffb300' : i % 3 === 1 ? '#ff7a00' : '#e64a19',
    size: 8 + (i % 4) * 2,
  }));

  music.onend = () => (playing = false);

  function playMusic() {
    if (muted || playing) return;
    playing = music.start();
    started ||= playing;
  }
  function firstTap(e: Event) {
    // The music button does its own thing.
    if ((e.target as Element | null)?.closest?.('[data-music]')) return;
    if (started) return music.nudge();
    playMusic();
  }
  // Events that count as a tap for sound on phones and computers.
  const tapEvents = ['touchend', 'click', 'keydown'] as const;
  function removeTapListeners() {
    for (const e of tapEvents) window.removeEventListener(e, firstTap, true);
  }

  function toggleMusic() {
    if (playing) {
      muted = true;
      music.stop();
      playing = false;
    } else {
      muted = false;
      playMusic();
      music.nudge();
    }
  }

  function closeCard() {
    card = false;
    leave();
  }
  /** The toran and petals lift away slowly; the music keeps going until it ends or is stopped. */
  function leave() {
    if (phase === 'out') return;
    phase = 'out';
    later(3200, () => {
      if (!playing) onclose();
    });
  }
  $effect(() => {
    // Everything gone and the music over: done.
    if (phase === 'out' && !card && !playing) later(3300, onclose);
  });

  onMount(() => {
    units = Math.ceil(window.innerWidth / 110) + 1;
    music.preload();
    // Straight away if the browser allows sound before a tap; if not, the first tap starts it.
    void music.autoplay().then((ok) => {
      if (!ok) return;
      if (muted) return music.stop();
      playing = true;
      started = true;
    });
    for (const e of tapEvents) window.addEventListener(e, firstTap, { capture: true, passive: true });
    // The greeting leaves by itself after a while (not while a finger or the mouse rests on it).
    later(11000, () => {
      if (!held) {
        card = false;
        leave();
      }
    });
  });
  onDestroy(() => {
    removeTapListeners();
    timers.forEach(clearTimeout);
    music.stop();
  });

  // One swag of the toran: a red-and-gold band, a garland rope with marigolds, and mango leaves hanging below.
  const at = (t: number) => ({ x: 110 * t, y: 10 + 44 * t * (1 - t) });
  const flowers = Array.from({ length: 7 }, (_, k) => ({ ...at((k + 0.5) / 7), c: k % 2 ? '#ffb300' : '#ff7a00' }));
  const leaves = Array.from({ length: 6 }, (_, k) => at((k + 1) / 7));
</script>

<div class="dasara" class:out={phase === 'out'} aria-hidden={!card}>
  <div class="toran" aria-hidden="true">
    {#each Array(units) as _, u (u)}
      <svg class="swag" viewBox="0 0 110 80" width="110" height="80">
        <rect x="0" y="0" width="110" height="9" fill="#b3261e" />
        <rect x="0" y="7.5" width="110" height="2" fill="#f2c94c" />
        {#each [10, 32, 55, 78, 100] as dx (dx)}<circle cx={dx} cy="4" r="1.6" fill="#f2c94c" />{/each}
        {#each leaves as l, i (i)}
          <g transform="translate({l.x} {l.y + 2}) rotate({i % 2 ? 6 : -6})">
            <path d="M0 0 C-6 7 -5 18 0 25 C5 18 6 7 0 0 Z" fill={i % 2 ? '#2e7d32' : '#388e3c'} />
            <path d="M0 2 L0 23" stroke="#81c784" stroke-width="0.8" />
          </g>
        {/each}
        <path d="M0 10 Q55 54 110 10" fill="none" stroke="#c77700" stroke-width="2" />
        {#each flowers as f, i (i)}
          <g transform="translate({f.x} {f.y})">
            <circle r="6.2" fill={f.c} />
            <circle r="5.2" fill="none" stroke="#d35400" stroke-width="2.4" stroke-dasharray="1.6 1.3" opacity="0.7" />
            <circle r="2.2" fill="#8d3b00" />
          </g>
        {/each}
        <!-- the hanging strand in the middle -->
        <g transform="translate(55 32)">
          <path d="M0 0 L0 30" stroke="#c77700" stroke-width="1.4" />
          <circle cy="9" r="5" fill="#ffb300" /><circle cy="9" r="1.8" fill="#8d3b00" />
          <circle cy="19" r="5" fill="#ff7a00" /><circle cy="19" r="1.8" fill="#8d3b00" />
          <path d="M-3 27 L0 40 L3 27 Z" fill="#b3261e" />
        </g>
      </svg>
    {/each}
  </div>

  <div class="petals" aria-hidden="true">
    {#each petals as p, i (i)}
      <span style="left:{p.left}%; animation-delay:{p.delay}s; animation-duration:{p.dur}s; background:{p.hue}; width:{p.size}px; height:{p.size * 0.7}px"></span>
    {/each}
  </div>

  {#if card}
    <div
      class="card-fest"
      role="dialog"
      aria-label="Happy Dussehra"
      tabindex="-1"
      onpointerenter={() => (held = true)}
      onpointerleave={() => (held = false)}
    >
      <div class="diya" aria-hidden="true">🪔</div>
      <h2 class="en">Happy Dussehra!</h2>
      <p class="mr" lang="mr">दसऱ्याच्या हार्दिक शुभेच्छा!</p>
      <p class="msg">Chess Castles opens to everyone today, on Vijayadashami. Thank you for your support and blessings 🙏</p>
      <p class="msg mr-msg" lang="mr">आज विजयादशमीच्या शुभ दिवशी Chess Castles सर्वांसाठी खुलं होत आहे. तुमची साथ आणि आशीर्वाद असू द्या 🙏</p>
      <div class="btns">
        <button class="btn" data-music onclick={toggleMusic}>{playing ? '🔇 Stop music' : '🎵 Play music'}</button>
        <button class="btn primary" onclick={closeCard}>Let's play ♟️</button>
      </div>
    </div>
  {/if}
</div>

{#if playing && !card}
  <button class="music-chip" data-music onclick={toggleMusic} aria-label="Stop the festive music">🔇 Music</button>
{/if}

<style>
  .dasara {
    position: fixed;
    inset: 0;
    z-index: 120;
    pointer-events: none;
  }
  .toran {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    overflow: hidden;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
    transform-origin: top center;
    animation: toran-in 1.4s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
  }
  .swag {
    flex: none;
    animation: sway 3.2s ease-in-out infinite;
    transform-origin: top center;
  }
  .swag:nth-child(2n) {
    animation-delay: -1.6s;
  }
  @keyframes toran-in {
    from {
      transform: translateY(-100%);
    }
  }
  @keyframes sway {
    50% {
      transform: rotate(0.8deg);
    }
  }
  .out .toran {
    transition:
      transform 3s ease-in,
      opacity 3s ease-in;
    transform: translateY(-110%);
    opacity: 0;
  }
  .petals span {
    position: absolute;
    top: -20px;
    border-radius: 60% 40% 60% 40%;
    opacity: 0.9;
    animation: fall linear infinite;
  }
  @keyframes fall {
    to {
      transform: translate(40px, 105vh) rotate(540deg);
    }
  }
  .out .petals {
    transition: opacity 2.5s;
    opacity: 0;
  }
  .card-fest {
    pointer-events: auto;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    padding: 22px 20px 18px;
    border-radius: 22px;
    text-align: center;
    color: #fff8e7;
    background:
      radial-gradient(120% 90% at 50% 0%, rgba(255, 179, 0, 0.35), transparent 60%),
      linear-gradient(160deg, #7a1d12, #4a0f0a);
    border: 2px solid #f2c94c;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
    animation: card-in 0.9s 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  .out .card-fest {
    transition:
      opacity 2.2s ease,
      transform 2.2s ease;
    opacity: 0;
    transform: translate(-50%, -40%) scale(0.92);
  }
  @keyframes card-in {
    from {
      opacity: 0;
      transform: translate(-50%, -40%) scale(0.85);
    }
  }
  .diya {
    font-size: 40px;
    line-height: 1;
    animation: glow 2s ease-in-out infinite;
  }
  @keyframes glow {
    50% {
      filter: drop-shadow(0 0 12px #ffb300);
    }
  }
  .en {
    margin: 8px 0 0;
    font-family: var(--font-title);
    font-size: 30px;
    color: #ffd54f;
  }
  .mr {
    margin: 2px 0 10px;
    font-size: 22px;
    font-weight: 800;
    line-height: 1.5;
  }
  .msg {
    margin: 0 0 6px;
    text-wrap: balance;
    font-size: 14.5px;
    line-height: 1.45;
    opacity: 0.95;
  }
  .mr-msg {
    line-height: 1.7;
  }
  .btns {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  .btns .btn {
    min-height: 44px;
  }
  .btns .btn:not(.primary) {
    background: rgba(255, 255, 255, 0.12);
    color: #fff8e7;
    border-color: rgba(255, 255, 255, 0.25);
  }
  .music-chip {
    position: fixed;
    z-index: 121;
    left: 12px;
    bottom: 16px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid #f2c94c;
    background: #4a0f0a;
    color: #fff8e7;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }
  @media (max-width: 767px) {
    .swag {
      width: 88px;
      height: 64px;
    }
    .music-chip {
      bottom: 84px;
    }
    .en {
      font-size: 26px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toran,
    .swag,
    .card-fest,
    .diya {
      animation: none;
    }
    .petals {
      display: none;
    }
  }
</style>
