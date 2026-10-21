<script lang="ts">
  /**
   * The home page's Guru card: the player's own games, analysed. With a report on this device (Insights): their
   * numbers, what costs them the most points, their strong point, and the way to train it. Without one: Guru offers
   * to analyse their last games (a Lichess login fills in the name), free, on this device; Insights starts at once.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from './Icon.svelte';
  import { lichessToken } from '$lib/auth';
  import { formatDate } from '$lib/format';
  import { t } from '$lib/i18n';
  import { buildReport } from '$lib/insights/report';
  import { loadInsights, type InsightsData } from '$lib/insights/store';

  const GAMES = 20;
  let data = $state<InsightsData | undefined>();
  /** The Lichess account signed in with (or connected), whose games Guru can fetch. */
  let lichess = $state<string | undefined>();
  let site = $state<'chesscom' | 'lichess'>('chesscom');
  let user = $state('');
  onMount(() => {
    data = loadInsights();
    lichess = lichessToken()?.username;
  });

  const report = $derived(data?.games.length ? buildReport(data.games) : undefined);
  const siteName = (s: string) => (s === 'chesscom' ? 'chess.com' : 'Lichess');
  /** A report older than three days: newer games are worth a look (only new games are analysed). */
  const stale = $derived(!!data && Date.now() - data.at > 3 * 86_400_000);
  const analyse = (s: string, u: string) => `/insights?site=${s}&user=${encodeURIComponent(u)}&auto=1`;
</script>

<section class="card ins" aria-labelledby="ins-h">
  <h2 id="ins-h" class="title"><span class="ic"><Icon name="bulb" size={18} color="var(--on-action)" /></span>{report ? $t('home.ins.h') : $t('home.ins.offer')}</h2>
  {#if report && data}
    <p class="label">{$t('home.ins.sub', { games: report.games, user: data.username, site: siteName(data.site), when: formatDate(data.at) })}</p>
    <div class="stats">
      <span><strong class="num">{Math.round(report.score * 100)}%</strong><span class="label">{$t('home.ins.score')}</span></span>
      <span><strong class="num">{Math.round(report.accuracy)}%</strong><span class="label">{$t('home.ins.accuracy')}</span></span>
      <span><strong class="num">{report.blundersPerGame.toFixed(1)}</strong><span class="label">{$t('home.ins.blunders')}</span></span>
    </div>
    {#if report.weaknesses.length}
      <h3 class="label sub-h">{$t('home.ins.costs')}</h3>
      <ol class="weak">
        {#each report.weaknesses.slice(0, 2) as w (w.title)}
          <li><strong>{w.title}</strong><span class="label">{w.evidence}</span></li>
        {/each}
      </ol>
    {/if}
    {#if report.strengths[0]}<p class="strong"><Icon name="check" size={16} color="var(--win)" /><span><strong>{$t('home.ins.strong')}:</strong> {report.strengths[0]}</span></p>{/if}
    <div class="actions">
      <a class="btn primary" href="/insights">{$t('home.ins.all')}</a>
      <a class="btn" href="/insights/mistakes">{$t('home.ins.train')}</a>
      {#if stale}<a class="btn" href={analyse(data.site, data.username)}>{$t('home.ins.again')}</a>{/if}
    </div>
  {:else if lichess}
    <p>{$t('home.ins.offer.lichess', { n: GAMES, user: lichess })}</p>
    <a class="btn primary go" href={analyse('lichess', lichess)}>{$t('home.ins.go')}</a>
  {:else}
    <p>{$t('home.ins.offer.any', { n: GAMES })}</p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        if (user.trim()) void goto(analyse(site, user.trim()));
      }}
    >
      <select bind:value={site} aria-label="Site"><option value="chesscom">chess.com</option><option value="lichess">Lichess</option></select>
      <input bind:value={user} placeholder={$t('home.ins.username')} aria-label={$t('home.ins.username')} autocomplete="off" required />
      <button class="btn primary">{$t('home.ins.go')}</button>
    </form>
  {/if}
</section>

<style>
  .ins {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
    background:
      radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%),
      var(--card);
  }
  h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ic {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: var(--accent);
    flex: none;
  }
  p {
    margin: 0;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .stats > span {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--raised);
  }
  .stats strong {
    font-size: 22px;
  }
  .sub-h {
    margin: 4px 0 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 800;
    font-size: 11px;
  }
  .weak {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .weak li {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .strong {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .go {
    align-self: flex-start;
  }
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  select,
  input {
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 10px;
    font: inherit;
  }
  input {
    flex: 1;
    min-width: 140px;
  }
</style>
