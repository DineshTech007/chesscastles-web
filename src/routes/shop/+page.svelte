<script lang="ts">
  /**
   * The Castle Shop (owner, 2026-10-23: "a shop … skins and board designs to show other players"): boards, piece
   * finishes, avatar frames, name styles, banners and victory effects, for the gold and gems won by playing and
   * learning (src/lib/economy). Three deals a day, a featured Legendary, Royal items that can only be won, and the
   * player's own collection to wear. Every item can be looked at closely before buying, and buying asks once more.
   */
  import { page } from '$app/state';
  import { tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { t, type Key } from '$lib/i18n';
  import { session, startSignIn } from '$lib/auth';
  import { myName, myPhoto, photoSrc } from '$lib/stores/me';
  import Icon from '$lib/components/Icon.svelte';
  import Coin from '$lib/economy/Coin.svelte';
  import Gem from '$lib/economy/Gem.svelte';
  import ItemArt from '$lib/economy/ItemArt.svelte';
  import Avatar from '$lib/economy/Avatar.svelte';
  import Banner from '$lib/economy/Banner.svelte';
  import NameFx from '$lib/economy/NameFx.svelte';
  import { ITEMS, ITEM, MAX_SHIELDS, RARITIES, dealsFor, levelOf, owns, priceOf, rankOf, unlocked, type Item, type Slot, type WearSlot } from '$lib/economy/core';
  import { adminTester, purchase, today, wallet, walletMode, wear } from '$lib/economy/wallet';
  import { fmt } from '$lib/economy/ui';
  import { previewTheme, rewardSound, type SoundTheme } from '$lib/sound';
  import { chooseAvatar, coachAvatar, type AvatarId } from '$lib/coach/avatar';

  /**
   * The Shop's sections (owner, 2026-10-23: "sections for chess board themes, chess pieces skins, photo frames to buy,
   * banners", and sounds): each a heading and its items, all of them on "All", one at a time from the tabs.
   */
  interface Section {
    id: string;
    icon: string;
    slots: Slot[];
  }
  const SECTIONS: Section[] = [
    { id: 'board', icon: '♟️', slots: ['board'] },
    { id: 'pieces', icon: '♞', slots: ['pieces', 'finish'] },
    { id: 'gurus', icon: '🎓', slots: ['guru'] },
    { id: 'frame', icon: '🖼️', slots: ['frame'] },
    { id: 'banner', icon: '🚩', slots: ['banner'] },
    { id: 'sound', icon: '🔊', slots: ['sound'] },
    { id: 'more', icon: '✨', slots: ['name', 'victory', 'shield'] },
  ];
  // Old links (?tab=finish, ?tab=shield…) open the section that holds them.
  const asked = page.url.searchParams.get('tab');
  const sectionOf = (t: string | null) => (t ? (SECTIONS.find((x) => x.id === t || x.slots.includes(t as Slot))?.id ?? 'all') : 'all');
  let tab = $state<string>(sectionOf(asked));
  let mine = $state(page.url.searchParams.get('mine') === '1');
  let afford = $state(false);
  let open = $state<Item | undefined>();
  let confirming = $state(false);
  let busy = $state(false);
  let error = $state('');
  let justBought = $state('');
  // A link to one item (a locked Guru in the coach chooser): its sheet opens.
  let linked = false;
  $effect(() => {
    const id = page.url.searchParams.get('item');
    if (linked || !id || !ITEM[id]) return;
    linked = true;
    show(ITEM[id]);
  });

  const day = today();
  const deals = dealsFor(day);
  const featured = ITEMS.filter((i) => i.rarity === 'legendary')[Math.abs([...day].reduce((s, c) => s * 31 + c.charCodeAt(0), 7)) % ITEMS.filter((i) => i.rarity === 'legendary').length];
  const photo = $derived($myPhoto ? photoSrc($myPhoto) : '/avatars/knight.webp');
  const name = $derived($myName || 'Your Name');
  const level = $derived(levelOf($wallet.xp));

  const has = (i: Item) => (i.slot === 'shield' ? $wallet.shields >= MAX_SHIELDS : owns($wallet, i.id));
  const wearing = (i: Item) => i.slot !== 'shield' && $wallet.equipped[i.slot as WearSlot] === i.id;
  const canPay = (i: Item) => {
    const p = priceOf(i, day);
    return !!p && ($adminTester || $wallet[p.currency] >= p.amount);
  };
  /** A slot's items, with the filters, cheapest first within each rarity. */
  const itemsOf = (slot: Slot) =>
    ITEMS.filter((i) => i.slot === slot && (!mine || owns($wallet, i.id)) && (!afford || (!has(i) && i.rarity !== 'royal' && canPay(i)))).sort(
      (a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || (a.gems ? 10_000 + a.gems : (a.gold ?? 0)) - (b.gems ? 10_000 + b.gems : (b.gold ?? 0)),
    );
  const shownSections = $derived(
    SECTIONS.filter((x) => tab === 'all' || x.id === tab)
      .map((x) => ({ ...x, groups: x.slots.map((slot) => ({ slot, items: itemsOf(slot) })).filter((g) => g.items.length) }))
      .filter((x) => x.groups.length),
  );
  const ownedIn = (x: Section) => ITEMS.filter((i) => x.slots.includes(i.slot) && i.slot !== 'shield' && owns($wallet, i.id)).length;
  const totalIn = (x: Section) => ITEMS.filter((i) => x.slots.includes(i.slot) && i.slot !== 'shield').length;
  async function go(id: string) {
    tab = id;
    await tick();
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const countOwned = $derived(ITEMS.filter((i) => i.slot !== 'shield' && owns($wallet, i.id)).length);

  function how(i: Item): string {
    const u = i.unlock;
    if (!u) return '';
    if ('streak' in u) return $t('eco.unlock.streak', { n: u.streak });
    if ('level' in u) return $t('eco.unlock.level', { n: u.level });
    if ('cupWin' in u) return $t('eco.unlock.cup');
    return $t('eco.unlock.founder');
  }
  /** How far along a Royal item's condition is (0–1). */
  function progress(i: Item): number {
    const u = i.unlock;
    if (!u) return 0;
    if ('streak' in u) return Math.min(1, $wallet.login.best / u.streak);
    if ('level' in u) return Math.min(1, level / u.level);
    if ('cupWin' in u) return ($wallet.cups?.wins ?? 0) > 0 ? 1 : 0;
    return unlocked($wallet, i) ? 1 : 0;
  }

  function show(i: Item) {
    open = i;
    confirming = false;
    error = '';
    justBought = '';
  }
  function close() {
    open = undefined;
    confirming = false;
  }
  async function buyIt() {
    if (!open) return;
    if ($walletMode === 'guest') return startSignIn();
    busy = true;
    error = '';
    const r = await purchase(open.id);
    busy = false;
    confirming = false;
    if (r.ok) {
      justBought = open.id;
      rewardSound('buy');
    } else error = r.error === 'short' ? $t('eco.err.short') : r.error === 'signin' ? $t('eco.signinBuy') : r.error;
  }
  /** A Guru bought: chosen as the player's Guru, and the note says where to meet them. */
  function chooseGuru(i: Item) {
    chooseAvatar(i.id.slice(2) as AvatarId);
    worn = i;
    clearTimeout(wornTimer);
    wornTimer = setTimeout(() => (worn = undefined), 7000);
  }
  async function wearIt(i: Item, off = false) {
    if (i.slot === 'shield' || i.slot === 'guru') return;
    busy = true;
    const r = await wear(i.slot as WearSlot, off ? '' : i.id);
    busy = false;
    if (!r.ok) error = r.error;
    else if (i.slot === 'sound' && !off) previewTheme(i.id as SoundTheme);
    // Where it shows (owner, 2026-10-23: "I wore the gold chain but I am not sure where it is added"): a note in the middle.
    if (r.ok && !off) {
      worn = i;
      clearTimeout(wornTimer);
      wornTimer = setTimeout(() => (worn = undefined), 7000);
    }
  }
  /** The item just put on: the note in the middle says where to see it. */
  let worn = $state<Item | undefined>();
  let wornTimer: ReturnType<typeof setTimeout> | undefined;
  /** Where each kind of item shows, and a page to see it. */
  const SEE: Partial<Record<Slot, string>> = { guru: '/coach',  frame: '/profile', name: '/profile', banner: '/profile', board: '/play', pieces: '/play', finish: '/play' };
  const slotKey = (s: Slot | 'all') => `eco.slot.${s}` as Key;
  const secKey = (id: string, sub = false) => `eco.sec.${id}${sub ? '.b' : ''}` as Key;
  const left = $derived.by(() => {
    if (!open) return undefined;
    const p = priceOf(open, day);
    return p ? { currency: p.currency, amount: $wallet[p.currency] - p.amount } : undefined;
  });
  const midnight = () => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    const ms = d.getTime() - Date.now();
    return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  };
  let clock = $state(midnight());
  $effect(() => {
    const id = setInterval(() => (clock = midnight()), 30_000);
    return () => clearInterval(id);
  });
</script>

<svelte:head><title>{$t('eco.shop')} · Chess Castles</title></svelte:head>
<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#snippet price(i: Item, big = false)}
  {@const p = priceOf(i, day)}
  {#if p}
    <span class="price" class:big class:deal={!!p.was}>
      {#if p.currency === 'gold'}<Coin size={big ? 22 : 16} />{:else}<Gem size={big ? 21 : 15} />{/if}
      <span class="num">{fmt.format(p.amount)}</span>
      {#if p.was}<s class="was num">{fmt.format(p.was)}</s>{/if}
    </span>
  {/if}
{/snippet}

{#snippet rarity(r: Item['rarity'])}
  <span class="rar r-{r}">{r === 'royal' ? '👑' : r === 'legendary' ? '✦' : r === 'epic' ? '◆' : r === 'rare' ? '●' : '○'} {$t(`eco.r.${r}` as Key)}</span>
{/snippet}

{#snippet card(i: Item, deal = false)}
  {@const got = has(i)}
  {@const on = wearing(i)}
  <button class="item r-{i.rarity}" class:deal class:on class:got onclick={() => show(i)} aria-label="{i.name}, {$t(`eco.r.${i.rarity}` as Key)}">
    <span class="art-wrap">
      <ItemArt id={i.id} {photo} {name} />
      {#if deal}<span class="ribbon">−25%</span>{/if}
      {#if i.animated}<span class="anim" title={$t('eco.animated')}>✨</span>{/if}
      {#if on}<span class="flag-on"><Icon name="check" size={13} />{$t('eco.wearing')}</span>{/if}
    </span>
    <span class="meta">
      {@render rarity(i.rarity)}
      <span class="nm">{i.name}</span>
      <span class="foot">
        {#if i.rarity === 'royal'}
          {#if got}<span class="state ok"><Icon name="check" size={14} />{$t('eco.owned')}</span>{:else}<span class="state lock"><Icon name="lock" size={13} />{how(i)}</span>{/if}
        {:else if i.slot === 'shield'}
          {@render price(i)}<span class="state">🛡️ {$wallet.shields}/{MAX_SHIELDS}</span>
        {:else if got}
          <span class="state ok"><Icon name="check" size={14} />{$t('eco.owned')}</span>
        {:else}
          <span class="pwrap" class:dim={!canPay(i)}>{@render price(i)}</span>
          {#if !canPay(i)}<span class="state short"><Icon name="lock" size={12} /></span>{/if}
        {/if}
      </span>
    </span>
  </button>
{/snippet}

<div class="shop">
  <header class="hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="hero-text">
      <span class="kicker"><Icon name="sparkle" size={14} />{$t('eco.kind')}</span>
      <h1 class="display">{$t('eco.shop.h')}</h1>
      <p>{$t('eco.shop.sub')}</p>
      <div class="hero-actions">
        <a class="btn primary" href="/rewards"><Icon name="trophy" size={16} />{$t('eco.earnMore')}</a>
        <button class="btn" onclick={() => ((mine = true), (tab = 'all'))}><Icon name="star" size={16} />{$t('eco.filter.owned')} · {countOwned}</button>
      </div>
    </div>
    <!-- What everyone else sees: the frame, the name style, the banner and the level. -->
    <div class="showcase" aria-label={$t('eco.showcase')}>
      <div class="sc-banner">{#if $wallet.equipped.banner}<Banner id={$wallet.equipped.banner} />{:else}<span class="sc-plain"></span>{/if}</div>
      <div class="sc-body">
        <Avatar src={photo} size={68} frame={$wallet.equipped.frame ?? ''} {level} border="3px solid var(--gold)" />
        <div class="sc-who">
          <span class="sc-name"><NameFx style={$wallet.equipped.name ?? ''}>{name}</NameFx></span>
          <span class="sc-rank">{$t('eco.level', { n: level })} · {rankOf(level)}</span>
        </div>
      </div>
      <div class="sc-bal">
        <span class="g"><Coin size={20} />{fmt.format($wallet.gold)}</span>
        <span class="m"><Gem size={19} />{fmt.format($wallet.gems)}</span>
      </div>
      <span class="sc-cap">{$t('eco.showcase')}</span>
    </div>
  </header>

  {#if $walletMode === 'guest'}
    <div class="note"><Icon name="lock" size={16} />{$t('eco.guest')} <button class="linkish" onclick={() => startSignIn()}>{$t('shell.signin')}</button></div>
  {/if}

  {#if !mine && !afford && tab === 'all'}
    <section class="deals" aria-labelledby="deals-h">
      <div class="sec-row">
        <h2 id="deals-h" class="sec-h">🔥 {$t('eco.shop.deals')}</h2>
        <span class="timer"><Icon name="history" size={14} />{$t('eco.shop.ends', { t: clock })}</span>
      </div>
      <div class="deal-grid">
        {#each deals as id (id)}{@render card(ITEM[id], true)}{/each}
      </div>
    </section>

    <section class="featured r-{featured.rarity}" aria-labelledby="feat-h">
      <div class="f-art"><ItemArt id={featured.id} {photo} {name} big /></div>
      <div class="f-text">
        <span class="f-kicker">{$t('eco.shop.featured')}</span>
        {@render rarity(featured.rarity)}
        <h2 id="feat-h" class="display">{featured.name}</h2>
        <p>{featured.blurb}</p>
        <div class="f-buy">
          {#if has(featured)}
            <span class="state ok big"><Icon name="check" size={18} />{$t('eco.owned')}</span>
          {:else}
            {@render price(featured, true)}
          {/if}
          <button class="btn primary big" onclick={() => show(featured)}>{has(featured) ? $t('eco.wear') : $t('eco.lookClose')}</button>
        </div>
      </div>
    </section>
  {/if}

  <section class="catalog" id="catalog" aria-labelledby="cat-h">
    <h2 id="cat-h" class="sr-only">{$t('eco.shop')}</h2>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'all'} class:on={tab === 'all'} onclick={() => go('all')}>{$t('eco.slot.all')}</button>
      {#each SECTIONS as x (x.id)}
        <button role="tab" aria-selected={tab === x.id} class:on={tab === x.id} onclick={() => go(x.id)}><span aria-hidden="true">{x.icon}</span> {$t(secKey(x.id))}</button>
      {/each}
    </div>
    <div class="filters">
      <button class="chip" aria-pressed={mine} onclick={() => ((mine = !mine), (afford = false))}>{$t('eco.filter.owned')}</button>
      <button class="chip" aria-pressed={afford} onclick={() => ((afford = !afford), (mine = false))}>{$t('eco.filter.afford')}</button>
      <a class="pieces-link" href="/settings" onclick={(e) => (e.preventDefault(), import('$lib/boardTheme').then((m) => m.boardThemeOpen.set(true)))}>{$t('eco.freeBoards')}</a>
    </div>
    {#each shownSections as x (x.id)}
      <section class="sec" id="sec-{x.id}" aria-labelledby="sec-{x.id}-h">
        <header class="sec-head">
          <span class="sec-ico" aria-hidden="true">{x.icon}</span>
          <span class="sec-t">
            <h3 id="sec-{x.id}-h" class="title">{$t(secKey(x.id))}</h3>
            <span class="label">{$t(secKey(x.id, true))}</span>
          </span>
          {#if x.id !== 'more'}<span class="sec-n" title={$t('eco.filter.owned')}>{ownedIn(x)}/{totalIn(x)}</span>{/if}
        </header>
        {#each x.groups as g (g.slot)}
          {#if x.groups.length > 1 || x.slots.length > 1}<h4 class="sub-h">{$t(slotKey(g.slot))}</h4>{/if}
          <div class="grid">
            {#each g.items as i (i.id)}{@render card(i)}{/each}
          </div>
        {/each}
      </section>
    {:else}
      <p class="empty">{mine ? $t('eco.emptyMine') : $t('eco.emptyAfford')} <a href="/rewards">{$t('eco.earnMore')}</a></p>
    {/each}
  </section>
</div>

{#if open}
  {@const i = open}
  {@const got = has(i)}
  {@const p = priceOf(i, day)}
  <div class="scrim" role="presentation" onclick={close} transition:fade={{ duration: 150 }}></div>
  <div class="sheet r-{i.rarity}" role="dialog" aria-modal="true" aria-labelledby="item-h" transition:scale={{ start: 0.94, duration: 240, easing: backOut }}>
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <div class="s-art"><ItemArt id={i.id} {photo} {name} big /></div>
    <div class="s-text">
      {@render rarity(i.rarity)}
      <h2 id="item-h" class="display">{i.name}</h2>
      <p class="s-slot">{$t(slotKey(i.slot))}{#if i.animated} · ✨ {$t('eco.animated')}{/if}</p>
      <p>{i.blurb}</p>
      {#if i.slot === 'sound'}<button class="btn listen" onclick={() => previewTheme(i.id as SoundTheme)}><Icon name="speaker" size={18} />{$t('eco.listen')}</button>{/if}

      {#if justBought === i.id}
        <div class="bought" in:scale={{ start: 0.6, duration: 400, easing: backOut }}>🎉 {$t('eco.bought')}</div>
      {/if}

      {#if i.rarity === 'royal' && !got && $adminTester}
        <button class="btn primary" disabled={busy} onclick={buyIt}>Unlock it (admin test)</button>
      {/if}
      {#if i.rarity === 'royal' && !got}
        <div class="royal">
          <span><Icon name="lock" size={15} /> {$t('eco.royalHow', { how: how(i) })}</span>
          <span class="bar"><span style="width: {progress(i) * 100}%"></span></span>
        </div>
      {:else if got && i.slot === 'guru'}
        <div class="s-actions">
          {#if $coachAvatar === i.id.slice(2)}
            <span class="state ok big"><Icon name="check" size={18} />{$t('eco.guru.mine')}</span>
          {:else}
            <button class="btn primary big block" onclick={() => chooseGuru(i)}>{$t('eco.guru.choose')}</button>
          {/if}
        </div>
      {:else if got && i.slot !== 'shield'}
        <div class="s-actions">
          {#if wearing(i)}
            <span class="state ok big"><Icon name="check" size={18} />{$t('eco.wearing')}</span>
            {#if i.slot !== 'board'}<button class="btn" disabled={busy} onclick={() => wearIt(i, true)}>{$t('eco.takeOff')}</button>{/if}
          {:else}
            <button class="btn primary big block" disabled={busy} onclick={() => wearIt(i)}>{$t('eco.wear')}</button>
          {/if}
        </div>
      {:else if p}
        {#if confirming}
          <div class="confirm">
            <p>{$t('eco.confirm', { name: i.name })} {@render price(i, true)}</p>
            {#if left}<p class="label">{$t('eco.after')} {#if left.currency === 'gold'}<Coin size={14} />{:else}<Gem size={13} />{/if} {fmt.format(left.amount)}</p>{/if}
            <div class="s-actions">
              <button class="btn" onclick={() => (confirming = false)}>{$t('eco.cancel')}</button>
              <button class="btn primary" disabled={busy} onclick={buyIt}>{$t('eco.buyNow')}</button>
            </div>
          </div>
        {:else}
          <div class="s-actions">
            {@render price(i, true)}
            {#if got}
              <span class="state">🛡️ {$wallet.shields}/{MAX_SHIELDS}</span>
            {:else if $walletMode === 'guest'}
              <button class="btn primary" onclick={() => startSignIn()}>{$t('eco.signinToBuy')}</button>
            {:else if canPay(i)}
              <button class="btn primary big" onclick={() => (confirming = true)}>{$t('eco.buy')}</button>
            {:else}
              <button class="btn" onclick={() => (close(), goto('/rewards'))}>{$t('eco.need')} · {$t('eco.howEarn')}</button>
            {/if}
          </div>
          {#if !got && !canPay(i)}
            {@const have = $wallet[p.currency]}
            <div class="short"><span class="bar"><span style="width: {Math.min(100, (have / p.amount) * 100)}%"></span></span><span class="label">{fmt.format(have)} / {fmt.format(p.amount)}</span></div>
          {/if}
        {/if}
      {/if}
      {#if error}<p class="err">{error}</p>{/if}
      {#if i.slot === 'shield'}<p class="label">{$t('eco.shieldHow')}</p>{/if}
    </div>
  </div>
{/if}

{#if worn}
  <div class="worn" role="status" transition:scale={{ start: 0.85, duration: 220, easing: backOut }}>
    <button class="w-x" onclick={() => (worn = undefined)} aria-label="Close"><Icon name="close" size={16} /></button>
    <div class="w-art"><ItemArt id={worn.id} {photo} {name} /></div>
    <div class="w-text">
      <strong>✓ {$t('eco.where.on', { name: worn.name })}</strong>
      <span>{$t(`eco.where.${worn.slot}` as Key)}</span>
      {#if SEE[worn.slot]}<a class="btn small" href={SEE[worn.slot]}>{$t('eco.where.see')} →</a>{/if}
    </div>
  </div>
{/if}

<style>
  .worn {
    position: fixed;
    z-index: 980;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - 32px));
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 16px 16px 16px 14px;
    border-radius: 20px;
    border: 2px solid var(--gold);
    background: var(--card);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  }
  .w-art {
    flex: none;
    width: 92px;
    border-radius: 14px;
    overflow: hidden;
  }
  .w-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
    min-width: 0;
  }
  .w-text strong {
    font-size: 16px;
  }
  .w-text span {
    font-size: 14px;
    color: var(--text-2);
  }
  .w-x {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .shop {
    max-width: 1180px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 26px;
  }
  /* ---- the hero */
  .hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
    gap: 24px;
    align-items: center;
    padding: 28px;
    border-radius: 28px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--border));
    background: linear-gradient(140deg, #1d2f63 0%, #121d3d 55%, #0d1730 100%);
    color: #eef3ff;
  }
  :global(:root[data-theme='light']) .hero {
    background: linear-gradient(140deg, #fff7e3 0%, #fff 60%);
    color: var(--text);
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(60% 90% at 100% 0%, rgba(237, 176, 64, 0.28), transparent 60%),
      radial-gradient(40% 60% at 0% 100%, rgba(124, 92, 240, 0.25), transparent 60%);
    pointer-events: none;
  }
  .hero-text {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(237, 176, 64, 0.16);
    color: var(--gold);
    font-size: 12.5px;
    font-weight: 700;
  }
  .hero h1 {
    font-size: clamp(38px, 5vw, 58px);
    background: linear-gradient(180deg, #fff6d8, #edb040 70%, #c98a1b);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  :global(:root[data-theme='light']) .hero h1 {
    background: linear-gradient(180deg, #c98a1b, #7a4f08);
    -webkit-background-clip: text;
    background-clip: text;
  }
  .hero p {
    margin: 0;
    max-width: 520px;
    color: color-mix(in srgb, currentColor 75%, transparent);
    font-size: 16px;
  }
  .hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
  .showcase {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(5, 10, 26, 0.55);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  }
  :global(:root[data-theme='light']) .showcase {
    background: #fff;
    border-color: var(--border);
  }
  .sc-banner {
    position: relative;
    height: 86px;
  }
  .sc-plain {
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, #233a78, #182b5c);
  }
  :global(:root[data-theme='light']) .sc-plain {
    background: linear-gradient(120deg, #f3e6c6, #e9d8b0);
  }
  .sc-body {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 14px;
    padding: 0 18px;
    margin-top: -34px;
  }
  .sc-who {
    display: flex;
    flex-direction: column;
    padding-bottom: 4px;
    min-width: 0;
  }
  .sc-name {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sc-rank {
    font-size: 13px;
    color: var(--muted);
    font-weight: 700;
  }
  .sc-bal {
    display: flex;
    gap: 18px;
    padding: 14px 18px 18px;
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 20px;
  }
  .sc-bal span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sc-cap {
    position: absolute;
    top: 10px;
    right: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .g {
    color: #ffd76a;
  }
  .m {
    color: #8fe6f5;
  }
  :global(:root[data-theme='light']) .g {
    color: #8a5a12;
  }
  :global(:root[data-theme='light']) .m {
    color: #0e6b85;
  }
  .note {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px dashed var(--border);
    color: var(--text-2);
    font-size: 14px;
  }
  .linkish {
    border: 0;
    background: none;
    padding: 0;
    color: var(--gold);
    font-weight: 800;
    cursor: pointer;
  }
  /* ---- deals and featured */
  .sec-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }
  .timer {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, #ef4444 16%, transparent);
    color: #fca5a5;
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  :global(:root[data-theme='light']) .timer {
    color: #b91c1c;
  }
  .deal-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .featured {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
    gap: 26px;
    align-items: center;
    padding: 22px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--rc) 60%, var(--border));
    background:
      radial-gradient(70% 120% at 0% 50%, color-mix(in srgb, var(--rc) 22%, transparent), transparent 60%),
      var(--card);
    overflow: hidden;
  }
  .f-art {
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--rc) 60%, transparent), 0 20px 40px rgba(0, 0, 0, 0.35);
  }
  .f-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .f-kicker {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .f-text h2 {
    font-size: clamp(30px, 4vw, 44px);
  }
  .f-text p {
    margin: 0;
    color: var(--text-2);
  }
  .f-buy {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  /* ---- the catalogue */
  .catalog {
    display: flex;
    flex-direction: column;
    gap: 14px;
    scroll-margin-top: 76px;
  }
  /* The section tabs stay in sight under the site's top bar while the Shop scrolls. */
  .tabs {
    position: sticky;
    top: 70px;
    z-index: 5;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 4px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tabs button {
    flex: none;
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--text-2);
    font-weight: 700;
    font-size: 14.5px;
    cursor: pointer;
    white-space: nowrap;
  }
  .tabs button:hover {
    color: var(--text);
    background: var(--raised);
  }
  .tabs button.on {
    background: var(--action);
    color: var(--on-action);
  }
  .filters {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .pieces-link {
    margin-left: auto;
    font-size: 13.5px;
    font-weight: 700;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 14px;
  }
  /* A section: its heading (icon, name, what it is, how many owned), then its items. */
  .sec {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 10px;
    scroll-margin-top: 140px;
  }
  .sec + .sec {
    margin-top: 14px;
    padding-top: 22px;
    border-top: 1px solid var(--border-soft);
  }
  .sec-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sec-ico {
    width: 46px;
    height: 46px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 14px;
    font-size: 24px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--gold) 26%, var(--raised)), var(--raised));
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--border));
  }
  .sec-t {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sec-t h3 {
    font-size: 24px;
  }
  .sec-n {
    flex: none;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--border);
    font-weight: 800;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--text-2);
  }
  .sub-h {
    margin: 4px 0 -2px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .listen {
    gap: 8px;
  }
  .empty {
    color: var(--muted);
    padding: 24px;
    text-align: center;
  }
  /* ---- one item */
  .r-common {
    --rc: #a8a29e;
  }
  .r-rare {
    --rc: #4c9bff;
  }
  .r-epic {
    --rc: #b77cff;
  }
  .r-legendary {
    --rc: #ff8a3d;
  }
  .r-royal {
    --rc: #ff5a6e;
  }
  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    text-align: left;
    border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--rc) 35%, var(--border));
    background: linear-gradient(180deg, color-mix(in srgb, var(--rc) 8%, var(--card)), var(--card));
    color: var(--text);
    cursor: pointer;
    overflow: hidden;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.4, 0.5, 1),
      box-shadow 0.18s,
      border-color 0.18s;
  }
  .item:hover {
    transform: translateY(-4px);
    border-color: var(--rc);
    box-shadow: 0 14px 34px color-mix(in srgb, var(--rc) 25%, rgba(0, 0, 0, 0.35));
  }
  .item:focus-visible {
    outline: 2px solid var(--rc);
  }
  .item.on {
    border: 2px solid var(--win);
  }
  .item.r-legendary,
  .item.r-royal {
    background: linear-gradient(180deg, color-mix(in srgb, var(--rc) 16%, var(--card)), var(--card) 70%);
  }
  .item.r-legendary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.12) 50%, transparent 60%);
    background-size: 250% 100%;
    animation: cardshine 4.5s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes cardshine {
    0% {
      background-position: 130% 0;
    }
    50%,
    100% {
      background-position: -130% 0;
    }
  }
  .art-wrap {
    position: relative;
    display: block;
    padding: 10px 10px 0;
  }
  .ribbon {
    position: absolute;
    top: 18px;
    left: 0;
    padding: 3px 10px 3px 12px;
    border-radius: 0 8px 8px 0;
    background: linear-gradient(90deg, #dc2626, #ef4444);
    color: #fff;
    font-weight: 800;
    font-size: 13px;
    box-shadow: 0 4px 10px rgba(220, 38, 38, 0.4);
  }
  .anim {
    position: absolute;
    top: 16px;
    right: 16px;
    font-size: 14px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
  }
  .flag-on {
    position: absolute;
    left: 16px;
    bottom: 6px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--win);
    color: #fff;
    font-size: 11.5px;
    font-weight: 800;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px 12px;
  }
  .rar {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rc);
  }
  :global(:root[data-theme='light']) .rar {
    filter: brightness(0.7) saturate(1.3);
  }
  .nm {
    font-family: var(--font-title);
    font-weight: 700;
    font-size: 17px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    min-height: 26px;
  }
  .price {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 17px;
  }
  .price.big {
    font-size: 24px;
    gap: 7px;
  }
  .price.deal .num {
    color: #4ade80;
  }
  :global(:root[data-theme='light']) .price.deal .num {
    color: #15803d;
  }
  .was {
    color: var(--muted);
    font-size: 0.75em;
    font-weight: 600;
  }
  .state {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--muted);
  }
  .state.ok {
    color: var(--win);
  }
  .state.big {
    font-size: 16px;
  }
  .state.lock {
    color: var(--rc);
    font-size: 12px;
  }
  .state.short {
    color: var(--muted);
    opacity: 0.7;
  }
  .pwrap.dim {
    opacity: 0.6;
  }
  .item.got:not(.on) .art-wrap {
    opacity: 0.95;
  }
  /* ---- the item's sheet */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 700;
    background: rgba(4, 8, 20, 0.7);
    backdrop-filter: blur(4px);
  }
  .sheet {
    position: fixed;
    z-index: 701;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: min(820px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid color-mix(in srgb, var(--rc) 55%, var(--border));
    background:
      radial-gradient(70% 70% at 0% 0%, color-mix(in srgb, var(--rc) 20%, transparent), transparent 70%),
      var(--card);
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.6);
  }
  .x {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-2);
    display: grid;
    place-items: center;
    cursor: pointer;
    z-index: 2;
  }
  .s-art {
    border-radius: 18px;
    overflow: hidden;
    align-self: start;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--rc) 50%, transparent);
  }
  .s-text {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    padding-top: 6px;
  }
  .s-text h2 {
    font-size: 38px;
  }
  .s-text p {
    margin: 0;
    color: var(--text-2);
  }
  .s-slot {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--muted) !important;
  }
  .s-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    width: 100%;
    margin-top: 6px;
  }
  .confirm {
    width: 100%;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 8%, transparent);
  }
  .confirm p {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0 0 6px;
    color: var(--text) !important;
    font-weight: 700;
  }
  .confirm .s-actions .btn {
    flex: 1;
  }
  .royal,
  .short {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-weight: 700;
    color: var(--text-2);
  }
  .bar {
    display: block;
    height: 8px;
    border-radius: 999px;
    background: var(--bg);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #f7d27a, #edb040);
    border-radius: inherit;
  }
  .bought {
    padding: 10px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--win) 18%, transparent);
    color: var(--win);
    font-weight: 800;
    font-size: 17px;
  }
  .err {
    color: var(--loss) !important;
    font-weight: 700;
  }
  @media (max-width: 900px) {
    .hero {
      grid-template-columns: 1fr;
      padding: 22px 18px;
    }
    .featured {
      grid-template-columns: minmax(0, 150px) minmax(0, 1fr);
      gap: 16px;
      padding: 16px;
    }
  }
  @media (max-width: 767px) {
    .tabs {
      top: 58px;
    }
    .catalog {
      scroll-margin-top: 62px;
    }
  }
  @media (max-width: 640px) {
    .deal-grid {
      grid-template-columns: repeat(3, minmax(150px, 1fr));
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: 4px;
    }
    .deal-grid > :global(*) {
      scroll-snap-align: start;
    }
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .featured {
      grid-template-columns: 1fr;
    }
    .sheet {
      grid-template-columns: 1fr;
      top: auto;
      bottom: 0;
      translate: -50% 0;
      width: 100vw;
      border-radius: 24px 24px 0 0;
      max-height: 92vh;
      padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
    }
    .s-art {
      max-width: 260px;
      width: 100%;
      justify-self: center;
    }
    .s-text h2 {
      font-size: 30px;
    }
    .nm {
      font-size: 15.5px;
    }
    .meta {
      padding: 8px 10px 10px;
    }
  }
</style>
