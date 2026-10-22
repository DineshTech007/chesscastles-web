<script lang="ts">
  /**
   * Who is in the class: online or not, hands up (first raised first), microphone and who is speaking. The coach can
   * let a student speak, mute them, lower a hand, hand them the big board, or send a 👏.
   */
  import type { Live } from './live.svelte';

  let { live }: { live: Live } = $props();
  const list = $derived(
    [...live.people].sort((a, b) => Number(b.coach) - Number(a.coach) || (a.hand && b.hand ? a.hand - b.hand : Number(!!b.hand) - Number(!!a.hand)) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
  );
  const online = $derived(live.people.filter((p) => p.online && !p.coach).length);
  const students = $derived(live.people.filter((p) => !p.coach).length);
</script>

<div class="people">
  <p class="count muted">{online} of {students} students here</p>
  {#each list as p (p.uid)}
    {@const speaking = (live.levels[p.uid] ?? 0) > 0.12}
    <div class="person" class:off={!p.online} class:speaking>
      <span class="dot" class:on={p.online}></span>
      <span class="name">{p.name}{p.coach ? ' · Coach' : ''}{p.uid === live.me.uid ? ' (you)' : ''}</span>
      {#if p.hand}<span class="hand" title="Hand raised">✋</span>{/if}
      {#if live.holder === p.uid}<span class="pill gold" title="Has the big board">♟ Board</span>{/if}
      {#if p.voice}<span class="mic" title={p.mic ? 'Microphone on' : 'Microphone off'}>{p.mic ? '🎙️' : '🔇'}</span>{/if}
      {#if p.cam}<span title="Camera on">📷</span>{/if}
      {#if live.coach && !live.watching && !p.coach && p.online}
        <span class="acts">
          {#if p.hand}<button class="mini" onclick={() => live.lower(p.uid)} title="Lower the hand">Lower</button>{/if}
          {#if !live.settings.talk}
            <button class="mini" class:on={p.allow} onclick={() => live.allow(p.uid, !p.allow)} title={p.allow ? 'Stop this student speaking' : 'Let this student speak'}>{p.allow ? 'Stop' : 'Speak'}</button>
          {/if}
          {#if p.mic}<button class="mini" onclick={() => live.mute(p.uid)}>Mute</button>{/if}
          <button class="mini" class:on={live.holder === p.uid} onclick={() => live.give(live.holder === p.uid ? '' : p.uid)} title="This student moves on the big board">{live.holder === p.uid ? 'Take board' : 'Give board'}</button>
          <button class="mini" onclick={() => live.react('👏', 'Well done', p.uid)} title="Clap for this student">👏</button>
        </span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .people {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .count {
    margin: 0 0 4px;
    font-size: 13px;
  }
  .muted {
    color: var(--muted);
  }
  .person {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--raised);
    flex-wrap: wrap;
    border: 1px solid transparent;
  }
  .person.off {
    opacity: 0.55;
  }
  .person.speaking {
    border-color: var(--win);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--win) 35%, transparent);
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--muted);
    flex: none;
  }
  .dot.on {
    background: var(--win);
  }
  .name {
    font-weight: 600;
    flex: 1;
    min-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hand {
    animation: wave 1s ease-in-out infinite;
  }
  @keyframes wave {
    50% {
      transform: rotate(14deg);
    }
  }
  .acts {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .mini {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    border-radius: 8px;
    padding: 2px 7px;
    font: 600 12px var(--font-body);
    cursor: pointer;
  }
  .mini.on {
    border-color: var(--gold);
    color: var(--gold);
  }
</style>
