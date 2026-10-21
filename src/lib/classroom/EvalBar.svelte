<script lang="ts">
  /** The engine's evaluation as the usual bar beside the board: white's share from the bottom (from the top when flipped). */
  import { evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';

  let { info, orientation = 'white' }: { info?: EngineInfo; orientation?: 'white' | 'black' } = $props();
  const white = $derived(info ? whiteChances(info) : 0.5);
</script>

<div class="evalbar" class:flipped={orientation === 'black'} aria-label="Evaluation {info ? evalLabel(info) : 'pending'}">
  <div class="white" style="height: {white * 100}%"></div>
  <span class="txt num" class:top={(orientation === 'white') === white < 0.5}>{info ? evalLabel(info) : ''}</span>
</div>

<style>
  .evalbar {
    position: relative;
    width: 22px;
    flex: none;
    align-self: stretch;
    border-radius: 6px;
    overflow: hidden;
    background: #1b1f2a;
    display: flex;
    flex-direction: column-reverse;
  }
  .evalbar.flipped {
    flex-direction: column;
  }
  .white {
    background: #f2f5fb;
    transition: height 0.4s ease;
  }
  .txt {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 4px;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    color: #1b1f2a;
  }
  .txt.top {
    bottom: auto;
    top: 4px;
    color: #f2f5fb;
  }
</style>
