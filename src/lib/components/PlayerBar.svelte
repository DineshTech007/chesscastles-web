<script lang="ts">
  import { formatClock } from '$lib/format';
  import { fedName } from '$lib/fideFeds';
  import TitleBadge from './TitleBadge.svelte';

  let {
    name,
    subtitle,
    initials,
    toMove = false,
    thinking = false,
    captured = '',
    lead = 0,
    clockMs,
    me = false,
    photo,
    rating,
    ratingChange,
    country,
    title,
    href,
  }: {
    name: string;
    subtitle: string;
    initials: string;
    toMove?: boolean;
    thinking?: boolean;
    captured?: string;
    lead?: number;
    /** Undefined for a game without clocks. */
    clockMs?: number;
    me?: boolean;
    /** An image address for the player's photo, shown instead of the initials. */
    photo?: string;
    /** Shown under the name, e.g. "CC Rating 1612" or "1850". */
    rating?: string;
    /** After a rated game: how the rating moved (a green ▲ or a red ▼ beside it). */
    ratingChange?: number;
    /** FIDE federation code for the flag, e.g. "IND". */
    country?: string;
    /** A Chess Castles title, shown before the name. */
    title?: string;
    /** The player's page (their ratings and games): the name links to it. */
    href?: string;
  } = $props();
</script>

<div class="bar" class:to-move={toMove}>
  <span class="avatar" class:me>
    {#if photo}<img src={photo} alt="" />{:else}{initials}{/if}
    {#if thinking}<span class="dot" title="Thinking"></span>{/if}
  </span>
  <span class="who">
    <span class="title name">
      {#if href}<a class="profile" {href} title="See {name}'s profile and games"><TitleBadge {title} size={12} />{name}</a>{:else}<span><TitleBadge {title} size={12} />{name}</span>{/if}
      {#if country}
        <span class="flag-wrap" data-tip={fedName(country)}>
          <img class="flag" src="/flags/{country}.svg" alt={fedName(country)} width="20" height="14" />
        </span>
      {/if}
      {#if rating}<span class="rating num">{rating}</span>{/if}
      {#if ratingChange !== undefined}
        <span class="chg num" class:up={ratingChange > 0} class:down={ratingChange < 0} aria-label="Rating {ratingChange > 0 ? 'up' : ratingChange < 0 ? 'down' : 'unchanged'} {Math.abs(ratingChange)}">
          {ratingChange > 0 ? '▲' : ratingChange < 0 ? '▼' : '='}{ratingChange ? Math.abs(ratingChange) : ''}
        </span>
      {/if}
    </span>
    <span class="sub">
      {thinking ? 'Thinking…' : subtitle}
      {#if captured}<span class="captured" aria-label="Captured pieces">{captured}</span>{/if}
      {#if lead > 0}<strong class="lead">+{lead}</strong>{/if}
    </span>
  </span>
  {#if clockMs !== undefined}
    <span class="clock" class:active={toMove} class:low={clockMs < 60_000} role="timer" aria-label="{name} clock">
      {formatClock(clockMs)}
    </span>
  {/if}
</div>

<style>
  .name {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }
  .rating {
    font-size: 15px;
    font-weight: 800;
    padding: 2px 9px;
    border-radius: 7px;
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    color: var(--gold);
  }
  .chg {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 15px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 7px;
    background: var(--raised);
    color: var(--muted);
    animation: chg-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.4);
  }
  .chg.up {
    color: var(--win);
    background: color-mix(in srgb, var(--win) 16%, transparent);
  }
  .chg.down {
    color: var(--loss);
    background: color-mix(in srgb, var(--loss) 16%, transparent);
  }
  @keyframes chg-pop {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chg {
      animation: none;
    }
  }
  .flag-wrap {
    position: relative;
    display: inline-flex;
    cursor: default;
    outline: none;
  }
  .flag {
    border-radius: 2px;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
  }
  /* The country's name when the flag is hovered or focused. */
  .flag-wrap[data-tip]:hover::after,
  .flag-wrap[data-tip]:focus-visible::after {
    content: attr(data-tip);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    transform: translateX(-50%);
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 6px;
    background: #10182e;
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    z-index: 10;
    pointer-events: none;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 14px;
    background: var(--card);
    border: 1px solid var(--border);
    transition: border-color 0.2s;
  }
  .bar.to-move {
    border-color: var(--brand);
  }
  .avatar {
    position: relative;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex: none;
    display: grid;
    place-items: center;
    background: #5a3a1c;
    color: #eef3ff;
    font-family: var(--font-title);
    font-weight: 700;
    font-size: 15px;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  .avatar.me {
    background: var(--action);
  }
  .dot {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--live);
    border: 2px solid var(--card);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    font-size: 17px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 13.5px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow: hidden;
  }
  .captured {
    letter-spacing: -2px;
    font-size: 15px;
    overflow: hidden;
    text-overflow: clip;
  }
  .lead {
    color: var(--text);
    font-size: 13px;
  }
  /* Phones: a compact bar, so the board and the controls fit on one screen. */
  @media (max-width: 767px) {
    .bar {
      padding: 5px 8px;
      gap: 8px;
    }
    .avatar {
      width: 34px;
      height: 34px;
      font-size: 13px;
    }
    .name {
      font-size: 15.5px;
    }
    .sub {
      font-size: 12.5px;
    }
    .clock {
      font-size: 22px;
      padding: 3px 10px;
      min-width: 0;
    }
  }
</style>
