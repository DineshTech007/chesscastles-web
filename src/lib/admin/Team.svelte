<script lang="ts">
  /** Admin (owner only): who else can help (moderators, support), and the log of every admin change. */
  import { adminLog, admins, setAdmin, type Role } from '$lib/admin';

  let team = $state<Awaited<ReturnType<typeof admins>> | undefined>();
  let log = $state<Awaited<ReturnType<typeof adminLog>> | undefined>();
  let username = $state('');
  let role = $state<Role>('support');
  let msg = $state('');
  const load = async () => {
    try {
      [team, log] = await Promise.all([admins(), adminLog()]);
    } catch (e) {
      msg = e instanceof Error ? e.message : 'Could not load.';
    }
  };
  void load();
  async function add(e: Event) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,30}$/.test(u)) return void (msg = 'Type their Lichess username.');
    try {
      await setAdmin(`lichess:${u}`, role);
      username = '';
      msg = 'Added.';
      await load();
    } catch (err) {
      msg = err instanceof Error ? err.message : 'Not added.';
    }
  }
  async function remove(uid: string) {
    await setAdmin(uid, '').catch(() => {});
    await load();
  }
  const date = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const ROLE_TEXT: Record<string, string> = {
    owner: 'Everything',
    moderator: 'Reports and suspending players',
    support: 'Players, giving plans, reading reports',
  };
</script>

<section class="card box">
  <h3 class="title">Team</h3>
  {#if team}
    <ul class="team">
      <li><strong>{team.owner?.replace(/^lichess:/, '')}</strong><span class="label">Owner · {ROLE_TEXT.owner}</span></li>
      {#each team.admins as a (a.uid)}
        <li>
          <strong>{a.name ?? a.uid.replace(/^lichess:/, '')}</strong><span class="label">{a.role} · {ROLE_TEXT[a.role]}</span>
          <button class="btn small" onclick={() => remove(a.uid)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
  <form class="add" onsubmit={add}>
    <input bind:value={username} placeholder="Lichess username" aria-label="Lichess username" />
    <select bind:value={role} aria-label="Role">
      <option value="support">Support</option>
      <option value="moderator">Moderator</option>
    </select>
    <button class="btn primary">Add</button>
  </form>
  <p class="label">They need to have signed in to Chess Castles once. They see Admin in their menu.</p>
  {#if msg}<p class="msg">{msg}</p>{/if}
</section>

<section class="card box">
  <h3 class="title">Admin log</h3>
  {#if !log}
    <p class="label">Loading…</p>
  {:else if !log.length}
    <p class="label">No changes yet.</p>
  {:else}
    <ul class="log">
      {#each log as l (l.id)}
        <li><span class="label">{date(l.at)}</span> <strong>{l.admin.replace(/^lichess:/, '')}</strong> {l.action} <code>{l.target.replace(/^lichess:/, '')}</code> <span class="label detail">{l.detail}</span></li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .box {
    padding: 16px 18px;
    margin-bottom: 14px;
  }
  h3 {
    margin: 0 0 10px;
    font-size: 16px;
  }
  .team,
  .log {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .team li {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--raised);
  }
  .team .label {
    flex: 1;
  }
  .add {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  input,
  select {
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 10px;
    font: inherit;
  }
  .btn.small {
    min-height: 30px;
  }
  .log li {
    font-size: 13.5px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    overflow-wrap: anywhere;
  }
  .detail {
    font-size: 12px;
  }
  .msg {
    font-weight: 700;
    color: var(--accent);
  }
  p {
    margin: 6px 0 0;
  }
</style>
