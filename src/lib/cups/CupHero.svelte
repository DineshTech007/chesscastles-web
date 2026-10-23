<script lang="ts">
  /**
   * The top of a Castle Cup's page (owner, 2026-10-23: "show something nice about Castle Cups at the top, and a tournament
   * description"): the castle, the cup's name and its facts (time control, rounds, players), a line on what a Castle Cup
   * is, and "How it works" (opened before the start, folded away while a cup is on, so the board stays in view).
   */
  import { t } from '$lib/i18n';

  let { name, status, rounds = 0, players = 0, open = false }: { name: string; status: string; rounds?: number; players?: number; open?: boolean } = $props();
</script>

<section class="hero" class:running={status === 'running'}>
  <img class="crest" src="/brand/chesscastles-crest-dark.svg" alt="" width="54" height="61" />
  <div class="txt">
    <span class="kick">🏰 {$t('cux.tag')}</span>
    {#if status !== 'running'}<h2 class="display">{name}</h2>{/if}
    <div class="facts">
      {#if rounds > 0}<span>♟ {$t('cux.rounds', { n: rounds })}</span>{/if}
      {#if players > 0}<span>👥 {$t('cux.players', { n: players })}</span>{/if}
      <span>🥇🥈🥉 {$t('cux.podiumOnly')}</span>
    </div>
    <p class="lead">{$t('cux.lead')}</p>
    <details {open}>
      <summary>{$t('cux.how')}</summary>
      <ul>
        <li>{$t('cux.how1')}</li>
        <li>{$t('cux.how2')}</li>
        <li>{$t('cux.how3')}</li>
        <li>{$t('cux.how4')}</li>
      </ul>
    </details>
  </div>
</section>

<style>
  .hero {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 14px 16px;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
    background:
      radial-gradient(80% 140% at 0% 0%, color-mix(in srgb, var(--gold) 22%, transparent), transparent 65%),
      radial-gradient(70% 120% at 100% 100%, rgba(124, 92, 240, 0.18), transparent 65%),
      var(--card);
  }
  .crest {
    flex: none;
    filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.4));
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .kick {
    font: 800 12px var(--font-body);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
  }
  h2 {
    margin: 0;
    font-size: 26px;
    line-height: 1.1;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
  }
  .lead {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--text-2);
  }
  details {
    margin-top: 4px;
  }
  summary {
    cursor: pointer;
    font-weight: 800;
    font-size: 13.5px;
    color: var(--gold);
  }
  ul {
    margin: 6px 0 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 13.5px;
    color: var(--text-2);
  }
  /* While a cup is on the board matters most: a thin banner, the explanation folded away. */
  .running {
    padding: 8px 12px;
    align-items: center;
  }
  .running .lead,
  .running details {
    display: none;
  }
  .running .crest {
    width: 30px;
    height: auto;
  }
  @media (max-width: 480px) {
    .crest {
      width: 40px;
      height: auto;
    }
    h2 {
      font-size: 22px;
    }
  }
</style>
