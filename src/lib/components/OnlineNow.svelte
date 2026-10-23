<script lang="ts">
  import NameFx from '$lib/economy/NameFx.svelte';
  /**
   * The home page's "Online now": the player's friends who are on Chess Castles or on Lichess right now (Watch when
   * they play), then the other players on Chess Castles now, with Add friend (the other player accepts or not;
   * messages stay between friends). Fresh every minute while the page is in front.
   */
  import { onMount } from 'svelte';
  import TitleBadge from './TitleBadge.svelte';
  import ChallengeSheet from './ChallengeSheet.svelte';
  import { t } from '$lib/i18n';
  import { lichessStatus, type LichessStatus } from '$lib/lichess';
  import { poll } from '$lib/poll';
  import { friendAction, friendsCache, onlinePlayers, type OnlinePlayer, type Player, type Relation } from '$lib/social';

  let online = $state<OnlinePlayer[]>([]);
  let lichess = $state<Map<string, LichessStatus>>(new Map());
  let loaded = $state(false);
  let busy = $state<string | undefined>();
  /** The player being invited to a game (the invite sheet). */
  let inviting = $state<{ uid: string; name: string } | undefined>();

  const lichessId = (uid: string) => (uid.startsWith('lichess:') ? uid.slice(8) : undefined);

  async function load() {
    online = await onlinePlayers();
    // Friends with a Lichess account: online or playing there (Lichess says so publicly).
    const ids = $friendsCache.map((f) => lichessId(f.uid)).filter((x): x is string => !!x);
    lichess = ids.length ? await lichessStatus(ids).catch(() => lichess) : new Map();
    loaded = true;
    return true;
  }
  onMount(() => poll(load, 60_000));

  type Row = { player: Player; onSite: boolean; lichess?: LichessStatus; playingHere: boolean };
  /** Friends online somewhere: on Chess Castles, or on Lichess. */
  const friends = $derived.by(() => {
    const here = new Map(online.filter((p) => p.relation === 'friends').map((p) => [p.uid, p]));
    const rows: Row[] = [];
    for (const f of $friendsCache) {
      const site = here.get(f.uid);
      const li = lichessId(f.uid) ? lichess.get(lichessId(f.uid)!) : undefined;
      if (site || li?.online) rows.push({ player: site ?? f, onSite: !!site, lichess: li?.online ? li : undefined, playingHere: !!site?.playing });
    }
    return rows.sort((a, b) => Number(!!b.playingHere || !!b.lichess?.playingId) - Number(!!a.playingHere || !!a.lichess?.playingId));
  });
  const others = $derived(online.filter((p) => p.relation !== 'friends').slice(0, 8));

  async function act(p: OnlinePlayer, action: 'request' | 'accept') {
    busy = p.uid;
    try {
      const relation: Relation = await friendAction(p.uid, action);
      online = online.map((o) => (o.uid === p.uid ? { ...o, relation } : o));
    } catch {
      /* the button stays; the next refresh shows the truth */
    } finally {
      busy = undefined;
    }
  }
  const flag = (c?: string) => (c ? `/flags/${c}.svg` : undefined);
  /**
   * Play: anyone with a Lichess account gets an invite with a popup (ChallengeSheet, src/lib/invites.ts); a friend
   * with a Google account, the Play page's "A friend" (a message with a Join button, after connecting Lichess).
   */
  const playHref = (p: Player, friend: boolean) => {
    const name = lichessId(p.uid) ?? (friend ? p.username : undefined);
    return name ? `/play?mode=online&friend=${encodeURIComponent(name)}` : undefined;
  };
</script>

{#if loaded && (friends.length || others.length)}
  <section class="card online" aria-labelledby="online-h">
    <div class="head">
      <h2 id="online-h" class="title"><span class="dot" aria-hidden="true"></span>{$t('online.h')}</h2>
      <span class="label num">{friends.length + online.filter((p) => p.relation !== 'friends').length}</span>
    </div>

    {#if friends.length}
      <h3 class="label sub">{$t('online.friends')}</h3>
      <ul>
        {#each friends as r (r.player.uid)}
          <li>
            <a class="who" href="/players/{encodeURIComponent(r.player.uid)}">
              {#if flag(r.player.country)}<img src={flag(r.player.country)} alt="" width="18" height="12" />{/if}
              <TitleBadge title={r.player.title} size={12} /><strong><NameFx style={r.player.cos?.name ?? ''}>{r.player.name}</NameFx></strong>
              {#if r.player.kfide}<span class="num label">{r.player.kfide}</span>{/if}
            </a>
            <span class="where label">
              {r.playingHere ? $t('online.playing') : r.onSite ? $t('online.oncc') : r.lichess?.playingId ? $t('online.playinglichess') : $t('online.onlichess')}
            </span>
            {#if r.playingHere}
              <a class="btn small primary" href="/watch/friend/{encodeURIComponent(r.player.uid)}">{$t('online.watch')}</a>
            {:else if r.lichess?.playingId}
              <a class="btn small primary" href="/watch/live/{r.lichess.playingId}">{$t('online.watch')}</a>
            {:else if lichessId(r.player.uid)}
              <button class="btn small primary" onclick={() => (inviting = r.player)}>{$t('online.play')}</button>
            {:else if playHref(r.player, true)}
              <a class="btn small primary" href={playHref(r.player, true)}>{$t('online.play')}</a>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if others.length}
      <h3 class="label sub">{$t('online.others')}</h3>
      <ul>
        {#each others as p (p.uid)}
          <li>
            <a class="who" href="/players/{encodeURIComponent(p.uid)}">
              {#if flag(p.country)}<img src={flag(p.country)} alt="" width="18" height="12" />{/if}
              <TitleBadge title={p.title} size={12} /><strong><NameFx style={p.cos?.name ?? ''}>{p.name}</NameFx></strong>
              {#if p.kfide}<span class="num label">{p.kfide}</span>{/if}
            </a>
            {#if p.playing}<span class="where label">{$t('online.playing')}</span>{:else if lichessId(p.uid)}<button class="btn small" onclick={() => (inviting = p)}>{$t('online.play')}</button>{/if}
            {#if p.relation === 'outgoing'}
              <span class="label sent">{$t('online.sent')}</span>
            {:else if p.relation === 'incoming'}
              <button class="btn small primary" disabled={busy === p.uid} onclick={() => act(p, 'accept')}>{$t('online.accept')}</button>
            {:else}
              <button class="btn small" disabled={busy === p.uid} onclick={() => act(p, 'request')}>{$t('online.add')}</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    <a class="more" href="/friends?tab=find">{$t('online.more')} →</a>
  </section>
{/if}
{#if inviting}<ChallengeSheet player={inviting} onclose={() => (inviting = undefined)} />{/if}

<style>
  .online {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--win);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--win) 22%, transparent);
  }
  .sub {
    margin: 6px 0 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 800;
    font-size: 11px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    border-top: 1px solid var(--border);
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text);
    text-decoration: none;
    overflow: hidden;
    white-space: nowrap;
  }
  .who strong {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .who img {
    border-radius: 2px;
    flex: none;
  }
  .where {
    flex: none;
    font-size: 12.5px;
  }
  /* Small phones: "Playing on Lichess" on two short lines, so the name keeps its room. */
  @media (max-width: 400px) {
    .where {
      max-width: 64px;
      white-space: normal;
      line-height: 1.15;
      font-size: 11.5px;
    }
  }
  .sent {
    flex: none;
    font-size: 12.5px;
  }
  .btn.small {
    flex: none;
  }
  .more {
    align-self: flex-start;
    font-weight: 700;
    margin-top: 4px;
  }
</style>
