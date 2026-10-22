<script lang="ts">
  /** The Chess Castles crest and "CastlesClass" at the top left of a live class (owner, 2026-10-22, for the demo). */
</script>

<a class="brand" href="/castleclass" title="CastlesClass by Chess Castles">
  <img class="crest logo-dark" src="/brand/chesscastles-crest-dark.svg" alt="" width="26" height="29" />
  <img class="crest logo-light" src="/brand/chesscastles-crest-light.svg" alt="" width="26" height="29" />
  <span class="word">CASTLES<span class="gold">CLASS</span></span>
</a>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    color: var(--text);
    padding-right: 10px;
    margin-right: 2px;
    border-right: 1px solid var(--border);
    flex: none;
  }
  .crest {
    width: 26px;
    height: auto;
  }
  /* The crest for the theme (as in the side menu): gold on navy, or navy on light. */
  .logo-light {
    display: none;
  }
  :global(:root[data-theme='light']) .logo-light {
    display: block;
  }
  :global(:root[data-theme='light']) .logo-dark {
    display: none;
  }
  .word {
    font: 800 15px Cinzel, Georgia, serif;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .gold {
    color: var(--gold);
  }
  @media (max-width: 520px) {
    .word {
      font-size: 13px;
    }
  }
</style>
