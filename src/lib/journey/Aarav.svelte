<script lang="ts">
  /**
   * Aarav's picture: a generated photograph of a chess enthusiast at the board
   * (static/journey/aarav.jpg; no real person), in a round gold frame. The
   * practice account has no face of its own; this is its portrait on the site.
   */
  let { size = 160 }: { size?: number } = $props();
</script>

<img
  class="aarav"
  src={size > 320 ? '/journey/aarav.jpg' : '/journey/aarav-320.jpg'}
  alt="A chess player leaning over a board, books and a notebook of moves beside it: Aarav, the practice account's picture"
  width={size}
  height={size}
  loading="lazy"
/>

<style>
  .aarav {
    display: block;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #edb040;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    background: #14213d;
  }
</style>
