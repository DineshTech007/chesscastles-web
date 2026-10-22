<script lang="ts">
  /**
   * CastlesClass for admins (src/lib/classroom/AdminPanel.svelte; the same panel is the CastlesClass tab of /admin).
   * `?add=<uid>&name=<name>`: open that player's coach rights at once.
   */
  import { page } from '$app/state';
  import AdminPanel from '$lib/classroom/AdminPanel.svelte';

  const add = $derived(page.url.searchParams.get('add') ? { uid: page.url.searchParams.get('add')!, name: page.url.searchParams.get('name') || 'Player' } : undefined);
</script>

<svelte:head><title>Admin · CastlesClass · Chess Castles</title></svelte:head>

<div class="wrap">
  <header class="head">
    <a class="back" href="/castleclass">← CastlesClass</a>
    <h1>CastlesClass admin</h1>
    <p class="muted">Coaches and their rights, the classes live now, and the problems people meet in class.</p>
  </header>
  <AdminPanel {add} />
</div>

<style>
  .wrap {
    max-width: 980px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head h1 {
    margin: 4px 0 0;
    font: 700 30px var(--font-display);
  }
  .back {
    color: var(--muted);
    text-decoration: none;
    font-size: 14px;
  }
  .muted {
    color: var(--muted);
  }
</style>
