<script lang="ts">
  /**
   * Chat in an online game between two Chess Castles players (src/lib/chat/room.svelte.ts), read by Castle Guard.
   * `lines` is bindable so the page can float the emojis over the board. Nothing shows for a game without chat
   * (against the computer).
   */
  import { onDestroy } from 'svelte';
  import ChatDock from './ChatDock.svelte';
  import { GameChatRoom } from './room.svelte';
  import type { ChatLine } from './chat';

  let { gameId, opponent, lines = $bindable([]), me = $bindable('') }: { gameId: string; opponent: string; lines?: ChatLine[]; me?: string } = $props();

  // svelte-ignore state_referenced_locally
  const room = new GameChatRoom(gameId);
  onDestroy(() => room.close());
  $effect(() => {
    lines = room.lines;
    me = room.me;
  });
  const theyAreHere = $derived(room.here.some((u) => u !== room.me));
</script>

{#if !room.gone && room.me}
  <ChatDock lines={room.lines} me={room.me} guard={room.guard} onsend={(k, v) => room.send(k, v)} note={theyAreHere ? '' : `${opponent} hasn't opened the chat yet: say hi!`} />
{/if}
