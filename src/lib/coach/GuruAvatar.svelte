<script lang="ts">
  /** Chess Guru, in the look the student chose (see avatar.ts). */
  import { AVATARS, coachAvatar, type AvatarId } from './avatar';
  import CoachFace from './CoachFace.svelte';
  import KnightFace from './KnightFace.svelte';

  let { size = 64, talking = false, ring = true, id }: { size?: number; talking?: boolean; ring?: boolean; id?: AvatarId } = $props();
  const look = $derived(id ?? $coachAvatar);
  const info = $derived(AVATARS.find((a) => a.id === look));
</script>

{#if look === 'knight'}
  <KnightFace {size} {talking} {ring} />
{:else if info?.image}
  <span class="flu" class:talking style="--s: {size}px" role="img" aria-label="{info.name}, your coach">
    <span class="disc" class:ring></span>
    <span class="wave"></span>
    <span class="wave w2"></span>
    <img src={info.image} alt="" />
  </span>
{:else}
  <CoachFace id={look as 'hoot' | 'guruji' | 'robo' | 'gaja'} {size} {talking} />
{/if}

<style>
  .flu {
    position: relative;
    width: var(--s);
    height: var(--s);
    display: inline-grid;
    place-items: center;
    flex: none;
  }
  .disc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 38%, #4c86ff, #183a9a);
  }
  .disc.ring {
    box-shadow: inset 0 0 0 calc(var(--s) * 0.03) #edb040;
  }
  .flu img {
    position: relative;
    width: 78%;
    height: 78%;
    object-fit: contain;
    filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.25));
  }
  .wave {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid #edb040;
    opacity: 0;
  }
  .talking img {
    animation: nod 0.5s infinite alternate ease-in-out;
  }
  .talking .wave {
    animation: ring 1.2s infinite ease-out;
  }
  .talking .w2 {
    animation-delay: 0.6s;
  }
  @keyframes nod {
    from {
      transform: translateY(0) rotate(-1.5deg);
    }
    to {
      transform: translateY(-3%) rotate(1.5deg) scale(1.03);
    }
  }
  @keyframes ring {
    from {
      transform: scale(1);
      opacity: 0.8;
    }
    to {
      transform: scale(1.28);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .talking img,
    .talking .wave {
      animation: none;
    }
  }
</style>
