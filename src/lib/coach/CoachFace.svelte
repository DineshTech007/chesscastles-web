<script lang="ts">
  /**
   * The coach's face, drawn for Chess Castles (Professor Hoot, Guruji, Robo, Gaja):
   * it blinks, and the mouth moves while Guru talks. Picked with the avatar
   * chooser (see avatar.ts).
   */
  let { id, size = 64, talking = false }: { id: 'hoot' | 'guruji' | 'robo' | 'gaja'; size?: number; talking?: boolean } = $props();
  import { offscreen } from '$lib/offscreen';
  const uid = $props.id();
</script>

<span class="face" class:talking use:offscreen>
{#if id === 'hoot'}
  <svg class="av" width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Professor Hoot, a wise owl">
            <defs>
              <radialGradient id="oBg-{uid}" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#3a86a8"/><stop offset="1" stop-color="#123049"/></radialGradient>
              <linearGradient id="oBody-{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b07c4f"/><stop offset="1" stop-color="#7a4f2e"/></linearGradient>
              <clipPath id="oClip-{uid}"><circle cx="80" cy="80" r="76"/></clipPath>
            </defs>
            <circle cx="80" cy="80" r="78" fill="url(#oBg-{uid})"/>
            <circle cx="80" cy="80" r="76" fill="none" stroke="#edb040" stroke-width="4"/>
            <g clip-path="url(#oClip-{uid})">
              <path d="M28 162 C24 124 38 102 80 100 C122 102 136 124 132 162 Z" fill="url(#oBody-{uid})" stroke="#3b2414" stroke-width="3"/>
              <path d="M52 162 C50 134 60 116 80 114 C100 116 110 134 108 162 Z" fill="#f3dfbd"/>
              <path d="M62 130 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 M58 142 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 M58 154 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0" fill="none" stroke="#c9a57a" stroke-width="2" stroke-linecap="round"/>
              <path d="M34 112 C22 128 24 150 34 162 L50 162 C44 142 44 126 48 114 Z" fill="#6e4426" stroke="#3b2414" stroke-width="2.5" stroke-linejoin="round"/>
              <g stroke="#3b2414" stroke-width="2" stroke-linejoin="round">
                <circle cx="118" cy="122" r="6.5" fill="#fbfbfb"/>
                <path d="M111 141 C113 133 115 130 118 129 C121 130 123 133 125 141 Z" fill="#fbfbfb"/>
                <rect x="108" y="140" width="20" height="6" rx="2.5" fill="#fbfbfb"/>
              </g>
              <path d="M126 112 C136 126 136 146 128 162 L114 162 C118 154 122 148 116 146 C124 140 124 124 120 114 Z" fill="#6e4426" stroke="#3b2414" stroke-width="2.5" stroke-linejoin="round"/>
              <path d="M80 112 L66 105 L66 119 Z M80 112 L94 105 L94 119 Z" fill="#d6453d" stroke="#6b1813" stroke-width="2" stroke-linejoin="round"/>
              <circle cx="80" cy="112" r="4" fill="#b8322b" stroke="#6b1813" stroke-width="2"/>
              <ellipse cx="80" cy="78" rx="47" ry="40" fill="url(#oBody-{uid})" stroke="#3b2414" stroke-width="3"/>
              <path d="M80 58 C70 64 64 66 54 62 M80 58 C90 64 96 66 106 62" fill="none" stroke="#5c3a20" stroke-width="2" stroke-linecap="round" opacity=".6"/>
              <ellipse cx="61" cy="82" rx="22" ry="21" fill="#f6e7cc"/>
              <ellipse cx="99" cy="82" rx="22" ry="21" fill="#f6e7cc"/>
              <g class="blink"><circle cx="61" cy="82" r="12" fill="#fff"/><circle cx="63" cy="83" r="6.5" fill="#1b1b2e"/><circle cx="65.2" cy="80.6" r="2.2" fill="#fff"/></g>
              <g class="blink"><circle cx="99" cy="82" r="12" fill="#fff"/><circle cx="101" cy="83" r="6.5" fill="#1b1b2e"/><circle cx="103.2" cy="80.6" r="2.2" fill="#fff"/></g>
              <circle cx="61" cy="82" r="15.5" fill="rgba(255,255,255,.14)" stroke="#edb040" stroke-width="3.5"/>
              <circle cx="99" cy="82" r="15.5" fill="rgba(255,255,255,.14)" stroke="#edb040" stroke-width="3.5"/>
              <path d="M76.5 80 q3.5 -4 7 0" fill="none" stroke="#edb040" stroke-width="3" stroke-linecap="round"/>
              <path class="brow" d="M46 62 q13 -9 26 -1" fill="none" stroke="#3b2414" stroke-width="4.5" stroke-linecap="round"/>
              <path class="brow" d="M88 61 q13 -8 26 1" fill="none" stroke="#3b2414" stroke-width="4.5" stroke-linecap="round"/>
              <ellipse cx="80" cy="103" rx="5" ry="4" fill="#5a1f12"/>
              <path class="jaw" d="M74.5 99 L85.5 99 L80 108 Z" fill="#d9862a" stroke="#8a4f12" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M72 95 Q80 90 88 95 L80 104 Z" fill="#f2a43c" stroke="#8a4f12" stroke-width="2" stroke-linejoin="round"/>
              <path d="M56 40 L56 49 C68 55 92 55 104 49 L104 40 Z" fill="#232a4d" stroke="#0f1430" stroke-width="2.5" stroke-linejoin="round"/>
              <path d="M80 22 L126 35 L80 48 L34 35 Z" fill="#2c3460" stroke="#0f1430" stroke-width="2.5" stroke-linejoin="round"/>
              <circle cx="80" cy="35" r="3" fill="#edb040"/>
              <g class="tassel"><path d="M80 35 L112 37 L113 58" fill="none" stroke="#edb040" stroke-width="2.5" stroke-linecap="round"/><path d="M109 56 L117 56 L118 66 L108 66 Z" fill="#edb040" stroke="#9a6a1c" stroke-width="1.5"/></g>
            </g>
          </svg>
{:else if id === 'guruji'}
  <svg class="av" width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Guruji, a wise grandmaster">
            <defs>
              <radialGradient id="gjBg-{uid}" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#f6c45a"/><stop offset="1" stop-color="#b4521f"/></radialGradient>
              <linearGradient id="gjSkin-{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d49a6a"/><stop offset="1" stop-color="#b47a4c"/></linearGradient>
              <clipPath id="gjClip-{uid}"><circle cx="80" cy="80" r="76"/></clipPath>
            </defs>
            <circle cx="80" cy="80" r="78" fill="url(#gjBg-{uid})"/>
            <circle cx="80" cy="80" r="76" fill="none" stroke="#7a1d2c" stroke-width="4"/>
            <g clip-path="url(#gjClip-{uid})">
              <path d="M12 162 C16 130 40 116 80 115 C120 116 144 130 148 162 Z" fill="#8e2232" stroke="#4f0f1a" stroke-width="3"/>
              <path d="M66 116 L80 140 L94 116 Z" fill="#f6efe0" stroke="#c9bfa8" stroke-width="2" stroke-linejoin="round"/>
              <path d="M30 128 L56 162" stroke="#edb040" stroke-width="10"/>
              <path d="M30 128 L56 162" stroke="#3a0a12" stroke-width="10" stroke-dasharray="5 5"/>
              <path d="M130 128 L104 162" stroke="#edb040" stroke-width="10"/>
              <path d="M130 128 L104 162" stroke="#3a0a12" stroke-width="10" stroke-dasharray="5 5"/>
              <path d="M68 98 L68 118 C74 123 86 123 92 118 L92 98 Z" fill="#a86f43"/>
              <ellipse cx="47" cy="76" rx="6.5" ry="10" fill="url(#gjSkin-{uid})" stroke="#4a2a17" stroke-width="2.5"/>
              <ellipse cx="113" cy="76" rx="6.5" ry="10" fill="url(#gjSkin-{uid})" stroke="#4a2a17" stroke-width="2.5"/>
              <ellipse cx="80" cy="70" rx="32" ry="37" fill="url(#gjSkin-{uid})" stroke="#4a2a17" stroke-width="3"/>
              <ellipse cx="70" cy="45" rx="10" ry="5" fill="#fff" opacity=".28" transform="rotate(-18 70 45)"/>
              <path d="M48 66 C42 54 46 42 56 40 C52 48 52 56 54 66 Z" fill="#f4f4f0" stroke="#bdbdb4" stroke-width="2" stroke-linejoin="round"/>
              <path d="M112 66 C118 54 114 42 104 40 C108 48 108 56 106 66 Z" fill="#f4f4f0" stroke="#bdbdb4" stroke-width="2" stroke-linejoin="round"/>
              <path class="brow" d="M57 58 q10 -8 20 -2" fill="none" stroke="#f7f7f2" stroke-width="6" stroke-linecap="round"/>
              <path class="brow" d="M83 56 q10 -6 20 2" fill="none" stroke="#f7f7f2" stroke-width="6" stroke-linecap="round"/>
              <g class="blink"><ellipse cx="67" cy="69" rx="4" ry="4.6" fill="#2a1a10"/><circle cx="68.4" cy="67.6" r="1.4" fill="#fff"/></g>
              <g class="blink"><ellipse cx="93" cy="69" rx="4" ry="4.6" fill="#2a1a10"/><circle cx="94.4" cy="67.6" r="1.4" fill="#fff"/></g>
              <circle cx="67" cy="69" r="10.5" fill="rgba(255,255,255,.15)" stroke="#1d1d1d" stroke-width="2.8"/>
              <circle cx="93" cy="69" r="10.5" fill="rgba(255,255,255,.15)" stroke="#1d1d1d" stroke-width="2.8"/>
              <path d="M77.5 68 q2.5 -3 5 0" fill="none" stroke="#1d1d1d" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M80 72 q-5 11 -1 14 q4 1 6 -1" fill="none" stroke="#7a4a2a" stroke-width="2.4" stroke-linecap="round"/>
              <ellipse cx="58" cy="84" rx="6" ry="3.5" fill="#e0776a" opacity=".45"/>
              <ellipse cx="102" cy="84" rx="6" ry="3.5" fill="#e0776a" opacity=".45"/>
              <path d="M49 78 C48 102 60 124 80 130 C100 124 112 102 111 78 C104 90 96 95 80 95 C64 95 56 90 49 78 Z" fill="#f7f7f2" stroke="#bdbdb4" stroke-width="2" stroke-linejoin="round"/>
              <path d="M66 108 q3 8 2 14 M80 112 v12 M94 108 q-3 8 -2 14" fill="none" stroke="#d2d2c8" stroke-width="2" stroke-linecap="round"/>
              <path class="smile" d="M72 99 q8 6 16 0" fill="none" stroke="#5a2418" stroke-width="2.6" stroke-linecap="round"/>
              <ellipse class="mouth" cx="80" cy="100" rx="6.5" ry="4.5" fill="#5a2418"/>
              <path d="M62 94 C68 86 75 88 80 91 C85 88 92 86 98 94 C92 96 85 96 80 94 C75 96 68 96 62 94 Z" fill="#fbfbf8" stroke="#bdbdb4" stroke-width="2" stroke-linejoin="round"/>
              <circle cx="116" cy="138" r="9" fill="#edb040" stroke="#7a4f12" stroke-width="2"/>
              <path d="M112 143 L120 143 L119.4 139 C121.6 136 121.6 132 118.6 130 L115.8 129.4 L114.6 127.6 L114 130 C112 131.4 111 134 112.2 135.2 L115 134 L113.6 139 Z" fill="#4f0f1a"/>
            </g>
          </svg>
{:else if id === 'robo'}
  <svg class="av" width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Robo, a friendly chess robot">
            <defs>
              <radialGradient id="rBg-{uid}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#2d4580"/><stop offset="1" stop-color="#0d1530"/></radialGradient>
              <linearGradient id="rHead-{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fd"/><stop offset="1" stop-color="#b9c6de"/></linearGradient>
              <clipPath id="rClip-{uid}"><circle cx="80" cy="80" r="76"/></clipPath>
              <filter id="rGlow-{uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <circle cx="80" cy="80" r="78" fill="url(#rBg-{uid})"/>
            <circle cx="80" cy="80" r="76" fill="none" stroke="#5ef0ff" stroke-width="3" opacity=".7"/>
            <g clip-path="url(#rClip-{uid})">
              <path d="M20 40 H140 M20 60 H140 M20 140 H140 M40 20 V140 M120 20 V140" stroke="#5ef0ff" stroke-width="1" opacity=".12"/>
              <path d="M28 162 C30 132 50 118 80 118 C110 118 130 132 132 162 Z" fill="#2a3f6e" stroke="#0b1426" stroke-width="3"/>
              <rect x="70" y="106" width="20" height="14" fill="#8ea2c9" stroke="#0b1426" stroke-width="2.5"/>
              <circle cx="80" cy="140" r="12" fill="#edb040" stroke="#7a4f12" stroke-width="2.5"/>
              <path d="M75 148 L86 148 L85.2 143 C88 139 88 133 84.2 130 L80.6 129.2 L79 126.6 L78.2 130 C75.4 132 74 135.4 75.6 137 L79.2 135.4 L77.4 143 Z" fill="#0b1426"/>
              <line x1="80" y1="36" x2="80" y2="22" stroke="#9fb3d9" stroke-width="3.5" stroke-linecap="round"/>
              <circle class="bulb" cx="80" cy="19" r="5.5" fill="#ff5c7a" filter="url(#rGlow-{uid})"/>
              <rect x="23" y="60" width="13" height="28" rx="5" fill="#2a3f6e" stroke="#0b1426" stroke-width="2.5"/>
              <rect x="124" y="60" width="13" height="28" rx="5" fill="#2a3f6e" stroke="#0b1426" stroke-width="2.5"/>
              <rect x="33" y="35" width="94" height="76" rx="24" fill="url(#rHead-{uid})" stroke="#0b1426" stroke-width="3.5"/>
              <rect x="43" y="48" width="74" height="44" rx="15" fill="#0e1834"/>
              <path class="brow" d="M53 58 L69 55" stroke="#5ef0ff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>
              <path class="brow" d="M91 55 L107 58" stroke="#5ef0ff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>
              <g filter="url(#rGlow-{uid})">
                <rect class="blink" x="54" y="61" width="15" height="17" rx="6.5" fill="#5ef0ff"/>
                <rect class="blink" x="91" y="61" width="15" height="17" rx="6.5" fill="#5ef0ff"/>
              </g>
              <path class="smile" d="M68 84 q12 6 24 0" fill="none" stroke="#5ef0ff" stroke-width="2.6" stroke-linecap="round"/>
              <g class="bars" fill="#5ef0ff">
                <rect x="65" y="80" width="4" height="10" rx="2"/><rect x="71.5" y="79" width="4" height="12" rx="2"/><rect x="78" y="78" width="4" height="14" rx="2"/><rect x="84.5" y="79" width="4" height="12" rx="2"/><rect x="91" y="80" width="4" height="10" rx="2"/>
              </g>
              <circle cx="44" cy="100" r="2.5" fill="#8ea2c9"/><circle cx="116" cy="100" r="2.5" fill="#8ea2c9"/>
            </g>
          </svg>
{:else if id === 'gaja'}
  <svg class="av" width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Gaja, a wise elephant">
            <defs>
              <radialGradient id="eBg-{uid}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#48b898"/><stop offset="1" stop-color="#145649"/></radialGradient>
              <linearGradient id="eSkin-{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3cadb"/><stop offset="1" stop-color="#9aa3ba"/></linearGradient>
              <clipPath id="eClip-{uid}"><circle cx="80" cy="80" r="76"/></clipPath>
            </defs>
            <circle cx="80" cy="80" r="78" fill="url(#eBg-{uid})"/>
            <circle cx="80" cy="80" r="76" fill="none" stroke="#edb040" stroke-width="4"/>
            <g clip-path="url(#eClip-{uid})">
              <path d="M22 162 C26 134 48 120 80 119 C112 120 134 134 138 162 Z" fill="#c2364a" stroke="#6d1422" stroke-width="3"/>
              <path d="M30 140 C50 128 110 128 130 140" fill="none" stroke="#edb040" stroke-width="5"/>
              <path d="M30 140 C50 128 110 128 130 140" fill="none" stroke="#6d1422" stroke-width="5" stroke-dasharray="4 4"/>
              <path d="M50 52 C18 40 4 82 18 104 C28 118 46 114 54 98 Z" fill="url(#eSkin-{uid})" stroke="#3a3f55" stroke-width="3" stroke-linejoin="round"/>
              <path d="M46 60 C26 54 16 82 25 98 C32 106 42 104 48 94 Z" fill="#e9b3bb"/>
              <path d="M110 52 C142 40 156 82 142 104 C132 118 114 114 106 98 Z" fill="url(#eSkin-{uid})" stroke="#3a3f55" stroke-width="3" stroke-linejoin="round"/>
              <path d="M114 60 C134 54 144 82 135 98 C128 106 118 104 112 94 Z" fill="#e9b3bb"/>
              <ellipse cx="80" cy="72" rx="36" ry="35" fill="url(#eSkin-{uid})" stroke="#3a3f55" stroke-width="3"/>
              <path d="M62 40 L98 40 L80 64 Z" fill="#edb040" stroke="#8a5a10" stroke-width="2" stroke-linejoin="round"/>
              <path d="M68 44 h6 v6 h-6 Z M80 44 h6 v6 h-6 Z M74 50 h6 v6 h-6 Z" fill="#8a5a10"/>
              <circle cx="80" cy="66" r="3" fill="#d6453d" stroke="#6d1422" stroke-width="1.5"/>
              <path class="brow" d="M53 64 q9 -7 18 -2" fill="none" stroke="#3a3f55" stroke-width="3.5" stroke-linecap="round"/>
              <path class="brow" d="M89 62 q9 -5 18 2" fill="none" stroke="#3a3f55" stroke-width="3.5" stroke-linecap="round"/>
              <g class="blink"><ellipse cx="63" cy="76" rx="5" ry="5.6" fill="#fff"/><circle cx="64" cy="76.5" r="3.2" fill="#1f2233"/><circle cx="65" cy="75.2" r="1.1" fill="#fff"/></g>
              <g class="blink"><ellipse cx="97" cy="76" rx="5" ry="5.6" fill="#fff"/><circle cx="98" cy="76.5" r="3.2" fill="#1f2233"/><circle cx="99" cy="75.2" r="1.1" fill="#fff"/></g>
              <circle cx="63" cy="76" r="10" fill="rgba(255,255,255,.14)" stroke="#edb040" stroke-width="3"/>
              <circle cx="97" cy="76" r="10" fill="rgba(255,255,255,.14)" stroke="#edb040" stroke-width="3"/>
              <path d="M73 75 q7 -5 14 0" fill="none" stroke="#edb040" stroke-width="2.6" stroke-linecap="round"/>
              <ellipse cx="54" cy="90" rx="6" ry="3.5" fill="#e9a0a8" opacity=".6"/>
              <ellipse cx="106" cy="90" rx="6" ry="3.5" fill="#e9a0a8" opacity=".6"/>
              <path class="smile" d="M60 99 q6 5 12 1" fill="none" stroke="#4a2030" stroke-width="2.4" stroke-linecap="round"/>
              <ellipse class="mouth" cx="66" cy="101" rx="5.5" ry="4" fill="#4a2030"/>
              <path d="M70 96 q-4 8 -12 9 q6 -6 6 -11 Z" fill="#fffaf0" stroke="#b9ad92" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M90 96 q4 8 12 9 q-6 -6 -6 -11 Z" fill="#fffaf0" stroke="#b9ad92" stroke-width="1.6" stroke-linejoin="round"/>
              <g class="trunk-tip">
                <path d="M80 84 C80 108 80 124 94 130 C104 134 112 126 110 116" fill="none" stroke="#3a3f55" stroke-width="21" stroke-linecap="round"/>
                <path d="M80 84 C80 108 80 124 94 130 C104 134 112 126 110 116" fill="none" stroke="#adb5ca" stroke-width="15" stroke-linecap="round"/>
                <path d="M74 100 h12 M74 110 h12 M78 120 q6 2 10 -2" fill="none" stroke="#7f879e" stroke-width="1.8" stroke-linecap="round"/>
                <g stroke="#3a3f55" stroke-width="2" stroke-linejoin="round">
                  <circle cx="110" cy="98" r="5.5" fill="#fbfbfb"/>
                  <path d="M104 113 C106 107 108 105 110 104 C112 105 114 107 116 113 Z" fill="#fbfbfb"/>
                </g>
              </g>
            </g>
          </svg>
{/if}
</span>

<style>
  .face {
    display: inline-block;
    line-height: 0;
    flex: none;
  }
  .face :global(.blink) { transform-box: fill-box; transform-origin: center; animation: blink 4.6s infinite; }
  .face :global(.mouth) { transform-box: fill-box; transform-origin: center top; opacity: 0; }
  .face :global(.jaw) { transform-box: fill-box; transform-origin: center top; }
  .face :global(.brow) { transform-box: fill-box; transform-origin: center; }
  .face :global(.tassel) { transform-box: view-box; transform-origin: 112px 37px; animation: swing 2.8s ease-in-out infinite; }
  .face :global(.bulb) { animation: glow 1.8s ease-in-out infinite; }
  .face :global(.bars) { opacity: 0; }
  .face :global(.bars rect) { transform-box: fill-box; transform-origin: center; transform: scaleY(0.25); }
  .face :global(.trunk-tip) { transform-box: view-box; transform-origin: 80px 92px; animation: sway 3.2s ease-in-out infinite; }
  .talking :global(.mouth) { opacity: 1; animation: talk 0.26s infinite alternate ease-in-out; }
  .talking :global(.smile) { opacity: 0; }
  .talking :global(.jaw) { animation: jaw 0.26s infinite alternate ease-in-out; }
  .talking :global(.brow) { animation: brow 1.3s infinite ease-in-out; }
  .talking :global(.bars) { opacity: 1; }
  .talking :global(.bars rect) { animation: eq 0.32s infinite alternate ease-in-out; }
  .talking :global(.bars rect:nth-child(2)) { animation-delay: 0.08s; }
  .talking :global(.bars rect:nth-child(3)) { animation-delay: 0.16s; }
  .talking :global(.bars rect:nth-child(4)) { animation-delay: 0.04s; }
  .talking :global(.bars rect:nth-child(5)) { animation-delay: 0.12s; }
  @keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(0.08); } }
  @keyframes talk { from { transform: scaleY(0.3); } to { transform: scaleY(1.1); } }
  @keyframes jaw { from { transform: translateY(0); } to { transform: translateY(4px); } }
  @keyframes brow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
  @keyframes swing { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(7deg); } }
  @keyframes glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
  @keyframes eq { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }
  @keyframes sway { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-4deg); } }
  .face:global([data-off]) :global(*) { animation-play-state: paused !important; }
  @media (prefers-reduced-motion: reduce) {
    .face :global(*) { animation: none !important; }
  }
</style>
