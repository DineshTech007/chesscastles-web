<script lang="ts">
  /**
   * The celebrations after a puzzle (finish.ts), one after the other over the page, each with its sound: `add` them
   * with a wait, so the result card is seen first.
   */
  import { onDestroy } from 'svelte';
  import PuzzleCelebrate from './PuzzleCelebrate.svelte';
  import { puzzleSounds } from './puzzleSounds';
  import type { Moment } from './finish';

  let moment = $state<Moment | undefined>();
  const queue: Moment[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  export function add(moments: Moment[], wait: number) {
    queue.push(...moments);
    if (moment || !queue.length) return;
    clearTimeout(timer);
    timer = setTimeout(show, wait);
  }
  function show() {
    moment = queue.shift();
    if (!moment) return;
    if (moment.level) puzzleSounds.levelUp();
    else puzzleSounds.badge();
  }
  function close() {
    moment = undefined;
    clearTimeout(timer);
    timer = setTimeout(show, 250);
  }
  onDestroy(() => clearTimeout(timer));
</script>

{#if moment}
  <PuzzleCelebrate level={moment.level} found={moment.found} badge={moment.badge} onclose={close} />
{/if}
