<script lang="ts">
  /**
   * Everyone in the class as tiles, like a meeting (owner, 2026-10-22): the camera when it is on, else the initial and
   * the name; the microphone, a raised hand and who is speaking. Compact above the side tabs, or big (the coach's
   * gallery view). Tap a tile to see it big.
   */
  import type { Live } from './live.svelte';

  let { live, big = false }: { live: Live; big?: boolean } = $props();
  let hidden = $state(false);
  let focus = $state<string | undefined>();

  const tiles = $derived(
    [...live.people]
      .filter((p) => p.online)
      .sort((a, b) => Number(b.coach) - Number(a.coach) || Number(b.uid === live.me.uid) - Number(a.uid === live.me.uid) || Number(b.cam) - Number(a.cam) || a.name.localeCompare(b.name)),
  );
  const streamOf = (uid: string): MediaStream | undefined => {
    if (uid === live.me.uid) return live.localVideo;
    if (uid === live.info.coach) return live.coachVideo;
    // Classmates' cameras only when the coach lets students see each other.
    if (!live.coach && live.settings.peers === false) return undefined;
    return live.videos[uid];
  };
  const COLORS = ['#3b5bdb', '#7048e8', '#0c8599', '#e8590c', '#2f9e44', '#c2255c', '#1971c2', '#9c36b5'];
  const colorOf = (name: string) => COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

  /** Puts a stream into its video element (and keeps it there when the element is reused). */
  function stream(el: HTMLVideoElement, s: MediaStream) {
    const set = (v: MediaStream) => {
      if (el.srcObject !== v) {
        el.srcObject = v;
        void el.play().catch(() => undefined);
      }
    };
    set(s);
    return { update: set };
  }
  const focused = $derived(focus ? tiles.find((p) => p.uid === focus) : undefined);
</script>

{#snippet tile(p: (typeof tiles)[number], large: boolean)}
  {@const s = p.cam ? streamOf(p.uid) : undefined}
  <button class="tile" class:large class:speaking={(live.levels[p.uid] ?? 0) > 0.12} onclick={() => (focus = focus === p.uid ? undefined : p.uid)} aria-label="{p.name}{large ? ': smaller' : ': bigger'}">
    {#if s}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video use:stream={s} autoplay playsinline muted class:mirror={p.uid === live.me.uid}></video>
    {:else}
      <span class="avatar" style="background: {colorOf(p.name)}">{p.name.trim().charAt(0).toUpperCase()}</span>
    {/if}
    <span class="cap">{p.hand ? '✋ ' : ''}{p.name}{p.uid === live.me.uid ? ' (you)' : p.coach ? ' · Coach' : ''}{p.voice ? (p.mic ? ' 🎙️' : ' 🔇') : ''}</span>
  </button>
{/snippet}

<section class="gallery" class:big>
  {#if !big}
    <button class="head" onclick={() => (hidden = !hidden)} aria-expanded={!hidden}>
      <span>👥 {tiles.length} here{tiles.some((p) => p.cam) ? ` · ${tiles.filter((p) => p.cam).length} on camera` : ''}</span>
      <span class="muted">{hidden ? 'Show' : 'Hide'}</span>
    </button>
  {/if}
  {#if !hidden}
    <div class="grid">
      {#each tiles as p (p.uid)}{@render tile(p, false)}{/each}
    </div>
  {/if}
</section>

{#if focused}
  <div class="scrim" role="presentation" onclick={() => (focus = undefined)}></div>
  <div class="focus">{@render tile(focused, true)}</div>
{/if}

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }
  .gallery.big {
    border: 0;
    padding: 0;
    width: 100%;
  }
  .head {
    display: flex;
    justify-content: space-between;
    background: none;
    border: 0;
    color: var(--text);
    font: 700 13px var(--font-body);
    cursor: pointer;
    padding: 0;
  }
  .muted {
    color: var(--muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    max-height: 230px;
    overflow: auto;
  }
  .big .grid {
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    max-height: none;
    gap: 10px;
  }
  .tile {
    position: relative;
    aspect-ratio: 4 / 3;
    border-radius: 10px;
    overflow: hidden;
    background: #1b2236;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .tile.speaking {
    border-color: var(--win);
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  video.mirror {
    transform: scaleX(-1);
  }
  .avatar {
    width: 44%;
    aspect-ratio: 1;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #fff;
    font: 800 clamp(16px, 2.4vw, 34px) var(--font-title);
  }
  .cap {
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 4px;
    font: 700 11px var(--font-body);
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
    padding: 1px 6px;
    border-radius: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .big .cap {
    font-size: 13px;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 85;
    background: rgba(5, 10, 20, 0.6);
  }
  .focus {
    position: fixed;
    z-index: 86;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(820px, calc(100vw - 24px));
  }
  .tile.large {
    width: 100%;
  }
  .tile.large .cap {
    font-size: 15px;
  }
</style>
