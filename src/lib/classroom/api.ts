/**
 * CastleClass (server/api-worker/src/classroom.ts): live classes. An admin makes players coaches with rights; a coach
 * makes classes, enrols students and teaches on one shared board; every change goes through the class's live room
 * (a WebSocket), which keeps the whole class state, so a student who drops out comes back to the board as it is.
 * Admins see every class, watch any live class unseen, and get the issues list.
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
  /** I teach it, or I am an admin (who manages every class). */
  manage: boolean;
  /** Coming sessions, soonest first. */
  sessions: Session[];
  /** The coach's announcements, newest first. */
  notes: Note[];
  /** Past classes (the coach only). */
  past: Past[];
}
export interface Session {
  at: number;
  minutes: number;
  title: string;
}
export interface Note {
  id: string;
  text: string;
  at: number;
}
export interface Past {
  started: number;
  ended: number;
  people: number;
  top: string;
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
  role?: 'coach' | 'student' | 'admin';
  online?: string[];
  reports?: Report[];
  sessions?: Session[];
  notes?: Note[];
  past?: Past[];
  /** The class's all-time leaderboard. */
  leaderboard?: (ScoreRow & { uid: string })[];
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
  /** Times and ms the student left the class tab during the question (fair play without a camera). */
  away?: number;
  awayMs?: number;
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
  /** The camera (or the coach's shared screen) is on. */
  cam: boolean;
  /** The coach shares the screen. */
  screen?: boolean;
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
  /** Students see the games database (the coach always does). */
  db?: boolean;
  /** Students may switch their camera on. */
  cams?: boolean;
  /** Students see each other's cameras (else only the coach sees them). */
  peers?: boolean;
}

/** A game in the class: the coach's simul, students paired in the game zone, or the coach against one student. */
export interface Game {
  id: string;
  kind: 'simul' | 'pair' | 'coach';
  white: string;
  black: string;
  whiteName: string;
  blackName: string;
  root: string;
  moves: string[];
  result: '' | '1-0' | '0-1' | '1/2-1/2';
  reason: string;
  clock?: { white: number; black: number; inc: number; at: number };
  draw: string;
  started: number;
  awayW?: number;
  awayB?: number;
}

/** Homework: a summary in the list. */
export interface HomeworkSummary {
  id: string;
  title: string;
  kind: TaskKind;
  items: number;
  due: number;
  created: number;
  points: number;
  mine?: { solved: number; done: boolean; points: number; tried: number };
  done: number;
  started: number;
  top: { name: string; points: number; solved: number }[];
}
export interface HomeworkView {
  task: Task;
  due: number;
  progress: Record<string, Progress>;
  ranking: Row[];
  now: number;
}
export interface HomeworkReply {
  ok: boolean;
  reply?: string;
  ended?: 'solved' | 'failed';
  again?: boolean;
  ignored?: boolean;
  p: Progress;
  ranking?: Row[];
}

/** What an admin lets a coach do (admins may do everything). */
export interface Perms {
  classes: boolean;
  enrol: boolean;
  live: boolean;
  homework: boolean;
  video: boolean;
  games: boolean;
  pdf: boolean;
  maxClasses: number;
  maxStudents: number;
}
export type PermKey = Exclude<keyof Perms, 'maxClasses' | 'maxStudents'>;
export const PERM_LABELS: [PermKey, string, string][] = [
  ['classes', 'Make classes', 'Make and rename classes, plan sessions, announce'],
  ['enrol', 'Enrol students', 'Add and remove students in their classes'],
  ['live', 'Teach live', 'Start and run live classes'],
  ['homework', 'Homework', 'Set homework with a due date'],
  ['video', 'Camera and screen', "Their camera, screen sharing, and students' cameras"],
  ['games', 'Games', 'Simuls, the game zone, games against a student'],
  ['pdf', 'Puzzles from a PDF', 'Turn a puzzle PDF into questions or homework'],
];
export interface CoachRec {
  uid: string;
  name: string;
  perms: Perms;
  active: boolean;
  added: number;
  by: string;
  note: string;
}
export interface Issue {
  id: string;
  at: number;
  uid: string;
  name: string;
  role: string;
  classId: string;
  className: string;
  kind: 'report' | 'voice' | 'camera' | 'mic' | 'connection' | 'other';
  text: string;
  detail: string;
  resolved: number;
}
export interface Dashboard {
  /** May add, change and remove coaches (the owner and moderators). */
  manager?: boolean;
  totals: { coaches: number; classes: number; students: number; live: number; online: number; held7: number; minutes7: number; issues: number };
  live: { id: string; name: string; coach: string; coachName: string; since: number; students: number; online?: number; coachHere?: boolean; watching?: number; voice?: number; cams?: number; task?: string; games?: number }[];
  classes: { id: string; name: string; coach: string; coachName: string; students: number; live: number; created: number; last: number; held7: number; minutes7: number; next: number }[];
  coaches: { uid: string; name: string; admin: boolean; perms: Perms; active: boolean; added: number; note: string; classes: number; students: number; live: number; held7: number; minutes7: number; last: number; issues: number }[];
  issues: Issue[];
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const freshBoard = (): BoardView => ({ root: START_FEN, moves: [], ply: 0, orient: 'white', shapes: [], marks: {}, squares: false, blind: false, pawns: false, title: '', game: -1 });

/** The sign-in token. On a developer's computer a test player can stand in (the local test server takes it as the id). */
export async function token(): Promise<string> {
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
export const saveClass = (id: string, change: { name?: string; members?: Member[]; sessions?: Session[]; announce?: string; unannounce?: string; coach?: string; coachName?: string }) => call<{ ok: true; info: ClassInfo }>('PUT', `/${id}`, change);
export const deleteClass = (id: string) => call<{ ok: true }>('DELETE', `/${id}`);
export const iceServers = (): Promise<RTCIceServer[]> =>
  call<{ iceServers: RTCIceServer[] }>('GET', '/ice')
    .then((r) => r.iceServers)
    .catch(() => [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]);

export const classLink = (id: string) => `https://chesscastles.com/castleclass/${id}`;

/** My classes (a student sees CastleClass only once a coach enrols them in one), whether I am an admin, my coach record. */
export const classroomAccess = () => call<{ classes: ClassSummary[]; admin?: boolean; coach?: CoachRec | null }>('GET', '');
export const adminDashboard = () => call<Dashboard>('GET', '/admin');
export const saveCoach = (uid: string, change: { perms?: Partial<Perms>; active?: boolean; note?: string }) => call<{ ok: true; coach: CoachRec }>('PUT', `/coaches/${encodeURIComponent(uid)}`, change);
export const removeCoach = (uid: string) => call<{ ok: true }>('DELETE', `/coaches/${encodeURIComponent(uid)}`);
export const resolveIssue = (id: string, resolved = true) => call<{ ok: true }>('PUT', `/issues/${id}`, { resolved });
/** A problem outside a live class (inside one, the room passes it on with the class). */
export const reportIssue = (issue: { kind: Issue['kind']; text: string; detail?: string; classId?: string; className?: string }) => call<{ ok: true }>('POST', '/issues', issue);

export const homeworkList = (id: string) => call<{ homework: HomeworkSummary[] }>('GET', `/${id}/homework`).then((r) => r.homework);
export const setHomework = (id: string, hw: { kind: TaskKind; title: string; points: number; minus: number; tries: number; items: Item[]; due: number }) => call<{ id: string }>('POST', `/${id}/homework`, hw);
export const getHomework = (id: string, hid: string) => call<HomeworkView>('GET', `/${id}/homework/${hid}`);
export const homeworkTry = (id: string, hid: string, body: { item: number; uci?: string; cpu?: boolean }) => call<HomeworkReply>('POST', `/${id}/homework/${hid}/try`, body);
export const homeworkClaim = (id: string, hid: string, body: { item: number; result: 'win' | 'draw' | 'resign' }) => call<HomeworkReply>('POST', `/${id}/homework/${hid}/claim`, body);
export const deleteHomework = (id: string, hid: string) => call<{ ok: true }>('DELETE', `/${id}/homework/${hid}`);

export type RoomStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';
/** Why the room closed for good: the class ended, I was taken off it, it was removed, its coach changed, or I may not come in. */
export type ClosedWhy = 'ended' | 'removed' | 'deleted' | 'coach' | 'refused';

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
    /** An admin watching unseen. */
    private watch = false,
    /** Whose room: a class, or a Puzzle Racer race (src/lib/racer). */
    private kind: 'class' | 'race' = 'class',
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
    const url = `${API.replace(/^http/, 'ws')}/${this.kind}/${this.id}/live${this.watch ? '?watch=1' : ''}`;
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
      const why: ClosedWhy | undefined = e.code === 4000 ? 'ended' : e.code === 4003 ? 'removed' : e.code === 4004 ? 'deleted' : e.code === 4005 ? 'coach' : undefined;
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
    // An admin watching changes nothing: only problems go out (the room refuses the rest anyway).
    if (this.watch && (m as { t?: string })?.t !== 'issue') return false;
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
