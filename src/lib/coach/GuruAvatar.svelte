<script lang="ts">
  /**
   * Chess Guru, in the look the student chose (see avatar.ts): a portrait in a gold-ringed circle. While Guru
   * talks, the coach comes alive (a short talking loop), rings spread from it and a small voice meter moves.
   * Without motion (reduced motion), the portrait only.
   */
  import { AVATARS, coachAvatar, type AvatarId } from './avatar';

  let { size = 64, talking = false, ring = true, id }: { size?: number; talking?: boolean; ring?: boolean; id?: AvatarId } = $props();
  const look = $derived(id ?? $coachAvatar);
  const info = $derived(AVATARS.find((a) => a.id === look) ?? AVATARS[0]);
</script>

<span class="flu" class:talking class:ring style="--s: {size}px" role="img" aria-label="{info.name}, your coach">
  <span class="wave"></span>
  <span class="wave w2"></span>
  <span class="disc">
    <img src={info.image} alt="" width={size} height={size} loading="lazy" decoding="async" />
    {#if talking}<video class="talk" src={info.video} poster={info.image} autoplay loop muted playsinline preload="auto" aria-hidden="true"></video>{/if}
  </span>
  {#if talking && size >= 48}
    <span class="meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  {/if}
</span>

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
    overflow: hidden;
    background: radial-gradient(circle at 50% 38%, #24345e, #0d1631);
    box-shadow: 0 calc(var(--s) * 0.05) calc(var(--s) * 0.14) rgba(0, 0, 0, 0.35);
  }
  .ring .disc {
    box-shadow:
      0 0 0 calc(max(2px, var(--s) * 0.035)) #edb040,
      0 calc(var(--s) * 0.06) calc(var(--s) * 0.16) rgba(0, 0, 0, 0.4);
  }
  .disc img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transform-origin: 50% 70%;
  }
  .talk {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: fade-in 0.25s ease-out;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  .wave {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid #edb040;
    opacity: 0;
  }
  .meter {
    position: absolute;
    bottom: calc(var(--s) * -0.06);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 2px;
    align-items: flex-end;
    height: calc(var(--s) * 0.16);
    padding: 2px 5px;
    border-radius: 999px;
    background: #0d1631;
    box-shadow: 0 0 0 1.5px #edb040;
  }
  .meter i {
    width: 3px;
    height: 40%;
    border-radius: 2px;
    background: #edb040;
    animation: eq 0.6s ease-in-out infinite alternate;
  }
  .meter i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .meter i:nth-child(3) {
    animation-delay: 0.3s;
  }
  .meter i:nth-child(4) {
    animation-delay: 0.45s;
  }
  .talking img {
    animation: breathe 0.9s infinite alternate ease-in-out;
  }
  /* The talking loop moves by itself: the portrait under it stays still. */
  .talking:has(.talk) img {
    animation: none;
  }
  .talking .wave {
    animation: ring 1.4s infinite ease-out;
  }
  .talking .w2 {
    animation-delay: 0.7s;
  }
  @keyframes breathe {
    to {
      transform: scale(1.04) translateY(-1%);
    }
  }
  @keyframes ring {
    from {
      transform: scale(1);
      opacity: 0.8;
    }
    to {
      transform: scale(1.3);
      opacity: 0;
    }
  }
  @keyframes eq {
    to {
      height: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .talk {
      display: none;
    }
    .talking img,
    .talking .wave,
    .meter i {
      animation: none;
    }
  }
</style>
