<script lang="ts">
  /**
   * A reward the moment it is won: "+15 gold, won a game", a level, a Royal item. Coins and gems fly into the wallet
   * in the corner (none when the device asks for less motion). Small and brief, never in the way of the board.
   */
  import { onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import { ITEM } from './core';
  import { dismissToast, toasts, type Toast } from './wallet';
  import { fmt } from './ui';
  import { t, type Key } from '$lib/i18n';
  import { rewardSound } from '$lib/sound';

  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let seen = new Set<number>();
  const els = new Map<number, HTMLElement>();

  $effect(() => {
    for (const toast of $toasts) {
      if (seen.has(toast.id)) continue;
      seen.add(toast.id);
      const big = toast.why === 'level' || toast.why === 'unlock' || toast.why === 'streak' || toast.why === 'bonus' || toast.why === 'login' || toast.why === 'history';
      timers.set(
        toast.id,
        setTimeout(() => dismissToast(toast.id), big ? 4200 : 2600),
      );
      requestAnimationFrame(() => flyIn(toast));
      chime(toast);
    }
  });
  onDestroy(() => timers.forEach((x) => clearTimeout(x)));

  function reg(node: HTMLElement, id: number) {
    els.set(id, node);
    return { destroy: () => els.delete(id) };
  }

  /** Coins (and gems) from the toast to the wallet. */
  function flyIn(toast: Toast) {
    if (typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const from = els.get(toast.id)?.getBoundingClientRect();
    if (!from) return;
    const sends: [string, number][] = [];
    if (toast.gold > 0) sends.push(['[data-coin-target]', Math.min(6, 2 + Math.floor(toast.gold / 25))]);
    if (toast.gems > 0) sends.push(['[data-gem-target]', Math.min(5, 1 + toast.gems)]);
    for (const [sel, n] of sends) {
      const target = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.offsetParent)?.getBoundingClientRect();
      if (!target) continue;
      for (let i = 0; i < n; i++) {
        const s = document.createElement('div');
        s.className = 'cc-flyer';
        s.textContent = sel.includes('gem') ? '💎' : '🪙';
        s.style.left = `${from.left + 18 + Math.random() * 30}px`;
        s.style.top = `${from.top + from.height / 2 - 10}px`;
        document.body.appendChild(s);
        const dx = target.left + target.width / 2 - (from.left + 30);
        const dy = target.top + target.height / 2 - (from.top + from.height / 2);
        const a = s.animate(
          [
            { transform: 'translate(0,0) scale(0.6)', opacity: 0 },
            { transform: `translate(${dx * 0.3 + (Math.random() * 40 - 20)}px, ${dy * 0.3 - 30}px) scale(1.15)`, opacity: 1, offset: 0.35 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.2 },
          ],
          { duration: 700 + i * 70, delay: i * 60, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' },
        );
        a.onfinish = () => s.remove();
      }
    }
  }

  /** One sound for a burst of rewards: a level or a Royal item, else a gem's sparkle, else a coin (src/lib/sound.ts). */
  let lastSound = 0;
  function chime(x: Toast) {
    if (Date.now() - lastSound < 300 || x.why === 'login') return;
    lastSound = Date.now();
    rewardSound(x.why === 'level' || x.why === 'unlock' || x.why === 'streak' || x.why === 'bonus' ? 'level' : x.gems > 0 ? 'gem' : 'coin');
  }

  const label = (x: Toast) => {
    if (x.why === 'level') return $t('eco.toast.level', { n: x.n ?? 0 });
    if (x.why === 'streak') return $t('eco.toast.streak', { n: x.n ?? 0 });
    if (x.why === 'unlock') return `${$t('eco.toast.unlock')} ${x.item ? ITEM[x.item]?.name : ''}`;
    if (x.why === 'quest' && x.item) return `${$t('eco.why.quest')}: ${$t(`eco.q.${x.item}` as Key)}`;
    return $t(`eco.why.${x.why}` as Key);
  };
  const icon = (x: Toast) => ({ level: '⭐', streak: '🔥', unlock: '👑', login: '🎁', quest: '📜', bonus: '🏆', award: '🏅', welcome: '🏰', win: '♞', winOnline: '♞', cupWin: '🏆', cupPodium: '🥉', rush: '⚡', race: '🏎️', raceWin: '🏁', history: '📜', lesson: '📖', line: '🌳', daily: '🧩', puzzle: '🧩', puzzleClean: '🧩' })[x.why] ?? '✨';
</script>

<div class="toasts" aria-live="polite">
  {#each $toasts as x (x.id)}
    <div class="toast" class:big={x.why === 'level' || x.why === 'unlock' || x.why === 'streak' || x.why === 'bonus'} use:reg={x.id} in:fly={{ y: -14, duration: 240 }} out:fly={{ x: 30, duration: 220 }}>
      <span class="ico" aria-hidden="true">{icon(x)}</span>
      <span class="txt">
        <span class="what">{label(x)}</span>
        <span class="amts">
          {#if x.gold}<span class="g"><Coin size={15} />{x.gold > 0 ? '+' : ''}{fmt.format(x.gold)}</span>{/if}
          {#if x.gems}<span class="m"><Gem size={14} />{x.gems > 0 ? '+' : ''}{fmt.format(x.gems)}</span>{/if}
        </span>
      </span>
      <button class="x" onclick={() => dismissToast(x.id)} aria-label="Close">×</button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: 70px;
    right: 22px;
    z-index: 900;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 210px;
    max-width: 320px;
    padding: 9px 10px 9px 12px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
    background: linear-gradient(180deg, color-mix(in srgb, var(--raised) 92%, #000), var(--card));
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    color: var(--text);
  }
  .toast.big {
    border-color: var(--gold);
    background:
      radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--gold) 28%, transparent), transparent 60%),
      linear-gradient(180deg, color-mix(in srgb, var(--raised) 92%, #000), var(--card));
  }
  .ico {
    font-size: 22px;
    line-height: 1;
  }
  .big .ico {
    font-size: 28px;
    animation: pop 0.6s cubic-bezier(0.3, 1.8, 0.5, 1);
  }
  @keyframes pop {
    0% {
      transform: scale(0.3) rotate(-20deg);
    }
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .what {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .big .what {
    color: var(--text);
    font-size: 14px;
  }
  .amts {
    display: flex;
    gap: 10px;
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 17px;
    font-variant-numeric: tabular-nums;
  }
  .amts span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
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
  .x {
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 18px;
    cursor: pointer;
  }
  .x:hover {
    background: var(--raised);
  }
  :global(.cc-flyer) {
    position: fixed;
    z-index: 950;
    font-size: 20px;
    pointer-events: none;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  }
  @media (max-width: 767px) {
    .toasts {
      top: 62px;
      right: 50%;
      transform: translateX(50%);
      align-items: center;
    }
  }
</style>
