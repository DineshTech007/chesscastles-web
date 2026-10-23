import { writable } from 'svelte/store';

/** The phone's menu drawer (src/lib/components/MenuDrawer.svelte): opened by the menu button at the top left and the last tab. */
export const menuOpen = writable(false);
