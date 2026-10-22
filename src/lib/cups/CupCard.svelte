<script lang="ts">
  /**
   * One Castle Cup in a list (the cups page, Home): its time and time control, how long until it starts or which
   * round is on, who joined, the podium when it's over, and the one button that matters now (Join, Play, Watch).
   */
  import { t } from '$lib/i18n';
  import { contentLang } from '$lib/contentLang';
  import { countdown, cupTime, type CupSummary } from './api';

  let {
    cup,
    now,
    me = '',
    busy = false,
    admin = false,
    compact = false,
    onjoin,
    onleave,
    onstart,
    oncancel,
  }: {
    cup: CupSummary;
    now: number;
    me?: string;
    busy?: boolean;
    admin?: boolean;
    compact?: boolean;
    onjoin?: () => void;
    onleave?: () => void;
    onstart?: () => void;
    oncancel?: () => void;
  } = $props();

  const joined = $derived(!!me && cup.uids.includes(me));
  const soon = $derived(cup.status === 'open' && cup.startAt - now < 15 * 60_000);
  const lateOk = $derived(cup.status === 'running' && cup.round < 3);
  const icon = $derived(cup.speed === 'bullet' ? '⚡' : '🔥');
  const href = $derived(`/cups/${cup.id}`);
</script>

<article class="cup" class:live={cup.status === 'running'} class:soon class:compact class:done={cup.status === 'over' || cup.status === 'skipped' || cup.status === 'cancelled'}>
  <div class="when">
    <span class="time num">{cupTime(cup.startAt, $contentLang)}</span>
    <span class="tc"><span aria-hidden="true">{icon}</span> {cup.name}</span>
  </div>
  <div class="mid">
    {#if cup.status === 'running'}
      <span class="pill live">● {$t('cups.live')}</span>
      <span class="sub">{$t('cups.round', { n: cup.round, of: cup.rounds })}</span>
    {:else if cup.status === 'open'}
      <span class="sub">{cup.startAt > now ? $t('cups.startsIn', { time: countdown(cup.startAt - now) }) : $t('cups.starting')}</span>
    {:else if cup.status === 'over'}
      <span class="sub podium">
        {#each cup.podium ?? [] as p, i (i)}<span>{['🥇', '🥈', '🥉'][i]} {p.name}</span>{/each}
      </span>
    {:else if cup.status === 'skipped'}
      <span class="sub muted">{$t('cups.noEntries')}</span>
    {:else}
      <span class="sub muted">{$t('cups.calledOff')}</span>
    {/if}
    {#if cup.status === 'open' || cup.status === 'running'}
      <span class="who">👥 {$t('cups.joined', { n: cup.entries })}{#if joined} · <b class="in">✓ {$t('cups.youreIn')}</b>{/if}</span>
    {/if}
  </div>
  <div class="act">
    {#if cup.status === 'open'}
      {#if joined}
        <a class="btn primary" {href}>{$t('cups.open')}</a>
        {#if !compact}<button class="link" onclick={onleave} disabled={busy}>{$t('cups.leave')}</button>{/if}
      {:else}
        <button class="btn primary" onclick={onjoin} disabled={busy}>{$t('cups.join')}</button>
      {/if}
    {:else if cup.status === 'running'}
      {#if joined}<a class="btn primary" {href}>▶ {$t('cups.play')}</a>
      {:else if lateOk && onjoin}<button class="btn primary" onclick={onjoin} disabled={busy}>{$t('cups.joinLate')}</button>
      {:else}<a class="btn" {href}>{$t('cups.watch')}</a>{/if}
    {:else if cup.status === 'over'}
      <a class="btn ghost" {href}>{$t('cups.results')}</a>
    {/if}
    {#if admin && !compact && (cup.status === 'open' || cup.status === 'running')}
      <span class="adm">
        {#if cup.status === 'open' && cup.entries}<button class="link" onclick={onstart}>{$t('cups.startNow')}</button>{/if}
        <button class="link danger" onclick={oncancel}>{$t('cups.callOff')}</button>
      </span>
    {/if}
  </div>
</article>

<style>
  .cup {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .cup.soon {
    border-color: color-mix(in srgb, var(--gold) 70%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 14%, transparent);
  }
  .cup.live {
    border-color: color-mix(in srgb, #ef4444 60%, transparent);
    background: linear-gradient(135deg, color-mix(in srgb, #ef4444 9%, var(--card)), var(--card) 60%);
  }
  .cup.done {
    opacity: 0.8;
  }
  .when {
    display: flex;
    flex-direction: column;
    min-width: 92px;
  }
  .time {
    font: 800 20px var(--font-title);
    line-height: 1.1;
  }
  .tc {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  .mid {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .sub {
    font-weight: 700;
    font-size: 14px;
  }
  .podium {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    font-size: 13px;
  }
  .muted {
    color: var(--muted);
  }
  .who {
    font-size: 12.5px;
    color: var(--muted);
  }
  .in {
    color: var(--win);
  }
  .pill.live {
    align-self: flex-start;
    font: 800 11px var(--font-body);
    letter-spacing: 0.04em;
    color: #fff;
    background: #ef4444;
    padding: 2px 8px;
    border-radius: 999px;
    animation: blink 1.6s ease-in-out infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.6;
    }
  }
  .act {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .act .btn {
    white-space: nowrap;
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 12.5px;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }
  .link.danger {
    color: var(--loss);
  }
  .adm {
    display: flex;
    gap: 10px;
  }
  .compact {
    padding: 10px 12px;
  }
  @media (max-width: 420px) {
    .cup {
      grid-template-columns: 1fr auto;
    }
    .when {
      grid-column: 1 / -1;
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pill.live {
      animation: none;
    }
  }
</style>
