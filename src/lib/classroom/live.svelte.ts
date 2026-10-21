/**
 * The live class as the page sees it: everything the room sends, kept in one place (Svelte state), and what the coach
 * or a student can do. The room is the single source of truth: after a drop the page gets the whole state again.
 */
import { freshBoard, iceServers, Room, type BoardView, type ChatMsg, type ClosedWhy, type Game, type Note, type Person, type Progress, type Report, type RoomStatus, type Row, type ScoreRow, type Session, type Settings, type Task } from './api';
import { Voice } from './voice';
import { sounds } from '$lib/sound';

export interface Tried {
  task: string;
  ok: boolean;
  reply?: string;
  ended?: 'solved' | 'failed';
  again?: boolean;
  late?: boolean;
  p: Progress;
  at: number;
}
export interface Reaction {
  emoji: string;
  text: string;
  to: string;
  name: string;
  at: number;
}

/** The camera at a size every webcam can give; some refuse the preferred one, so plain video is tried next. */
async function camera(small = false): Promise<MediaStream> {
  try {
    const size = small ? { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } } : { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20 } };
    return await navigator.mediaDevices.getUserMedia({ video: size, audio: false });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'NotFoundError' || name === 'SecurityError') throw e;
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

/**
 * Why the camera did not start, and what to do (owner, 2026-10-22: "The camera could not start" said too little).
 * A page opened before an update still carries the old rule that blocked cameras: a reload fixes it.
 */
export function cameraTrouble(e: unknown): string {
  const name = (e as DOMException)?.name ?? '';
  const doc = document as unknown as { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (policy && !policy.allowsFeature('camera')) return 'This page is from before an update that allows cameras: reload it (Ctrl+R or F5), then try again.';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'The camera is blocked. Click the camera or lock icon in the address bar and allow the camera for chesscastles.com; on Windows also check Settings > Privacy > Camera (allow apps and the browser).';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this computer. Plug one in, or share your screen instead.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Another app is using the camera (Zoom, Meet, Teams, the Camera app). Close it, then try again.';
  return `The camera could not start (${name || 'unknown reason'}). Reload the page and try again.`;
}

export class Live {
  status = $state<RoomStatus>('connecting');
  closed = $state<ClosedWhy | undefined>();
  me = $state<{ uid: string; name: string; coach: boolean }>({ uid: '', name: '', coach: false });
  info = $state<{ id: string; name: string; coach: string; coachName: string; members: { uid: string; name: string }[]; notes?: Note[]; sessions?: Session[] }>({ id: '', name: '', coach: '', coachName: '', members: [] });
  board = $state<BoardView>(freshBoard());
  holder = $state('');
  chat = $state<ChatMsg[]>([]);
  unread = $state(0);
  settings = $state<Settings>({ engine: false, talk: true, lb: true, moves: true, chat: false, db: false, cams: true, peers: true });
  people = $state<Person[]>([]);
  task = $state<Task | undefined>();
  /** Everyone's progress (the coach); a student has only their own. */
  progress = $state<Record<string, Progress>>({});
  lb = $state<Row[]>([]);
  session = $state<{ started: number; scores: (ScoreRow & { uid: string })[]; tasks: Report['tasks'] }>({ started: 0, scores: [], tasks: [] });
  ended = $state<Report | undefined>();
  /** The class's all-time leaderboard (every class so far, today's included). */
  allTime = $state<(ScoreRow & { uid: string })[]>([]);
  games = $state<Game[]>([]);
  /** A new announcement from the coach, shown on top for a while. */
  note = $state<Note | undefined>();
  /** Homework just set (a student is told). */
  newHomework = $state<{ id: string; title: string; due: number } | undefined>();
  /** The coach's video (a student's view), and the coach's own camera or screen on. */
  coachVideo = $state<MediaStream | undefined>();
  /** The students' cameras (the coach's view), by uid. */
  videos = $state<Record<string, MediaStream>>({});
  camOn = $state<'' | 'camera' | 'screen'>('');
  localVideo = $state<MediaStream | undefined>();
  tried = $state<Tried | undefined>();
  hint = $state<{ task: string; item: number; square: string } | undefined>();
  reaction = $state<Reaction | undefined>();
  notice = $state('');
  error = $state('');
  /** The room's clock, ticking (for timers). */
  now = $state(Date.now());
  // Voice
  inVoice = $state(false);
  micOn = $state(false);
  micError = $state('');
  levels = $state<Record<string, number>>({});
  /** Each voice/video connection's state, by uid (the gallery says when one cannot connect). */
  peerStates = $state<Record<string, string>>({});
  relayed = $state(false);
  joiningVoice = $state(false);

  readonly room: Room;
  private voice?: Voice;
  private tick?: ReturnType<typeof setInterval>;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  chatOpen = false;

  constructor(id: string) {
    this.room = new Room(
      id,
      (m) => this.on(m),
      (s, why) => {
        this.status = s;
        if (why) this.closed = why;
        if (s === 'closed') this.leaveVoice();
      },
    );
    let n = 0;
    this.tick = setInterval(() => {
      this.now = this.room.now();
      if (++n % 4 || !this.voice) return;
      const st = this.voice.states();
      if (JSON.stringify(st) !== JSON.stringify(this.peerStates)) this.peerStates = st;
    }, 250);
    document.addEventListener('visibilitychange', this.onAway);
    window.addEventListener('blur', this.onAway);
    window.addEventListener('focus', this.onAway);
  }

  /**
   * Fair play without a camera: during a question or a game, a student's page going to the background (another tab
   * or app) is told to the room, and the coach sees it beside the student's answer or game.
   */
  private wasAway = false;
  private onAway = () => {
    const away = document.visibilityState === 'hidden' || !document.hasFocus();
    if (away === this.wasAway || this.coach) return;
    this.wasAway = away;
    const busy = (this.task && !this.task.over) || this.games.some((g) => !g.result && (g.white === this.me.uid || g.black === this.me.uid));
    if (busy || !away) this.room.send({ t: 'away', away });
  };

  get coach() {
    return this.me.coach;
  }
  get coachOnline() {
    return this.people.some((p) => p.coach && p.online);
  }
  get mine(): Progress | undefined {
    return this.progress[this.me.uid];
  }

  private say(text: string, ms = 3500) {
    this.notice = text;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.notice = ''), ms);
  }

  private on(m: any) {
    switch (m.t) {
      case 'state':
        this.me = m.me;
        this.info = m.info;
        this.board = m.board;
        this.holder = m.holder ?? '';
        this.chat = m.chat ?? [];
        this.settings = m.settings;
        this.people = m.people ?? [];
        this.task = m.task ?? undefined;
        this.progress = m.progress ?? {};
        this.lb = m.lb ?? [];
        this.session = m.session ?? { started: 0, scores: [], tasks: [] };
        this.allTime = m.allTime ?? [];
        this.games = m.games ?? [];
        // Back after a drop: the room has us in the call again.
        if (this.inVoice) this.sendVoice();
        this.syncVoice();
        return;
      case 'info':
        this.info = m.info;
        return;
      case 'note':
        this.note = m.note;
        if (!this.coach) sounds.start();
        return;
      case 'homework':
        this.newHomework = { id: m.id, title: m.title, due: m.due };
        return;
      case 'games':
        this.games = m.games;
        return;
      case 'game': {
        const i = this.games.findIndex((g) => g.id === m.game.id);
        this.games = i < 0 ? [...this.games, m.game] : this.games.map((g) => (g.id === m.game.id ? m.game : g));
        return;
      }
      case 'board':
        this.board = m.board;
        if (m.holder !== this.holder) {
          if (m.holder === this.me.uid) this.say('Your turn on the big board! Make a move.', 5000);
          else if (this.holder === this.me.uid) this.say('The coach has the board again.');
        }
        this.holder = m.holder ?? '';
        return;
      case 'people':
        this.people = m.people;
        this.syncVoice();
        return;
      case 'settings':
        this.settings = m.settings;
        void this.voice?.refreshVideo();
        return;
      case 'chat':
        this.chat = [...this.chat, m.chat].slice(-80);
        if (!this.chatOpen && m.chat.uid !== this.me.uid) this.unread++;
        return;
      case 'task':
        if (!m.task) {
          this.task = undefined;
          this.progress = {};
          this.lb = [];
          this.tried = undefined;
          return;
        }
        if (this.task?.id !== m.task.id) {
          this.tried = undefined;
          this.hint = undefined;
          if (!this.coach) sounds.start();
        } else if (m.task.over && !this.task?.over && !this.coach) this.say("Time's up!");
        this.task = m.task;
        if (m.p) this.progress = { [m.p.uid]: m.p };
        return;
      case 'progress':
        this.progress = m.progress;
        return;
      case 'prog':
        this.progress = { ...this.progress, [m.p.uid]: m.p };
        return;
      case 'me':
        this.progress = { ...this.progress, [m.p.uid]: m.p };
        return;
      case 'tried':
        if (m.late) {
          this.say("Time's up: that move came too late.");
          return;
        }
        this.tried = { ...m, at: Date.now() };
        if (m.p) this.progress = { ...this.progress, [m.p.uid]: m.p };
        return;
      case 'lb':
        this.lb = m.rows;
        return;
      case 'hint':
        this.hint = { task: m.task, item: m.item, square: m.square };
        this.say('Your coach sent you a hint: the glowing piece.');
        return;
      case 'react':
        if (m.to && m.to !== this.me.uid && !this.coach && !this.people.some((p) => p.uid === m.to)) return;
        this.reaction = { emoji: m.emoji, text: m.text, to: m.to, name: m.name, at: Date.now() };
        return;
      case 'muted':
        this.voice?.setMic(false);
        this.micOn = false;
        this.say(m.by === 'locked' ? 'Only students the coach lets speak can talk now. Raise your hand.' : 'The coach muted your microphone.');
        return;
      case 'camoff':
        void this.setCam('');
        this.say('The coach turned students’ cameras off.');
        return;
      case 'allow':
        this.say(m.on ? 'The coach let you speak: switch your microphone on.' : 'You are muted again.', 5000);
        if (!m.on) {
          this.voice?.setMic(false);
          this.micOn = false;
        }
        return;
      case 'rtc':
        void this.voice?.receive(m.from, m.d);
        return;
      case 'ended':
        this.ended = m.report;
        this.leaveVoice();
        return;
      case 'error':
        this.error = m.error;
        return;
    }
  }

  // ----- the coach

  setBoard(b: BoardView) {
    this.board = b;
    this.room.send({ t: 'board', board: $state.snapshot(b) });
  }
  give(uid: string) {
    this.room.send({ t: 'give', uid });
  }
  setSettings(change: Partial<Settings>) {
    this.settings = { ...this.settings, ...change };
    this.room.send({ t: 'settings', settings: change });
  }
  ask(task: unknown) {
    this.room.send({ t: 'task', task });
  }
  endTask() {
    this.room.send({ t: 'endtask' });
  }
  reveal() {
    this.room.send({ t: 'reveal' });
  }
  closeTask() {
    this.room.send({ t: 'closetask' });
  }
  endClass() {
    this.room.send({ t: 'end' });
  }
  mute(uid: string) {
    this.room.send({ t: 'mute', uid });
  }
  allow(uid: string, on: boolean) {
    this.room.send({ t: 'allow', uid, on });
  }
  lower(uid: string) {
    this.room.send({ t: 'hand', uid, up: false });
  }
  react(emoji: string, text = '', uid = '') {
    this.room.send({ t: 'react', emoji, text, uid });
  }
  sendHint(uid: string) {
    this.room.send({ t: 'hint', uid });
  }

  /** Games: a simul, the game zone (students in pairs), or the coach against one student; minutes 0: no clocks. */
  startGames(o: { mode: 'simul' | 'pair' | 'coach'; color?: 'white' | 'black' | 'random'; root?: string; uid?: string; minutes?: number; inc?: number }) {
    this.room.send({ t: 'games', ...o });
  }
  endGame(game: string, result?: string) {
    this.room.send({ t: 'gend', game, result });
  }
  clearGames() {
    this.room.send({ t: 'gend', all: true });
  }

  // ----- a student

  move(uci: string) {
    this.room.send({ t: 'move', uci });
  }
  tryMove(item: number, uci: string, cpu = false) {
    if (!this.task) return;
    this.room.send({ t: 'try', task: this.task.id, item, uci, cpu });
  }
  claim(item: number, result: 'win' | 'draw' | 'resign') {
    if (!this.task) return;
    this.room.send({ t: 'claim', task: this.task.id, item, result });
  }
  gameMove(game: string, uci: string) {
    this.room.send({ t: 'gmove', game, uci });
  }
  resign(game: string) {
    this.room.send({ t: 'gresign', game });
  }
  offerDraw(game: string) {
    this.room.send({ t: 'gdraw', game });
  }
  flag(game: string) {
    this.room.send({ t: 'gflag', game });
  }
  raiseHand(up: boolean) {
    this.room.send({ t: 'hand', up });
  }
  get handUp() {
    return !!this.people.find((p) => p.uid === this.me.uid)?.hand;
  }

  // ----- everyone

  sendChat(text: string) {
    const t = text.trim();
    if (t) this.room.send({ t: 'chat', text: t });
  }

  async joinVoice() {
    if (this.inVoice || this.joiningVoice) return;
    this.joiningVoice = true;
    try {
      const ice = await iceServers();
      this.voice = new Voice(
        this.me.uid,
        this.info.coach,
        (to, d) => this.room.send({ t: 'rtc', to, d }),
        ice,
        (l) => (this.levels = l),
        (uid, stream) => {
          if (uid === this.info.coach) this.coachVideo = stream;
          else if (stream) this.videos = { ...this.videos, [uid]: stream };
          else {
            const { [uid]: _gone, ...rest } = this.videos;
            this.videos = rest;
          }
        },
      );
      this.voice.sendTo = (uid) => this.coach || uid === this.info.coach || this.settings.peers !== false;
      this.relayed = this.voice.relayed;
      await this.voice.start();
      this.micError = this.voice.micError;
      this.inVoice = true;
      this.micOn = false;
      this.room.send({ t: 'voice', on: true, mic: false });
      this.syncVoice();
    } finally {
      this.joiningVoice = false;
    }
  }
  setMic(on: boolean) {
    if (!this.voice?.hasMic) return;
    const allowed = this.coach || this.settings.talk || this.people.find((p) => p.uid === this.me.uid)?.allow;
    if (on && !allowed) {
      this.say('Raise your hand: the coach will let you speak.');
      return;
    }
    this.voice.setMic(on);
    this.micOn = on;
    this.sendVoice();
  }
  private sendVoice() {
    this.room.send({ t: 'voice', on: this.inVoice, mic: this.micOn, cam: !!this.camOn, screen: this.camOn === 'screen' });
  }
  /** My camera (or the coach's screen) to the class; joins the call first when needed. */
  async setCam(kind: '' | 'camera' | 'screen') {
    if (kind && !this.voice) await this.joinVoice();
    if (!this.voice) return;
    for (const t of this.localVideo?.getTracks() ?? []) t.stop();
    this.localVideo = undefined;
    if (kind) {
      try {
        const stream = kind === 'screen' ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false }) : await camera(!this.coach);
        const track = stream.getVideoTracks()[0];
        // Sharing stopped from the browser's own bar.
        track.onended = () => {
          if (this.localVideo === stream) void this.setCam('');
        };
        this.localVideo = stream;
        await this.voice.setVideo(track, kind === 'screen');
      } catch (e) {
        this.say(kind === 'screen' ? 'The screen was not shared.' : cameraTrouble(e), 9000);
        kind = '';
        await this.voice.setVideo(undefined);
      }
    } else await this.voice.setVideo(undefined);
    this.camOn = kind;
    this.sendVoice();
  }
  leaveVoice() {
    if (!this.voice) return;
    this.voice.stop();
    this.voice = undefined;
    this.inVoice = false;
    this.micOn = false;
    this.levels = {};
    this.camOn = '';
    this.coachVideo = undefined;
    this.videos = {};
    this.peerStates = {};
    for (const t of this.localVideo?.getTracks() ?? []) t.stop();
    this.localVideo = undefined;
    if (this.status === 'open') this.room.send({ t: 'voice', on: false, mic: false });
  }
  private syncVoice() {
    if (!this.voice || !this.inVoice) return;
    this.voice.sync(this.people.filter((p) => p.online && p.voice).map((p) => p.uid));
  }

  close() {
    document.removeEventListener('visibilitychange', this.onAway);
    window.removeEventListener('blur', this.onAway);
    window.removeEventListener('focus', this.onAway);
    this.leaveVoice();
    clearInterval(this.tick);
    clearTimeout(this.noticeTimer);
    this.room.close();
  }
}
