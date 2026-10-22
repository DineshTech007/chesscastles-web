<script lang="ts">
  /**
   * Emojis and phrases sent in a chat float up over the board (or the track): big, wobbling, fading away, so a child
   * sees a friend's 🔥 without looking away from the game. Lay it over a box with `position: relative`.
   */
  import { chatOff, hiddenChat, type ChatLine } from './chat';

  let { lines, me }: { lines: ChatLine[]; me: string } = $props();

  type Float = { id: string; text: string; emoji: boolean; mine: boolean; x: number };
  let floats = $state<Float[]>([]);
  let seen = new Set<string>();
  let primed = false;
  $effect(() => {
    const list = lines;
    // The messages already there when the page opened don't float.
    if (!primed) {
      for (const l of list) seen.add(l.id);
      primed = true;
      return;
    }
    for (const l of list) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      if (l.kind === 'text' || $chatOff || (l.uid !== me && $hiddenChat.has(l.uid))) continue;
      const f: Float = { id: l.id, text: l.text, emoji: l.kind === 'emoji', mine: l.uid === me, x: 12 + Math.random() * 76 };
      floats = [...floats, f].slice(-8);
      setTimeout(() => (floats = floats.filter((x) => x.id !== f.id)), 2600);
    }
  });
</script>

<div class="burst" aria-hidden="true">
  {#each floats as f (f.id)}
    <span class="f" class:emoji={f.emoji} class:mine={f.mine} style="left: {f.x}%">{f.text}</span>
  {/each}
</div>

<style>
  .burst {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 15;
  }
  .f {
    position: absolute;
    bottom: 8%;
    transform: translateX(-50%);
    animation: rise 2.6s ease-out forwards;
    white-space: nowrap;
    font: 800 15px var(--font-body);
    padding: 4px 10px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.85);
    color: #fff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }
  .f.emoji {
    background: transparent;
    box-shadow: none;
    padding: 0;
    font-size: 56px;
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
  }
  .f.mine.emoji {
    font-size: 40px;
  }
  @keyframes rise {
    0% {
      transform: translate(-50%, 30px) scale(0.4);
      opacity: 0;
    }
    15% {
      transform: translate(-50%, 0) scale(1.15);
      opacity: 1;
    }
    40% {
      transform: translate(-56%, -60px) rotate(-8deg);
    }
    70% {
      transform: translate(-44%, -130px) rotate(8deg);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -200px) scale(0.9);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .f {
      animation: none;
      opacity: 0;
    }
  }
</style>
