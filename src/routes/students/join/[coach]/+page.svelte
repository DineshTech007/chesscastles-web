<script lang="ts">
  /** A coach's invite link: the student sees who it is and what the coach will see, then agrees. */
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { session, startSignIn } from '$lib/auth';
  import { getPlayer, type Player } from '$lib/social';
  import { joinCoach } from '$lib/students';

  const coachUid = decodeURIComponent(page.params.coach!);
  let coach = $state<Player | undefined>();
  let error = $state('');
  let busy = $state(false);
  $effect(() => {
    if ($session.status !== 'in') return;
    getPlayer(coachUid).then(
      (r) => (coach = r.player),
      () => (error = 'This coach link is not valid.'),
    );
  });
  async function join() {
    busy = true;
    try {
      await joinCoach(coachUid);
      goto('/?coach=joined');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not join.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Join your coach · Chess Castles</title></svelte:head>

<div class="card box">
  <h1 class="title">Join your coach</h1>
  {#if $session.status !== 'in'}
    <p>Sign in to join your coach on Chess Castles.</p>
    <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
  {:else if error}
    <p class="error">{error}</p>
    <a class="btn" href="/">Home</a>
  {:else if !coach}
    <p class="label">Loading…</p>
  {:else if coachUid === $session.uid}
    <p>This is your own coach link. Share it with your students.</p>
    <a class="btn" href="/students">My students</a>
  {:else}
    <p><strong>{coach.name}</strong> (@{coach.username}) wants to be your coach.</p>
    <ul>
      <li>They will see your CC Rating, your games on Chess Castles and your study this week.</li>
      <li>They can set you puzzles, openings and lessons.</li>
      <li>They can’t message you unless you are friends, and you can leave at any time from your profile.</li>
    </ul>
    <div class="btns">
      <button class="btn primary" disabled={busy} onclick={join}>Join {coach.name}</button>
      <a class="btn" href="/">No thanks</a>
    </div>
  {/if}
</div>

<style>
  .box {
    max-width: 520px;
    margin: 40px auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 22px;
  }
  p {
    margin: 0;
  }
  ul {
    margin: 0;
    padding-left: 20px;
    color: var(--text-2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .error {
    color: var(--loss);
  }
</style>
