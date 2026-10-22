<script lang="ts">
  /**
   * Castle Cups on Home (owner, 2026-10-22: "show that schedule on the home page", "the top tournament game over the
   * board"): tonight's four cups as chips, the next one big with its countdown and Join, and while one is on, its
   * top board live (asked every 20 s; the server keeps the answer 10 s, so many viewers cost nothing more).
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer } from '$lib/classroom/api';
  import { t } from '$lib/i18n';
  import { contentLang } from '$lib/contentLang';
  import { track } from '$lib/analytics';
  import Board from '$lib/components/Board.svelte';
  import { lineAt } from '$lib/classroom/tasks';
  import { countdown, cupTime, joinCup, nextCup, todayCups, type Today } from './api';
  import { rememberCup } from './joined';

  const me = $derived($session.status === 'in' ? $session.uid : (devPlayer() ?? ''));
  let today = $state<Today>();
  let now = $state(Date.now());
  let offset = 0;
  let busy = $state(false);
  let error = $state('');

  async function load() {
    try {
      today = await todayCups();
      offset = today.now - Date.now();
    } catch {
      /* Home without the card */
    }
  }
  onMount(() => {
    void load();
    const tick = setInterval(() => (now = Date.now() + offset), 1000);
    const poll = setInterval(() => document.visibilityState === 'visible' && void load(), 20_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  });

  const next = $derived(nextCup(today));
  const joined = $derived(!!next && !!me && next.uids.includes(me));
  const top = $derived(next?.status === 'running' && next.top ? next.top : undefined);
  const at = $derived(top ? lineAt(top.root, top.moves, top.moves.length) : undefined);

  async function join() {
    if (!next) return;
    if (!me) return startSignIn();
    busy = true;
    error = '';
    try {
      await joinCup(next.id);
      track('feature', `cup_join_home_${next.slot}`);
      rememberCup({ id: next.id, name: next.name, startAt: next.startAt });
      if (today) today = { ...today, cups: today.cups.map((c) => (c.id === next!.id ? { ...c, uids: [...c.uids, me], entries: c.entries + 1 } : c)) };
      if (next.status === 'running') await goto(`/cups/${next.id}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

{#if today && !today.off && today.cups.length}
  <section class="cups" aria-labelledby="cups-h">
    <header class="head">
      <h2 id="cups-h"><span aria-hidden="true">🏆</span> Castle Cups <span class="newtag">{$t('nav.new')}</span></h2>
      <a class="all" href="/cups">{$t('cups.allRules')}</a>
    </header>
    <p class="tag">{$t('cups.homeLine')}</p>
    <nav class="chips" aria-label={$t('cups.todayH')}>
      {#each today.cups as c (c.id)}
        <a class="chip" class:upnext={c.id === next?.id} class:live={c.status === 'running'} class:done={c.status !== 'open' && c.status !== 'running'} href="/cups/{c.id}">
          <span class="ct num">{cupTime(c.startAt, $contentLang)}</span>
          <span class="cn">{c.speed === 'bullet' ? '⚡' : '🔥'} {c.minutes}+{c.inc}</span>
        </a>
      {/each}
    </nav>

    {#if next}
      <div class="next" class:live={next.status === 'running'}>
        <div class="info">
          {#if next.status === 'running'}
            <span class="pill">● {$t('cups.live')}</span>
            <strong class="big">{next.name}</strong>
            <span class="sub">{$t('cups.round', { n: next.round, of: next.rounds })} · 👥 {$t('cups.joined', { n: next.entries })}</span>
          {:else}
            <strong class="big">{next.name}</strong>
            <span class="countdown num">{next.startAt > now ? countdown(next.startAt - now) : '0:00'}</span>
            <span class="sub">{$t('cups.untilStart')} · 👥 {$t('cups.joined', { n: next.entries })}</span>
          {/if}
          {#if error}<span class="err">{error}</span>{/if}
          <span class="acts">
            {#if joined}
              <a class="btn primary" href="/cups/{next.id}">{next.status === 'running' ? `▶ ${$t('cups.play')}` : `✓ ${$t('cups.youreIn')} · ${$t('cups.open')}`}</a>
            {:else if next.status === 'open' || next.round < 3}
              <button class="btn primary" onclick={join} disabled={busy}>{next.status === 'open' ? $t('cups.join') : $t('cups.joinLate')}</button>
              {#if next.status === 'running'}<a class="btn ghost" href="/cups/{next.id}">{$t('cups.watch')}</a>{/if}
            {:else}
              <a class="btn" href="/cups/{next.id}">{$t('cups.watch')}</a>
            {/if}
          </span>
        </div>
        {#if top && at}
          <a class="tb" href="/cups/{next.id}" aria-label={$t('cups.topBoard')}>
            <span class="tbn">{top.blackName}</span>
            <div class="mini"><Board fen={at.fen} lastMove={at.last as never} viewOnly coordinates={false} label={$t('cups.topBoard')} /></div>
            <span class="tbn">{top.whiteName}</span>
          </a>
        {/if}
      </div>
    {:else}
      <p class="sub">{$t('cups.allDone')}</p>
    {/if}
  </section>
{/if}

<style>
  .cups {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 18px;
    background:
      radial-gradient(110% 90% at 100% 0%, color-mix(in srgb, var(--gold) 22%, transparent), transparent 60%),
      linear-gradient(135deg, color-mix(in srgb, #ef4444 10%, var(--card)), var(--card));
    border: 1px solid color-mix(in srgb, var(--gold) 35%, var(--border));
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font: 800 19px var(--font-title);
  }
  .newtag {
    font: 800 10.5px var(--font-body);
    vertical-align: middle;
    color: #1b1300;
    background: var(--gold);
    padding: 2px 7px;
    border-radius: 999px;
  }
  .all {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
  .tag {
    margin: 0;
    color: var(--muted);
    font-size: 13.5px;
  }
  .chips {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px;
    border-radius: 12px;
    background: var(--raised);
    border: 1px solid transparent;
    text-decoration: none;
    color: var(--text);
  }
  .chip.upnext {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 16%, var(--raised));
  }
  .chip.live {
    border-color: #ef4444;
  }
  .chip.done {
    opacity: 0.55;
  }
  .ct {
    font: 800 14px var(--font-title);
    white-space: nowrap;
  }
  .cn {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
  .next {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .big {
    font: 800 20px var(--font-title);
  }
  .countdown {
    font: 800 34px var(--font-title);
    line-height: 1;
    color: var(--gold);
  }
  .sub {
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
  }
  .pill {
    align-self: flex-start;
    font: 800 11px var(--font-body);
    color: #fff;
    background: #ef4444;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
  .err {
    color: var(--loss);
    font-size: 13px;
    font-weight: 700;
  }
  .tb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-decoration: none;
    color: var(--text);
    flex: none;
  }
  .mini {
    width: 150px;
  }
  .tbn {
    font-size: 11.5px;
    font-weight: 700;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 420px) {
    .mini {
      width: 120px;
    }
    .tbn {
      max-width: 120px;
    }
  }
</style>
