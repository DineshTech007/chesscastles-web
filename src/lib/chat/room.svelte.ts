import { Room, type RoomStatus } from '$lib/classroom/api';
import type { ChatLine, Guard } from './chat';

/**
 * A Lichess game's chat on Chess Castles (server/api-worker src/chat.ts: "chat:<game>"): the two players only, every
 * message read by Castle Guard. `here`: who has it open. `gone`: this game has no chat (against the computer, or not
 * a player of it).
 */
export class GameChatRoom {
  lines = $state<ChatLine[]>([]);
  guard = $state<Guard | undefined>();
  here = $state<string[]>([]);
  me = $state('');
  status = $state<RoomStatus>('connecting');
  gone = $state(false);
  private room: Room;

  constructor(gameId: string) {
    this.room = new Room(
      gameId,
      (m) => this.on(m),
      (s, why) => {
        this.status = s;
        if (s === 'closed' && why === 'refused') this.gone = true;
      },
      false,
      'chat',
    );
  }
  private on(m: any) {
    if (m.t === 'chat-state') {
      this.lines = m.lines;
      this.me = m.me;
      this.here = m.here;
    } else if (m.t === 'chat') this.lines = [...this.lines, m.line].slice(-40);
    else if (m.t === 'here') this.here = m.here;
    else if (m.t === 'guard') this.guard = { text: m.text, until: m.until ?? 0, at: Date.now() };
  }
  send(kind: ChatLine['kind'], text: string | number) {
    this.room.send({ t: 'chat', kind, text });
  }
  close() {
    this.room.close();
  }
}
