<script lang="ts">
  /**
   * A player's picture with the frame they wear from the Shop (cosmetics.css: .ccav[data-frame]) and, if given, their
   * Treasury level on a small shield. The same everywhere a picture shows (the header, profiles, friends, Online now),
   * so a frame bought is seen by everyone.
   */
  import type { Snippet } from 'svelte';
  import { rankOf } from './core';

  let {
    src = '',
    text = '',
    size = 40,
    frame = '',
    level = 0,
    border = '',
    children,
  }: {
    /** The picture (a photo, an avatar), or `text` (initials) in its place. */
    src?: string;
    text?: string;
    size?: number;
    frame?: string;
    /** 0: no level badge. */
    level?: number;
    /** The plain ring without a frame (e.g. "2px solid var(--gold)"). */
    border?: string;
    children?: Snippet;
  } = $props();
  const ring = $derived(Math.max(3, Math.round(size * 0.09)));
</script>

<span class="ccav" data-frame={frame || undefined} style="--s: {size}px; --ring: {ring}px;">
  <span class="ring" aria-hidden="true"></span>
  <span class="pic" style={!frame && border ? `border: ${border}` : undefined}>
    {#if src}<img {src} alt="" />{:else}<span class="txt" style="font-size: {Math.round(size * 0.36)}px">{text}</span>{/if}
  </span>
  <span class="orn" aria-hidden="true"></span>
  {#if level}<span class="lvl" title="Level {level} · {rankOf(level)}" style="font-size: {Math.max(9, Math.round(size * 0.24))}px">{level}</span>{/if}
  {@render children?.()}
</span>

<style>
  .ccav {
    position: relative;
    display: inline-block;
    flex: none;
    width: var(--s);
    height: var(--s);
    vertical-align: middle;
  }
  .ring {
    display: none;
    position: absolute;
    inset: calc(var(--ring) * -1);
    border-radius: 50%;
    -webkit-mask: radial-gradient(circle, transparent calc(50% - var(--ring)), #000 calc(50% - var(--ring) + 0.5px));
    mask: radial-gradient(circle, transparent calc(50% - var(--ring)), #000 calc(50% - var(--ring) + 0.5px));
  }
  .pic {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: var(--raised);
    color: var(--text);
  }
  .pic img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .txt {
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .orn {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .lvl {
    position: absolute;
    right: -10%;
    bottom: -8%;
    min-width: 1.7em;
    height: 1.7em;
    padding: 0 0.3em;
    display: grid;
    place-items: center;
    border-radius: 0.55em 0.55em 0.85em 0.85em;
    background: linear-gradient(180deg, #2b4da8, #182d6b);
    border: 1.5px solid #edb040;
    color: #fff;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  }
</style>
