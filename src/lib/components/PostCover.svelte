<script lang="ts">
  /** A blog post's cover: a big chess piece on a colour made from the post's hue (no images to download). */
  let { piece, hue, size = 'card' }: { piece: string; hue: number; size?: 'card' | 'hero' } = $props();
</script>

<div class="cover {size}" style="--h: {hue}" aria-hidden="true">
  <span>{piece}</span>
</div>

<style>
  .cover {
    display: grid;
    place-items: center;
    overflow: hidden;
    background:
      radial-gradient(120% 90% at 20% 0%, hsl(var(--h) 80% 55% / 0.55), transparent 60%),
      repeating-conic-gradient(rgba(255, 255, 255, 0.05) 0 25%, transparent 0 50%) 0 0 / 48px 48px,
      linear-gradient(135deg, hsl(var(--h) 55% 22%), #0b1426);
  }
  .card {
    height: 130px;
  }
  .hero {
    height: 200px;
    border-radius: var(--r-card);
  }
  span {
    font-size: 84px;
    line-height: 1;
    color: hsl(var(--h) 90% 82%);
    text-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  }
  .hero span {
    font-size: 120px;
  }
</style>
