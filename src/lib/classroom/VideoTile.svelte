<script lang="ts">
  /** A video in the corner: the coach's camera or screen for students (tap to enlarge), the coach's own preview. */
  let { stream, label, mirror = false }: { stream: MediaStream; label: string; mirror?: boolean } = $props();
  let big = $state(false);
  let video: HTMLVideoElement;
  $effect(() => {
    if (video && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  });
</script>

<button class="tile" class:big onclick={() => (big = !big)} title={big ? 'Smaller' : 'Bigger'} aria-label="{label}: {big ? 'make smaller' : 'make bigger'}">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={video} autoplay playsinline muted class:mirror></video>
  <span class="lbl">{label}</span>
</button>

<style>
  .tile {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: 70;
    width: 240px;
    aspect-ratio: 16 / 9;
    padding: 0;
    border: 2px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: #000;
    box-shadow: var(--shadow);
    cursor: pointer;
    transition: width 0.2s ease;
  }
  .tile.big {
    width: min(720px, calc(100vw - 28px));
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  video.mirror {
    transform: scaleX(-1);
  }
  .lbl {
    position: absolute;
    left: 6px;
    bottom: 5px;
    font: 700 12px var(--font-body);
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
    padding: 1px 6px;
    border-radius: 6px;
  }
  @media (max-width: 600px) {
    .tile {
      width: 150px;
      bottom: 70px;
    }
  }
</style>
