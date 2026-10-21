<script lang="ts">
  /**
   * The home page for visitors (owner's request, 2026-10-21: a playing portal, not a list of features): what
   * Chess Castles is in one line, a game in one tap (the same Play card as signed-in players), sign in, then four
   * pictures of what they get, kind words from coaches, and a word for parents. The full tour is /features.
   */
  import Icon from '$lib/components/Icon.svelte';
  import KindWordsStrip from '$lib/components/KindWordsStrip.svelte';
  import MadeInIndia from '$lib/components/MadeInIndia.svelte';
  import PlayCard from './PlayCard.svelte';
  import { startSignIn } from '$lib/auth';
  import { betaOn } from '$lib/beta';
  import { t, type Key } from '$lib/i18n';

  const FEATURES: { art: string; h: Key; b: Key; href: string }[] = [
    { art: '/art/play-256.webp', h: 'home.land.f.play.h', b: 'home.land.f.play.b', href: '/play' },
    { art: '/art/puzzles-256.webp', h: 'home.land.f.puz.h', b: 'home.land.f.puz.b', href: '/puzzles' },
    { art: '/art/learn-256.webp', h: 'home.land.f.learn.h', b: 'home.land.f.learn.b', href: '/learn' },
    { art: '/art/friends-256.webp', h: 'home.land.f.friends.h', b: 'home.land.f.friends.b', href: '/friends' },
  ];
</script>

<div class="landing">
  <MadeInIndia compact />
  <header class="hero">
    <h1 class="display">{$t('home.land.h1')}</h1>
    <p class="sub">{$t('home.land.sub')}</p>
  </header>

  <PlayCard />

  <div class="signin card">
    <p>{$t('home.land.signin.why')}{#if betaOn()}{' '}<strong>{$t('home.land.free')}</strong>{/if}</p>
    <button class="btn primary" onclick={() => startSignIn()}>{$t('home.land.signin')}</button>
  </div>

  <section class="why" aria-labelledby="why-h">
    <h2 id="why-h" class="sec-h">{$t('home.land.why')}</h2>
    <div class="feats">
      {#each FEATURES as f (f.href)}
        <a class="feat" href={f.href}>
          <img src={f.art} alt="" width="120" height="120" loading="lazy" />
          <span class="ft">
            <strong>{$t(f.h)}</strong>
            <span>{$t(f.b)}</span>
          </span>
        </a>
      {/each}
    </div>
    <a class="tour" href="/features">{$t('home.land.features')}<Icon name="chevron" size={16} /></a>
  </section>

  <KindWordsStrip />

  <section class="parents card" aria-labelledby="par-h">
    <h2 id="par-h" class="sec-h">{$t('home.land.parents.h')}</h2>
    <p>{$t('home.land.parents.b')}</p>
    <a class="btn par-more" href="/parents">{$t('home.land.parents.more')}</a>
  </section>
</div>

<style>
  .landing {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .hero {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: -8px;
  }
  .hero h1 {
    margin: 0;
    font-size: 40px;
    line-height: 1.05;
  }
  .sub {
    margin: 0;
    font-size: 16.5px;
    color: var(--text-2);
  }
  .signin {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
  }
  .signin p {
    flex: 1;
    margin: 0;
    font-size: 14.5px;
    color: var(--text-2);
  }
  .signin strong {
    color: var(--gold);
  }
  .signin .btn {
    flex: none;
  }
  .why {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .feats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .feat {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background:
      radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, var(--gold) 14%, transparent), transparent 70%),
      var(--card);
    color: var(--text);
    text-decoration: none;
  }
  .feat:hover {
    border-color: var(--gold);
    text-decoration: none;
  }
  .feat img {
    width: 88px;
    height: 88px;
    object-fit: contain;
    filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35));
  }
  .ft {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ft strong {
    font-family: var(--font-title);
    font-size: 17px;
    line-height: 1.2;
  }
  .ft span {
    font-size: 13.5px;
    color: var(--text-2);
    line-height: 1.4;
  }
  .tour {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: center;
    font-weight: 700;
    color: var(--gold);
  }
  .parents {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .parents p {
    margin: 0;
    color: var(--text-2);
  }
  .par-more {
    align-self: flex-start;
  }
  @media (max-width: 480px) {
    .hero h1 {
      font-size: 34px;
    }
    .signin {
      flex-direction: column;
      align-items: stretch;
      text-align: center;
    }
  }
  @media (min-width: 900px) {
    .feats {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>
