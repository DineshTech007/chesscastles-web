<script lang="ts">
  /**
   * A challenge from another player, on any page: who, their rating, the time control, rated or casual and your
   * colour, with Accept and Decline. Accepting opens the game at once (its clocks start as on Lichess); the
   * player who challenged is taken to it too. More than one challenge: the newest first, with how many wait.
   */
  import { goto } from '$app/navigation';
  import { lichessToken } from '$lib/auth';
  import { acceptChallenge, declineChallenge } from '$lib/lichessBoard';
  import { incomingChallenges, openWhenStarted, type IncomingChallenge } from '$lib/lichessEvents';
  import { answerInvite, markAnswered } from '$lib/invites';
  import { sounds } from '$lib/sound';
  import { track } from '$lib/analytics';
  import Icon from './Icon.svelte';

  let busy = $state('');
  let error = $state('');
  const shown = $derived($incomingChallenges.at(-1));
  const more = $derived($incomingChallenges.length - 1);

  // A new challenge: a sound, and the tab title says so until it is answered.
  let lastId = '';
  let baseTitle = '';
  $effect(() => {
    const c = shown;
    if (typeof document === 'undefined') return;
    if (c && c.id !== lastId) {
      lastId = c.id;
      sounds.start();
      if (!baseTitle) baseTitle = document.title;
    }
    if (!c && baseTitle) {
      document.title = baseTitle;
      baseTitle = '';
      return;
    }
    if (!c) return;
    let on = false;
    const t = setInterval(() => {
      on = !on;
      document.title = on ? `⚔️ ${c.from} challenges you!` : baseTitle;
    }, 1200);
    return () => clearInterval(t);
  });

  const colourText = (c: IncomingChallenge) => (c.myColor === 'white' ? 'You play White' : c.myColor === 'black' ? 'You play Black' : 'Colour by chance');

  async function accept(c: IncomingChallenge) {
    // A Puzzle Battle: no Lichess game, straight into the race on Chess Castles.
    if (c.cc?.battle) {
      markAnswered(c.id);
      void answerInvite(c.id, 'accepted');
      track('feature', 'battle_accept');
      incomingChallenges.update((l) => l.filter((x) => x.id !== c.id));
      return void goto(`/puzzles/racer/${c.id}`);
    }
    const t = lichessToken()?.token;
    if (!t) return;
    // A Chess Castles invite (invites.ts): answered on Chess Castles too. Bullet: its game on lichess.org, opened
    // from this tap (Lichess plays bullet only there).
    if (c.cc) {
      markAnswered(c.id);
      void answerInvite(c.id, 'accepted');
      if (c.cc.join) {
        window.open(c.cc.join, '_blank', 'noopener');
        track('feature', 'invite_accept_bullet');
        incomingChallenges.update((l) => l.filter((x) => x.id !== c.id));
        return;
      }
    }
    busy = c.id;
    error = '';
    try {
      openWhenStarted(c.id);
      await acceptChallenge(t, c.id);
      track('feature', 'challenge_accept');
      incomingChallenges.update((l) => l.filter((x) => x.id !== c.id));
      // On Lichess the game has the challenge's id: open it now, the clocks start there.
      await goto(`/play/online/${c.id}${c.myColor ? `?c=${c.myColor}` : ''}`);
    } catch (e) {
      error = c.cc ? `${c.from} took the invite back, or it ran out. Invite them yourself from Online now!` : e instanceof Error ? e.message : 'The challenge could not be accepted.';
      incomingChallenges.update((l) => l.filter((x) => x.id !== c.id));
    } finally {
      busy = '';
    }
  }
  async function decline(c: IncomingChallenge) {
    const t = lichessToken()?.token;
    incomingChallenges.update((l) => l.filter((x) => x.id !== c.id));
    track('feature', 'challenge_decline');
    if (c.cc) {
      markAnswered(c.id);
      return void answerInvite(c.id, 'declined');
    }
    if (t) await declineChallenge(t, c.id).catch(() => {});
  }
</script>

{#if shown}
  <div class="cp" role="alertdialog" aria-labelledby="cp-h" aria-describedby="cp-d">
    <div class="glow" aria-hidden="true"></div>
    <div class="top">
      <span class="sword" aria-hidden="true">⚔️</span>
      <div class="who">
        <h2 id="cp-h" class="title">{#if shown.fromTitle}<span class="ttl">{shown.fromTitle}</span> {/if}{shown.from}{#if shown.fromRating}{' '}<span class="rt num">({shown.fromRating})</span>{/if}</h2>
        <p id="cp-d" class="label">{shown.cc?.battle ? 'challenges you to a Puzzle Battle 🏁' : 'challenges you to a game'}</p>
      </div>
      {#if more > 0}<span class="more">+{more}</span>{/if}
    </div>
    <div class="facts">
      {#if shown.cc?.battle}
        <span class="fact">🧩 Same puzzles, who solves more</span>
        <span class="fact">You and {shown.from}</span>
      {:else}
        <span class="fact"><Icon name="history" size={15} />{shown.minutes}+{shown.increment}</span>
        <span class="fact">{shown.rated ? 'Rated' : 'Casual'}</span>
        <span class="fact">{colourText(shown)}</span>
        {#if shown.cc?.join}<span class="fact">Bullet · opens Lichess</span>{/if}
      {/if}
    </div>
    <div class="btns">
      <button class="btn primary big" disabled={busy === shown.id} onclick={() => accept(shown)}><Icon name="check" size={18} />{busy === shown.id ? 'Starting…' : 'Accept'}</button>
      <button class="btn" disabled={busy === shown.id} onclick={() => decline(shown)}>Decline</button>
    </div>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .cp {
    position: fixed;
    z-index: 99;
    left: 50%;
    top: 16px;
    transform: translateX(-50%);
    width: min(420px, calc(100vw - 20px));
    padding: 14px 16px 16px;
    border-radius: 18px;
    border: 2px solid var(--gold);
    background: var(--card);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: hidden;
    animation: drop 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  @keyframes drop {
    from {
      transform: translate(-50%, -30px);
      opacity: 0;
    }
  }
  .glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--gold) 22%, transparent), transparent 60%);
    pointer-events: none;
  }
  .top {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sword {
    font-size: 30px;
    animation: shake 1.2s ease-in-out infinite;
  }
  @keyframes shake {
    0%,
    100% {
      transform: rotate(0);
    }
    10%,
    30% {
      transform: rotate(-12deg);
    }
    20%,
    40% {
      transform: rotate(12deg);
    }
    50% {
      transform: rotate(0);
    }
  }
  .who {
    flex: 1;
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: 19px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ttl {
    color: var(--gold);
  }
  .rt {
    color: var(--text-2);
    font-weight: 600;
  }
  .who p {
    margin: 0;
  }
  .more {
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--loss);
    color: #fff;
    font-weight: 800;
    font-size: 13px;
  }
  .facts {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .fact {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--raised);
    font-weight: 700;
    font-size: 13.5px;
  }
  .btns {
    position: relative;
    display: flex;
    gap: 8px;
  }
  .btns .big {
    flex: 1;
  }
  .err {
    position: relative;
    margin: 0;
    color: var(--loss);
    font-size: 13px;
  }
  @media (max-width: 767px) {
    .cp {
      top: auto;
      bottom: 84px;
    }
    @keyframes drop {
      from {
        transform: translate(-50%, 30px);
        opacity: 0;
      }
    }
  }
</style>
