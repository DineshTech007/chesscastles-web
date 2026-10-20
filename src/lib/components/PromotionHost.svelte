<script lang="ts">
  /** The piece picker for any board that asks through promotionFor (src/lib/chess/promotion.ts). */
  import PromotionPicker from './PromotionPicker.svelte';
  import { promotionAsk } from '$lib/chess/promotion';
</script>

{#if $promotionAsk}
  {@const ask = $promotionAsk}
  <PromotionPicker color={ask.color} onpick={(role) => ask.answer(role)} oncancel={() => ask.answer(undefined)} />
{/if}
