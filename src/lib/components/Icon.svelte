<script lang="ts" module>
  /** Line icons (24×24, stroke), one path each. */
  export const ICONS = {
    home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10',
    knight: 'M7 21h10M8 18h8l-1-5 2-2-1-5-4-3-2 2-3 1 1 3h3l-3 4z',
    puzzle: 'M13 2 4 14h7l-1 8 9-12h-7z',
    learn: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20',
    analyse: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
    watch: 'M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8',
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
    users: 'M6 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M15.5 14.2c3 .2 5.5 2.6 5.5 5.8',
    search: 'M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    sun: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    globe: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
    robot: 'M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 4v4M9 13h.01M15 13h.01',
    play: 'M7 4.5v15l12-7.5z',
    chevron: 'm9 6 6 6-6 6',
    back: 'm15 6-6 6 6 6',
    first: 'M6 6v12M18 6l-8 6 8 6',
    last: 'M18 6v12M6 6l8 6-8 6',
    flip: 'M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    close: 'M6 6l12 12M18 6 6 18',
    flame: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7.5z',
    history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2',
    chip: 'M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    book: 'M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5V20',
    replay: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
    menu: 'M4 7h16M4 12h16M4 17h16',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    check: 'm5 12 5 5 9-10',
    undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    coach: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
    mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
    speaker: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
    mute: 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6',
    settings:
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15 1.65 1.65 0 0 0 3.09 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.6.5 1.12 1.51 1h.09a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    palette:
      'M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.5-9-7.5zM7 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM9.5 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM14.5 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM17 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2z',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
    star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
    send: 'M4 12 20 4l-6 16-3-7z',
    crown: 'M3 19h18M4 8l4.5 4L12 5l3.5 7L20 8l-1.5 9h-13z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    chart: 'M4 4v16h16M8 15l3.5-4.5 3 3L20 7',
    database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    tree: 'M12 3v5M12 8 6 13M12 8l6 5M6 13v3M18 13v3M10 3h4M4 16h4v4H4zM16 16h4v4h-4z',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 3v4M17 5h4',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    share: 'M12 15V3M8 7l4-4 4 4M7 10H5v11h14V10h-2',
    dots: 'M12 5h.01M12 12h.01M12 19h.01',
    phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let {
    name,
    size = 22,
    color = 'currentColor',
    fill = false,
    label,
  }: { name: IconName; size?: number; color?: string; fill?: boolean; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={fill ? color : 'none'}
  stroke={fill ? 'none' : color}
  stroke-width="1.9"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  style="flex: none"
>
  <path d={ICONS[name]} />
</svg>
