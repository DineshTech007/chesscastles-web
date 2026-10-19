<script lang="ts">
  /** Admin: every plan limit, the prices, the launch offer and the site banner (saved without a deploy). */
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { getSettings, saveSettings, type Can, type Settings } from '$lib/admin';
  import { PLANS_ON, FEATURES, FEATURE_INFO, GATE_INFO, PLANS, PLAN_INFO, QUOTA_INFO, loadPlanSettings, type Gate, type Per, type Quota } from '$lib/plans';

  let { can }: { can: Can[] } = $props();
  const owner = $derived(can.includes('owner'));
  let s = $state<Settings | undefined>();
  let error = $state('');
  let msg = $state('');
  let busy = $state(false);
  getSettings().then(
    (r) => (s = r),
    (e) => (error = e.message),
  );
  const PERS: Per[] = ['day', 'week', 'month', 'ever'];

  async function save(part: 'config' | 'launch' | 'banner') {
    if (!s) return;
    busy = true;
    msg = '';
    try {
      s = await saveSettings({ [part]: $state.snapshot(s[part]) });
      await loadPlanSettings(true);
      msg = 'Saved. The site uses it within a minute.';
    } catch (e) {
      msg = e instanceof Error ? e.message : 'Not saved.';
    } finally {
      busy = false;
    }
  }
  /** An empty box means unlimited. */
  const setN = (f: (typeof FEATURES)[number], p: (typeof PLANS)[number], v: string) => {
    if (!s) return;
    s.config.limits[f][p].n = v.trim() === '' ? null : Math.max(0, Math.round(Number(v)));
  };
</script>

{#if error}
  <p class="error">{error}</p>
{:else if !s}
  <div class="card skel"></div>
{:else}
  {#if !owner}<p class="label">Only the owner can change these; you can see them.</p>{/if}
  {#if PLANS_ON}
  <fieldset class="card" disabled={!owner || busy}>
    <legend class="title">Limits per plan</legend>
    <p class="label">How many uses each plan gets. Leave a box empty for unlimited. Limits reset at midnight, India time.</p>
    <div class="scroll">
      <table>
        <thead><tr><th scope="col">Feature</th>{#each PLANS as p (p)}<th scope="col"><PlanBadge plan={p} /> {PLAN_INFO[p].name}</th>{/each}</tr></thead>
        <tbody>
          {#each FEATURES as f (f)}
            <tr>
              <th scope="row">{FEATURE_INFO[f].label}</th>
              {#each PLANS as p (p)}
                {@const l = s.config.limits[f][p]}
                <td>
                  <input type="number" min="0" value={l.n ?? ''} placeholder="∞" oninput={(e) => setN(f, p, (e.currentTarget as HTMLInputElement).value)} aria-label="{FEATURE_INFO[f].label}, {PLAN_INFO[p].name}" />
                  <select bind:value={s.config.limits[f][p].per} aria-label="per">{#each PERS as per (per)}<option value={per}>{per === 'ever' ? 'in all' : `a ${per}`}</option>{/each}</select>
                </td>
              {/each}
            </tr>
          {/each}
          {#each Object.keys(s.config.quotas) as q (q)}
            <tr>
              <th scope="row">{QUOTA_INFO[q as Quota]}</th>
              {#each PLANS as p (p)}<td><input type="number" min="0" bind:value={s.config.quotas[q as Quota][p]} aria-label="{QUOTA_INFO[q as Quota]}, {PLAN_INFO[p].name}" /></td>{/each}
            </tr>
          {/each}
          {#each Object.keys(s.config.gates) as g (g)}
            <tr>
              <th scope="row">{GATE_INFO[g as Gate]}</th>
              <td colspan="4">
                From <select bind:value={s.config.gates[g as Gate]} aria-label="Lowest plan">{#each PLANS as p (p)}<option value={p}>{PLAN_INFO[p].name}</option>{/each}</select> and up
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <h3 class="title">Prices (₹)</h3>
    <div class="prices">
      {#each ['premium', 'elite'] as const as p (p)}
        <div class="price">
          <strong><PlanBadge plan={p} /> {PLAN_INFO[p].name}</strong>
          <label>Month <input type="number" min="0" bind:value={s.config.prices[p].month} /></label>
          <label>Year <input type="number" min="0" bind:value={s.config.prices[p].year} /></label>
        </div>
      {/each}
    </div>
    <button class="btn primary" onclick={() => save('config')}>Save limits and prices</button>
  </fieldset>

  <fieldset class="card" disabled={!owner || busy}>
    <legend class="title">Launch offer</legend>
    <p class="label">Every player who signs in while it is on gets the plan free for the days set, once.</p>
    <div class="row">
      <label class="check"><input type="checkbox" bind:checked={s.launch.on} />On</label>
      <label>Plan <select bind:value={s.launch.plan}>{#each PLANS.filter((p) => p !== 'free') as p (p)}<option value={p}>{PLAN_INFO[p].name}</option>{/each}</select></label>
      <label>Days <input type="number" min="1" max="366" bind:value={s.launch.days} /></label>
      <label>For sign-ins until <input type="date" bind:value={s.launch.until} /></label>
    </div>
    <button class="btn primary" onclick={() => save('launch')}>Save the offer</button>
  </fieldset>
  {/if}

  <fieldset class="card" disabled={!owner || busy}>
    <legend class="title">Site banner</legend>
    <p class="label">A line at the top of every page (news, a tournament, an offer). Players can close it.</p>
    <div class="row">
      <label class="check"><input type="checkbox" bind:checked={s.banner.on} />Show</label>
      <label class="grow">Text <input maxlength="200" bind:value={s.banner.text} placeholder="e.g. Chess Castles Open on Sunday at 6 pm!" /></label>
      <label>Link <input bind:value={s.banner.link} placeholder="/play/tournament" /></label>
    </div>
    <button class="btn primary" onclick={() => save('banner')}>Save the banner</button>
  </fieldset>
  {#if msg}<p class="msg" role="status">{msg}</p>{/if}
{/if}

<style>
  fieldset {
    border: 1px solid var(--border-soft);
    padding: 16px 18px;
    margin: 0 0 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  legend {
    font-size: 17px;
    padding: 0 6px;
  }
  fieldset p {
    margin: 0;
  }
  h3 {
    margin: 6px 0 0;
    font-size: 15px;
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    min-width: 760px;
    font-size: 13.5px;
  }
  th,
  td {
    padding: 6px;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }
  td {
    white-space: nowrap;
  }
  input,
  select {
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 8px;
    font: inherit;
    font-size: 13.5px;
  }
  td input[type='number'] {
    width: 64px;
  }
  .prices {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .price {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--raised);
  }
  .price label,
  .row label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13.5px;
  }
  .price input {
    width: 90px;
  }
  .row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  .row .grow {
    flex: 1;
    min-width: 220px;
  }
  .row .grow input {
    flex: 1;
  }
  .check input {
    width: 18px;
    height: 18px;
  }
  .btn {
    align-self: flex-start;
  }
  .msg {
    font-weight: 700;
    color: var(--accent);
  }
  .error {
    color: var(--loss);
  }
  .skel {
    height: 300px;
  }
</style>
