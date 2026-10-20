<script lang="ts" module>
  /** Chess Castles' social accounts (more join here as they open: YouTube, WhatsApp Channel…). */
  export const SOCIAL = [{ id: 'instagram', name: 'Instagram', handle: '@chesscastles', href: 'https://www.instagram.com/chesscastles/' }] as const;
</script>

<script lang="ts">
  /**
   * "Follow us": the social accounts with their logos. `compact`: logos only (the sidebar footer).
   */
  import { t } from '$lib/i18n';
  import { track } from '$lib/analytics';

  let { compact = false }: { compact?: boolean } = $props();
</script>

{#snippet logo(id: string, size: number)}
  {#if id === 'instagram'}
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="ig-{size}" cx="30%" cy="107%" r="150%">
          <stop offset="0" stop-color="#fdf497" /><stop offset=".05" stop-color="#fdf497" /><stop offset=".45" stop-color="#fd5949" /><stop offset=".6" stop-color="#d6249f" /><stop offset=".9" stop-color="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-{size})" />
      <rect x="6" y="6" width="12" height="12" rx="3.6" fill="none" stroke="#fff" stroke-width="1.8" />
      <circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" stroke-width="1.8" />
      <circle cx="16.6" cy="7.4" r="1.1" fill="#fff" />
    </svg>
  {:else if id === 'facebook'}
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path d="M13.4 21.9v-7h2.35l.36-2.73H13.4v-1.74c0-.79.22-1.33 1.35-1.33h1.44V6.66a19 19 0 0 0-2.1-.11c-2.08 0-3.5 1.27-3.5 3.6v2.02H8.24v2.73h2.35v7a10 10 0 0 0 2.81 0z" fill="#fff" />
    </svg>
  {:else if id === 'whatsapp'}
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#25D366" />
      <path d="M12 5.6a6.4 6.4 0 0 0-5.5 9.7L5.6 18.4l3.2-.84A6.4 6.4 0 1 0 12 5.6zm3.75 9.05c-.16.44-.92.85-1.27.88-.34.03-.66.15-2.22-.46-1.88-.74-3.07-2.67-3.16-2.8-.09-.12-.75-1-.75-1.9s.47-1.35.64-1.53c.17-.18.37-.23.49-.23h.35c.11 0 .27-.04.42.32.16.37.53 1.28.58 1.37.05.09.08.2.02.32-.06.12-.09.2-.18.31l-.27.31c-.09.09-.18.19-.08.37.1.18.46.75.98 1.22.68.6 1.24.79 1.42.88.18.09.28.07.39-.04.11-.12.45-.53.57-.71.12-.18.24-.15.4-.09.16.06 1.04.49 1.22.58.18.09.3.13.34.2.05.08.05.45-.11.89z" fill="#fff" />
    </svg>
  {/if}
{/snippet}

{#if compact}
  <span class="mini">
    {#each SOCIAL as s (s.id)}
      <a href={s.href} target="_blank" rel="noopener" aria-label="Chess Castles on {s.name}" title="{s.name} {s.handle}" onclick={() => track('feature', `social_${s.id}`)}>{@render logo(s.id, 18)}</a>
    {/each}
  </span>
{:else}
  <section class="follow card" aria-label={$t('social.follow')}>
    <div class="ft">
      <strong>{$t('social.follow')}</strong>
      <span class="label">{$t('social.why')}</span>
    </div>
    <div class="links">
      {#each SOCIAL as s (s.id)}
        <a class="btn soc" href={s.href} target="_blank" rel="noopener" onclick={() => track('feature', `social_${s.id}`)}>{@render logo(s.id, 22)}<span>{s.name} <span class="h">{s.handle}</span></span></a>
      {/each}
    </div>
  </section>
{/if}

<style>
  .mini {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .mini a {
    display: inline-flex;
    border-radius: 6px;
  }
  .follow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 14px 18px;
  }
  .ft {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ft strong {
    font-size: 16px;
  }
  .links {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .soc {
    gap: 8px;
    min-height: 44px;
  }
  .h {
    color: var(--text-2);
    font-weight: 600;
  }
</style>
