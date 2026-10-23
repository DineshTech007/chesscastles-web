<script lang="ts">
  /**
   * Rewards: the player's Treasury at a glance (src/lib/economy): level and rank, the daily reward and streak (with
   * its milestones and Streak Shields), today's quests, how every coin is earned, and what came in lately.
   */
  import { t, type Key } from '$lib/i18n';
  import { startSignIn } from '$lib/auth';
  import Icon from '$lib/components/Icon.svelte';
  import Coin from '$lib/economy/Coin.svelte';
  import Gem from '$lib/economy/Gem.svelte';
  import QuestList from '$lib/economy/QuestList.svelte';
  import { EARN, ITEM, LADDER, MILESTONES, RANKS, canClaim, ladderDay, levelOf, liveStreak, rankOf, xpFor, type EarnKind } from '$lib/economy/core';
  import { today, wallet, walletMode } from '$lib/economy/wallet';
  import { dailyOpen, fmt } from '$lib/economy/ui';
  import { formatDate } from '$lib/format';

  const day = today();
  const level = $derived(levelOf($wallet.xp));
  const from = $derived(xpFor(level));
  const to = $derived(xpFor(level + 1));
  const pct = $derived(Math.min(100, ((($wallet.xp - from) / (to - from)) * 100) || 0));
  const nextRank = $derived(RANKS.find((r) => r.level > level));
  const can = $derived(canClaim($wallet, day));
  const streak = $derived(can ? liveStreak($wallet, day) : $wallet.login.streak);
  const ORDER: EarnKind[] = ['win', 'winOnline', 'draw', 'loss', 'puzzleClean', 'puzzle', 'daily', 'vision', 'line', 'lesson', 'review', 'rush', 'race', 'raceWin', 'award', 'cup', 'cupPodium', 'cupWin'];
  const when = (at: number) => (Date.now() - at < 86_400_000 ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : formatDate(at));
  const whyLabel = (why: string, item?: string) => (why === 'buy' || why === 'unlock' ? `${$t(`eco.why.${why}` as Key)}: ${item ? ITEM[item]?.name : ''}` : why === 'quest' && item ? `${$t('eco.why.quest')}: ${$t(`eco.q.${item}` as Key)}` : $t(`eco.why.${why}` as Key));
</script>

<svelte:head><title>{$t('eco.rewards')} · Chess Castles</title></svelte:head>

<div class="rw">
  <header class="top">
    <div class="lvl-card">
      <div class="shield" aria-hidden="true"><span>{level}</span></div>
      <div class="lvl-text">
        <span class="kicker">{$t('eco.rewards')}</span>
        <h1 class="display">{$t('eco.level', { n: level })} · {rankOf(level)}</h1>
        <div class="xp" role="progressbar" aria-valuemin={from} aria-valuemax={to} aria-valuenow={$wallet.xp}><span style="width: {pct}%"></span></div>
        <p class="label">{$t('eco.xpTo', { n: fmt.format(to - $wallet.xp), next: level + 1 })}{#if nextRank} · {$t('eco.nextRank', { rank: nextRank.name, n: nextRank.level })}{/if}</p>
      </div>
      <div class="bal">
        <a href="/shop" class="b g"><Coin size={30} /><span class="num">{fmt.format($wallet.gold)}</span><span class="label">{$t('eco.gold')}</span></a>
        <a href="/shop" class="b m"><Gem size={28} /><span class="num">{fmt.format($wallet.gems)}</span><span class="label">{$t('eco.gems')}</span></a>
      </div>
    </div>
    {#if $walletMode === 'guest'}
      <p class="note"><Icon name="lock" size={15} />{$t('eco.guest')} <button class="linkish" onclick={() => startSignIn()}>{$t('shell.signin')}</button></p>
    {:else if $walletMode === 'local'}
      <p class="note"><Icon name="history" size={15} />{$t('eco.local')}</p>
    {/if}
  </header>

  <div class="cols">
    <div class="col">
      <section class="card daily" aria-labelledby="d-h">
        <div class="h-row">
          <h2 id="d-h" class="title">🎁 {$t('eco.daily.h')}</h2>
          <span class="streak" class:off={!streak}>🔥 {streak ? $t('eco.streak', { n: streak }) : $t('eco.streak0')}</span>
        </div>
        <ol class="strip">
          {#each LADDER as step, i (i)}
            {@const at = ladderDay($wallet)}
            {@const done = i < at || (!can && at === 0 && $wallet.login.total > 0)}
            <li class:now={can && i === at} class:done class:big={i === LADDER.length - 1}>
              <span class="d">{i + 1}</span>
              <span class="r"><Coin size={13} />{step.gold}{#if step.gems}<Gem size={12} />{step.gems}{/if}</span>
            </li>
          {/each}
        </ol>
        {#if can}
          <button class="btn primary big block" onclick={() => dailyOpen.set(true)}>{$t('eco.daily.claim')} 🎁</button>
        {:else}
          <p class="label">{$t('eco.daily.claimed', { n: ladderDay($wallet) + 1 })}</p>
        {/if}
        <div class="mile">
          <h3>{$t('eco.milestones')}</h3>
          <ol>
            {#each MILESTONES as m (m.days)}
              {@const got = $wallet.milestones.includes(m.days)}
              <li class:got>
                <span class="md">{m.days}</span>
                <span class="mr"><Gem size={13} />{m.gems}{#if m.item} · {ITEM[m.item].name}{/if}</span>
                {#if got}<Icon name="check" size={14} />{/if}
              </li>
            {/each}
          </ol>
          <p class="label">{$t('eco.best', { n: $wallet.login.best })} · 🛡️ {$t('eco.shields', { n: $wallet.shields, max: 2 })} · <a href="/shop?tab=shield">{$t('eco.getShield')}</a></p>
        </div>
      </section>

      <section class="card" aria-labelledby="q-h">
        <h2 id="q-h" class="title">📜 {$t('eco.quests.h')}</h2>
        <p class="label sub">{$t('eco.quests.sub')}</p>
        <QuestList />
      </section>
    </div>

    <div class="col">
      <section class="card" aria-labelledby="e-h">
        <h2 id="e-h" class="title">💰 {$t('eco.earn.h')}</h2>
        <p class="label sub">{$t('eco.kind')}</p>
        <table class="earn">
          <tbody>
            {#each ORDER as k (k)}
              {@const r = EARN[k]}
              <tr>
                <td>{$t(`eco.why.${k}` as Key)}</td>
                <td class="amt"><Coin size={14} />{r.gold}{#if k === 'rush'}+{/if}{#if 'gems' in r} <Gem size={13} />{r.gems}{/if}</td>
                <td class="cap label">{$t('eco.perDay', { n: r.cap })}</td>
              </tr>
            {/each}
            <tr><td>{$t('eco.why.login')}</td><td class="amt"><Coin size={14} />25–150 <Gem size={13} />0–5</td><td class="cap label">{$t('eco.perDay', { n: 1 })}</td></tr>
            <tr><td>{$t('eco.why.level')}</td><td class="amt"><Gem size={13} />3–10</td><td class="cap label"></td></tr>
          </tbody>
        </table>
      </section>

      <section class="card" aria-labelledby="l-h">
        <h2 id="l-h" class="title">🏰 {$t('eco.levels')}</h2>
        <ol class="ranks">
          {#each RANKS as r (r.level)}
            <li class:me={rankOf(level) === r.name} class:past={level >= r.level}>
              <span class="rl">{r.level}</span><span class="rn">{r.name}</span><span class="rx label">{fmt.format(xpFor(r.level))} XP</span>
            </li>
          {/each}
        </ol>
      </section>

      <section class="card" aria-labelledby="h-h">
        <h2 id="h-h" class="title">🧾 {$t('eco.history')}</h2>
        {#if $wallet.log.length}
          <ul class="log">
            {#each $wallet.log.slice(0, 20) as e, i (i)}
              <li>
                <span class="lw">{whyLabel(e.why, e.item)}</span>
                <span class="la">
                  {#if e.gold}<span class:neg={e.gold < 0}><Coin size={13} />{e.gold > 0 ? '+' : ''}{fmt.format(e.gold)}</span>{/if}
                  {#if e.gems}<span class:neg={e.gems < 0}><Gem size={12} />{e.gems > 0 ? '+' : ''}{e.gems}</span>{/if}
                </span>
                <span class="lt label">{when(e.at)}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="label">{$t('eco.noHistory')}</p>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .rw {
    max-width: 1140px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .lvl-card {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 22px;
    align-items: center;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
    background:
      radial-gradient(60% 120% at 100% 0%, rgba(237, 176, 64, 0.22), transparent 60%),
      linear-gradient(150deg, #1d2f63, #111c36 70%);
    color: #eef3ff;
    overflow: hidden;
  }
  :global(:root[data-theme='light']) .lvl-card {
    background: linear-gradient(150deg, #fff7e3, #fff 70%);
    color: var(--text);
  }
  .shield {
    width: 92px;
    height: 104px;
    display: grid;
    place-items: center;
    clip-path: polygon(50% 0, 100% 14%, 100% 58%, 50% 100%, 0 58%, 0 14%);
    background: linear-gradient(180deg, #f7d27a, #c98a1b);
    filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.35));
  }
  .shield span {
    display: grid;
    place-items: center;
    width: 80px;
    height: 92px;
    clip-path: polygon(50% 0, 100% 14%, 100% 58%, 50% 100%, 0 58%, 0 14%);
    background: linear-gradient(180deg, #2b4da8, #142559);
    color: #fff;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 44px;
    padding-bottom: 8px;
  }
  .lvl-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .kicker {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .lvl-text h1 {
    font-size: clamp(30px, 4vw, 44px);
  }
  .xp {
    height: 12px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.35);
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  :global(:root[data-theme='light']) .xp {
    background: #eadfca;
  }
  .xp span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f7d27a, #edb040, #ffe7a3);
    box-shadow: 0 0 12px rgba(237, 176, 64, 0.6);
  }
  .bal {
    display: flex;
    gap: 12px;
  }
  .b {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 104px;
    padding: 14px 12px;
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-decoration: none;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 28px;
  }
  :global(:root[data-theme='light']) .b {
    background: var(--raised);
    border-color: var(--border);
  }
  .b:hover {
    text-decoration: none;
    border-color: var(--gold);
  }
  .g {
    color: #ffd76a;
  }
  .m {
    color: #8fe6f5;
  }
  :global(:root[data-theme='light']) .g {
    color: #8a5a12;
  }
  :global(:root[data-theme='light']) .m {
    color: #0e6b85;
  }
  .b .label {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 700;
  }
  .note {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 10px 0 0;
    font-size: 14px;
    color: var(--text-2);
  }
  .linkish {
    border: 0;
    background: none;
    padding: 0;
    color: var(--gold);
    font-weight: 800;
    cursor: pointer;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-width: 0;
  }
  .card h2 {
    font-size: 21px;
    margin-bottom: 10px;
  }
  .sub {
    margin: -4px 0 12px;
  }
  .h-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }
  .h-row h2 {
    margin: 0;
  }
  .streak {
    padding: 5px 12px;
    border-radius: 999px;
    background: color-mix(in srgb, #f97316 20%, transparent);
    color: #fdba74;
    font-weight: 800;
    font-size: 14px;
  }
  :global(:root[data-theme='light']) .streak {
    color: #c2410c;
  }
  .streak.off {
    background: var(--raised);
    color: var(--muted);
  }
  .strip {
    list-style: none;
    margin: 0 0 14px;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .strip li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 2px;
    border-radius: 12px;
    background: var(--raised);
    border: 1px solid var(--border-soft);
  }
  .strip li.big {
    background: color-mix(in srgb, var(--gold) 16%, var(--raised));
    border-color: color-mix(in srgb, var(--gold) 50%, var(--border));
  }
  .strip li.now {
    border: 2px solid var(--gold);
  }
  .strip li.done {
    opacity: 0.5;
  }
  .d {
    font-weight: 800;
    font-size: 13px;
    color: var(--muted);
  }
  .r {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 2px;
    font-weight: 800;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .mile {
    margin-top: 16px;
  }
  .mile h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .mile ol {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .mile li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--raised);
    font-size: 14px;
  }
  .mile li.got {
    background: color-mix(in srgb, var(--win) 14%, var(--raised));
    color: var(--win);
  }
  .md {
    min-width: 46px;
    font-weight: 800;
  }
  .md::after {
    content: ' 🔥';
  }
  .mr {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-2);
  }
  .earn {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .earn td {
    padding: 7px 4px;
    border-top: 1px solid var(--border-soft);
  }
  .amt {
    white-space: nowrap;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .amt :global(svg) {
    margin-right: 3px;
  }
  .cap {
    text-align: right;
    font-size: 12.5px;
  }
  .ranks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .ranks li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 10px;
    background: var(--raised);
    opacity: 0.6;
  }
  .ranks li.past {
    opacity: 1;
  }
  .ranks li.me {
    outline: 2px solid var(--gold);
  }
  .rl {
    min-width: 26px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    background: #1e3a8a;
    color: #fff;
    font-weight: 800;
    font-size: 12.5px;
  }
  .rn {
    flex: 1;
    font-weight: 700;
  }
  .rx {
    font-size: 11.5px;
  }
  .log {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .log li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 2px;
    border-top: 1px solid var(--border-soft);
    font-size: 14px;
  }
  .lw {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .la {
    display: flex;
    gap: 8px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--win);
  }
  .la span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .la .neg {
    color: var(--muted);
  }
  .lt {
    font-size: 12px;
    min-width: 62px;
    text-align: right;
  }
  @media (max-width: 900px) {
    .cols {
      grid-template-columns: 1fr;
    }
    .lvl-card {
      grid-template-columns: auto minmax(0, 1fr);
      padding: 18px;
      gap: 16px;
    }
    .bal {
      grid-column: 1 / -1;
    }
    .b {
      flex: 1;
    }
    .shield {
      width: 70px;
      height: 80px;
    }
    .shield span {
      width: 60px;
      height: 70px;
      font-size: 32px;
    }
  }
</style>
