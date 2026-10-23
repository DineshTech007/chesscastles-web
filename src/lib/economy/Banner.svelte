<script lang="ts">
  /**
   * A profile banner from the Shop: a sky and the Chess Castles skyline, drawn here (no pictures to load). Fills its
   * parent (position: absolute), behind the profile's name and picture.
   */
  let { id }: { id: string } = $props();
  const SKY: Record<string, string> = {
    brook: 'linear-gradient(180deg, #7cc4f5 0%, #bfe6ff 60%, #e8f6ff 100%)',
    bmoat: 'radial-gradient(circle at 78% 28%, #fff9d6 0 5%, rgba(255, 249, 214, 0.25) 6%, transparent 14%), linear-gradient(180deg, #0b1636 0%, #1d2f6b 70%, #2c4a8f 100%)',
    btwilight: 'linear-gradient(180deg, #2a1050 0%, #6b2c91 45%, #f08a5d 100%)',
    bmonsoon: 'repeating-linear-gradient(105deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 7px), linear-gradient(180deg, #3d4d5c 0%, #6f8796 60%, #9fb4bf 100%)',
    bthrone: 'repeating-linear-gradient(90deg, rgba(237,176,64,0.35) 0 6px, transparent 6px 64px), linear-gradient(180deg, #4a0d16 0%, #8f1d2c 60%, #b8333f 100%)',
    bsiege: 'linear-gradient(180deg, #1b1f4a 0%, #8a3b5b 45%, #ff9a3c 80%, #ffd27a 100%)',
    bpennant: 'linear-gradient(180deg, #0f3d2e 0%, #1f6b4c 60%, #3a8f6a 100%)',
  };
  const WALL: Record<string, string> = { brook: '#3a4a6b', bmoat: '#0a1128', btwilight: '#1a0b30', bmonsoon: '#26333d', bthrone: '#2a0609', bsiege: '#140c22', bpennant: '#082219' };
</script>

<div class="banner b-{id}" style="background: {SKY[id] ?? SKY.brook}" aria-hidden="true">
  {#if id === 'bsiege'}<div class="sun"></div>{/if}
  {#if id === 'bpennant'}<div class="pennant">🚩</div>{/if}
  <svg class="sky" viewBox="0 0 600 120" preserveAspectRatio="xMidYMax slice">
    <path fill={WALL[id] ?? WALL.brook} d="M0 120V84h24v-10h10v10h10v-10h10v10h12V58h-6v-10h8v6h8v-6h8v6h8v-6h8v10h-6v26h40V40h-8V26h10v8h10v-8h10v8h10v-8h10v14h-8v44h60v-14h10v8h10v-8h10v8h10v-8h10v14h40V34h-10V18h12v10h10V18h12v10h10V18h12v16h-10v50h44V60h-8V48h10v8h10v-8h10v8h10v-8h10v12h-8v24h46v-10h10v10h10v-10h10v10h10v-10h10v10h22v36z" />
    {#if id === 'bmoat' || id === 'btwilight' || id === 'bsiege'}
      <g fill="#ffd27a" opacity=".85"><rect x="200" y="72" width="5" height="8" rx="2" /><rect x="320" y="50" width="5" height="8" rx="2" /><rect x="420" y="80" width="5" height="8" rx="2" /><rect x="106" y="74" width="4" height="7" rx="2" /></g>
    {/if}
  </svg>
</div>

<style>
  .banner {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
  }
  .sky {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 70%;
    opacity: 0.95;
  }
  .sun {
    position: absolute;
    left: 50%;
    bottom: 18%;
    width: 120px;
    height: 120px;
    margin-left: -60px;
    border-radius: 50%;
    background: radial-gradient(circle, #fff3c4 0 30%, rgba(255, 210, 122, 0.6) 45%, transparent 70%);
  }
  .sun::before {
    content: '';
    position: absolute;
    inset: -160px;
    background: repeating-conic-gradient(from 0deg, rgba(255, 230, 160, 0.22) 0 6deg, transparent 6deg 18deg);
    -webkit-mask: radial-gradient(circle, #000 20%, transparent 65%);
    mask: radial-gradient(circle, #000 20%, transparent 65%);
    animation: rays 30s linear infinite;
  }
  @keyframes rays {
    to {
      transform: rotate(360deg);
    }
  }
  .pennant {
    position: absolute;
    right: 18%;
    top: 12%;
    font-size: 30px;
    transform: rotate(-8deg);
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  }
</style>
