/**
 * Classroom (server/api-worker/src/classroom.ts): live classes. A coach (an admin, for now) makes a class, picks its
 * students, and teaches on one shared board; every change goes through the class's live room (a WebSocket), which
 * keeps the whole class state, so a student who drops out comes back to the board exactly as it is.
 */
import { API } from '$lib/api';
import { auth } from '$lib/auth';

export interface ClassSummary {
  id: string;
  name: string;
  coach: string;
  coachName: string;
  students: number;
  /** Since when the coach is in the live room (0: not live). */
  live: number;
  /** I teach it. */
  mine: boolean;
}
export interface Member {
  uid: string;
  name: string;
}
export interface Report {
  started: number;
  ended: number;
  people: { uid: string; name: string; minutes: number }[];
  tasks: { title: string; items: number; top: { name: string; points: number; solved: number; ms: number }[] }[];
  scores: (ScoreRow & { uid: string })[];
}
export interface ClassInfo {
  id: string;
  name: string;
  coach: string;
  coachName: string;
  members: Member[];
  role?: 'coach' | 'student';
  online?: string[];
  reports?: Report[];
}
export interface Shape {
  orig: string;
  dest?: string;
  brush: string;
}
export interface BoardView {
  root: string;
  moves: string[];
  ply: number;
  orient: 'white' | 'black';
  shapes: Shape[];
  marks: Record<string, string>;
  squares: boolean;
  blind: boolean;
  pawns: boolean;
  title: string;
  game: number;
}
export interface Item {
  fen: string;
  line: string[];
  goal: '' | 'mate' | 'win' | 'draw';
  elo: number;
  title: string;
  ref: string;
  rating: number;
}
export type TaskKind = 'best' | 'play' | 'set';
export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  items: Item[];
  seconds: number;
  points: number;
  minus: number;
  tries: number;
  started: number;
  ends: number;
  over: boolean;
  reveal: boolean;
}
export interface ItemResult {
  solved: boolean;
  wrong: number;
  ms: number;
  points: number;
  moves: string[];
  /** Each wrong try's moves (the wrong move last). */
  tried: string[][];
}
export interface Progress {
  uid: string;
  name: string;
  item: number;
  moves: string[];
  wrong: number;
  tried: string[][];
  itemStart: number;
  results: ItemResult[];
  points: number;
  done: boolean;
  at: number;
}
export interface Row {
  uid: string;
  name: string;
  points: number;
  solved: number;
  wrong: number;
  ms: number;
  done: boolean;
  item: number;
}
export interface ScoreRow {
  name: string;
  points: number;
  solved: number;
  ms: number;
  tasks: number;
}
export interface Person {
  uid: string;
  name: string;
  coach: boolean;
  online: boolean;
  hand: number;
  voice: boolean;
  mic: boolean;
  allow: boolean;
}
export interface ChatMsg {
  id: number;
  uid: string;
  name: string;
  text: string;
  at: number;
  coachOnly: boolean;
}
export interface Settings {
  /** The engine on the students' boards too. */
  engine: boolean;
  /** Students may switch their microphone on (else only those the coach lets speak). */
  talk: boolean;
  /** Students see the live leaderboard while a question runs. */
  lb: boolean;
  /** Students see the move list. */
  moves: boolean;
  /** Students see each other's messages. */
  chat: boolean;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const freshBoard = (): BoardView => ({ root: START_FEN, moves: [], ply: 0, orient: 'white', shapes: [], marks: {}, squares: false, blind: false, pawns: false, title: '', game: -1 });

/** The sign-in token. On a developer's computer a test player can stand in (the local test server takes it as the id). */
async function token(): Promise<string> {
  if (import.meta.env.DEV) {
    const dev = typeof localStorage !== 'undefined' ? localStorage.getItem('cc.devUid') : null;
    if (dev) return dev;
  }
  const t = await auth.currentUser?.getIdToken().catch(() => undefined);
  if (!t) throw new Error('Sign in to use the classroom.');
  return t;
}
export const devPlayer = (): string | undefined => {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') return undefined;
  return localStorage.getItem('cc.devUid') ?? undefined;
};

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const t = await token();
  const res = await fetch(`${API}/class${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Something went wrong. Try again.');
  return j as T;
}

export const myClasses = () => call<{ classes: ClassSummary[] }>('GET', '').then((r) => r.classes);
export const newClass = (name: string) => call<{ id: string }>('POST', '', { name });
export const getClass = (id: string) => call<ClassInfo>('GET', `/${id}`);
export const saveClass = (id: string, change: { name?: string; members?: Member[] }) => call<{ ok: true; info: ClassInfo }>('PUT', `/${id}`, change);
export const deleteClass = (id: string) => call<{ ok: true }>('DELETE', `/${id}`);
export const iceServers = (): Promise<RTCIceServer[]> =>
  call<{ iceServers: RTCIceServer[] }>('GET', '/ice')
    .then((r) => r.iceServers)
    .catch(() => [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]);

export const classLink = (id: string) => `https://chesscastles.com/classroom/${id}`;

export type RoomStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';
/** Why the room closed for good: the class ended, I was taken off it, it was removed, or I may not come in. */
export type ClosedWhy = 'ended' | 'removed' | 'deleted' | 'refused';

/**
 * The live room: one WebSocket that comes back by itself after a drop (each time with the whole class state), and a
 * keep-alive the room answers without waking up. `offset`: the room's clock minus this device's, for fair timers.
 */
export class Room {
  status: RoomStatus = 'connecting';
  offset = 0;
  private ws?: WebSocket;
  private tries = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private ping?: ReturnType<typeof setInterval>;
  private stopped = false;

  constructor(
    private id: string,
    private onmessage: (m: any) => void,
    private onstatus: (s: RoomStatus, why?: ClosedWhy) => void,
  ) {
    void this.connect();
  }

  private async connect() {
    if (this.stopped) return;
    let t: string;
    try {
      t = await token();
    } catch {
      this.set('closed', 'refused');
      return;
    }
    const url = `${API.replace(/^http/, 'ws')}/class/${this.id}/live`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, ['cc', encodeURIComponent(t)]);
    } catch {
      this.retry();
      return;
    }
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.tries = 0;
      this.set('open');
      clearInterval(this.ping);
      this.ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 20_000);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m: any;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (typeof m.now === 'number') this.offset = m.now - Date.now();
      this.onmessage(m);
    };
    ws.onclose = (e) => {
      clearInterval(this.ping);
      if (this.ws !== ws) return;
      const why: ClosedWhy | undefined = e.code === 4000 ? 'ended' : e.code === 4003 ? 'removed' : e.code === 4004 ? 'deleted' : undefined;
      if (why) return this.set('closed', why);
      // Refused before it opened, several times over: not in this class (or signed out).
      if (!opened && this.tries >= 3) return this.set('closed', 'refused');
      this.retry();
    };
  }

  private retry() {
    if (this.stopped) return;
    this.set('reconnecting');
    const wait = Math.min(8000, 600 * 2 ** this.tries++);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.connect(), wait);
  }

  private set(s: RoomStatus, why?: ClosedWhy) {
    this.status = s;
    this.onstatus(s, why);
  }

  /** The room's time now (ms). */
  now() {
    return Date.now() + this.offset;
  }

  send(m: unknown): boolean {
    if (this.ws?.readyState !== 1) return false;
    this.ws.send(JSON.stringify(m));
    return true;
  }

  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.ping);
    this.ws?.close(1000);
  }
}
