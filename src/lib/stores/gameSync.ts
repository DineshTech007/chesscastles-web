import { get, writable } from 'svelte/store';
import { friendGames, uploadGames } from '$lib/social';
import { gamesOf } from './me';
import { myGames } from './myGames';

export type SyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'done'; total: number; added: number; sent: number; at: number }
  | { status: 'error'; message: string };

/** How the last sync went, for My games. */
export const syncState = writable<SyncState>({ status: 'idle' });

let running: Promise<void> | undefined;
let runningFor = '';

/**
 * My games on every device: the account's finished games come into this
 * browser, and this browser's finished games (of this account) go up to it.
 * One sync at a time; asking again while one runs waits for it.
 */
export function syncGames(uid: string): Promise<void> {
  if (running && runningFor === uid) return running;
  runningFor = uid;
  running = (async () => {
    syncState.set({ status: 'syncing' });
    try {
      const server = await friendGames(uid);
      const onServer = new Set(server.map((g) => g.id));
      const added = myGames.merge(server.map((g) => ({ ...g, owner: uid })));
      const toSend = gamesOf(get(myGames), uid)
        .filter((g) => g.result !== '*' && !onServer.has(g.id))
        .map((g) => ({ ...g, owner: uid }));
      for (let i = 0; i < toSend.length; i += 100) await uploadGames(toSend.slice(i, i + 100));
      syncState.set({ status: 'done', total: gamesOf(get(myGames), uid).length, added, sent: toSend.length, at: Date.now() });
    } catch (e) {
      syncState.set({ status: 'error', message: e instanceof Error ? e.message : 'Your games could not be synced.' });
    } finally {
      running = undefined;
    }
  })();
  return running;
}
