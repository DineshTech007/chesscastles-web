/**
 * CastlesClass voice and the coach's video, browser to browser (WebRTC, no paid service): everyone in the call is
 * connected to everyone else, audio and cameras both ways, like a meeting (owner, 2026-10-22: every tile shows the
 * camera or the name). A student's camera goes to the coach, and to the other students when the coach allows it
 * (`sendTo`). Students' video is small, and smaller the more people there are. Fine for
 * a class of up to about fifteen; for bigger classes Cloudflare's video servers (1,000 GB a month free) would carry
 * it instead. The live room only passes the connection messages along. Without a microphone one can still listen
 * and watch.
 */
type Signal = { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  /** Connection messages that came before the other side's description. */
  pending: RTCIceCandidateInit[];
  meter?: () => number;
}

/** About 600 kbit/s for the coach's camera, 1.2 Mbit/s for a screen (text must stay sharp); a student sends about
 * 1.5 Mbit/s in all, shared out (100 to 300 kbit/s to each person). */
const CAM_BITRATE = 600_000;
const SCREEN_BITRATE = 1_200_000;
const STUDENT_TOTAL = 1_500_000;

export class Voice {
  private peers = new Map<string, Peer>();
  private local?: MediaStream;
  private ctx?: AudioContext;
  private loop?: ReturnType<typeof setInterval>;
  private localMeter?: () => number;
  /** The coach's video going out (camera or screen), if any. */
  private video?: MediaStreamTrack;
  private screen = false;
  /** Why there is no microphone ('' when there is one). */
  micError = '';
  /** Whether my video goes to this person (a student's: to the coach always, to other students when allowed). */
  sendTo: (uid: string) => boolean = () => true;

  constructor(
    private me: string,
    /** The coach's id: video flows between the coach and each student. */
    private coach: string,
    private signal: (to: string, d: Signal) => void,
    private ice: RTCIceServer[],
    /** How loud each person is now (0 to 1), a few times a second: who is speaking. */
    private onlevels?: (levels: Record<string, number>) => void,
    /** The coach's video arriving (or gone). */
    private onvideo?: (uid: string, stream: MediaStream | undefined) => void,
  ) {}

  private get isCoach() {
    return this.me === this.coach;
  }

  /** Joins the call: asks for the microphone (muted to start with). */
  async start(): Promise<boolean> {
    try {
      this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      this.setMic(false);
    } catch (e) {
      const name = (e as Error)?.name;
      this.micError =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'The microphone is blocked: allow it in the address bar (and in Windows Settings > Privacy > Microphone). You can still listen.'
          : name === 'NotReadableError' || name === 'AbortError'
            ? 'Another app is using the microphone (Zoom, Meet, Teams). Close it and join again. You can still listen.'
            : 'No microphone found. You can still listen.';
    }
    try {
      this.ctx = new AudioContext();
      void this.ctx.resume();
      if (this.local) this.localMeter = this.meter(this.local);
    } catch {
      /* no meters */
    }
    this.loop = setInterval(() => {
      if (!this.onlevels) return;
      const levels: Record<string, number> = {};
      if (this.localMeter) levels[this.me] = this.micOn ? this.localMeter() : 0;
      for (const [uid, p] of this.peers) if (p.meter) levels[uid] = p.meter();
      this.onlevels(levels);
    }, 250);
    return !!this.local;
  }

  get hasMic() {
    return !!this.local;
  }
  get micOn() {
    return !!this.local?.getAudioTracks().some((t) => t.enabled);
  }
  setMic(on: boolean) {
    for (const t of this.local?.getAudioTracks() ?? []) t.enabled = on;
  }

  /** My video: a camera or a screen track, or none. Goes to everyone at once (no reconnecting). */
  async setVideo(track: MediaStreamTrack | undefined, screen = false) {
    this.video = track;
    this.screen = screen;
    await this.refreshVideo();
  }
  /** After `sendTo` changed (the coach's setting): who gets my video, again. */
  async refreshVideo() {
    for (const [uid, p] of this.peers) await this.sendVideo(p.pc, uid);
  }
  private videoSender(pc: RTCPeerConnection): RTCRtpSender | undefined {
    return pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video')?.sender;
  }
  private async sendVideo(pc: RTCPeerConnection, uid: string) {
    const sender = this.videoSender(pc);
    if (!sender) return;
    await sender.replaceTrack(this.video && this.sendTo(uid) ? this.video : null).catch(() => undefined);
    try {
      const params = sender.getParameters();
      params.encodings = params.encodings?.length ? params.encodings : [{}];
      const each = Math.max(100_000, Math.min(300_000, Math.round(STUDENT_TOTAL / Math.max(1, this.peers.size))));
      params.encodings[0].maxBitrate = this.screen ? SCREEN_BITRATE : this.isCoach ? CAM_BITRATE : each;
      await sender.setParameters(params);
    } catch {
      /* the browser picks */
    }
  }

  /** Everyone in the call now: connect to the new ones (the one with the smaller id calls), drop those who left. */
  sync(uids: string[]) {
    const want = new Set(uids.filter((u) => u !== this.me));
    for (const uid of want) if (!this.peers.has(uid) && this.me < uid) void this.call(uid);
    for (const uid of [...this.peers.keys()]) if (!want.has(uid)) this.drop(uid);
  }

  private peer(uid: string): Peer {
    this.drop(uid);
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    if (this.local) for (const t of this.local.getTracks()) pc.addTrack(t, this.local);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    const audio = new Audio();
    audio.autoplay = true;
    const p: Peer = { pc, audio, pending: [] };
    pc.ontrack = (e) => {
      if (e.track.kind === 'video') {
        const stream = new MediaStream([e.track]);
        this.onvideo?.(uid, stream);
        e.track.onended = () => this.onvideo?.(uid, undefined);
        return;
      }
      const stream = new MediaStream([e.track]);
      audio.srcObject = stream;
      void audio.play().catch(() => undefined);
      if (this.ctx) p.meter = this.meter(stream);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(uid, { ice: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      // A connection that fails is tried once more from the start (the caller side calls again).
      if (pc.connectionState === 'failed' && this.peers.get(uid)?.pc === pc) {
        this.drop(uid);
        if (this.me < uid) setTimeout(() => void this.call(uid), 1500);
      }
    };
    this.peers.set(uid, p);
    return p;
  }

  private async call(uid: string) {
    const { pc } = this.peer(uid);
    // The video channel, both ways, made at the start so cameras can come and go without a new connection.
    pc.addTransceiver('video', { direction: 'sendrecv' });
    await this.sendVideo(pc, uid);
    try {
      await pc.setLocalDescription(await pc.createOffer());
      this.signal(uid, { sdp: pc.localDescription!.toJSON() });
    } catch {
      this.drop(uid);
    }
  }

  /** A connection message from `from`. */
  async receive(from: string, d: Signal) {
    try {
      if (d.sdp?.type === 'offer') {
        const p = this.peer(from);
        await p.pc.setRemoteDescription(d.sdp);
        // The video channel: both ways.
        for (const t of p.pc.getTransceivers())
          if (t.receiver.track?.kind === 'video') {
            t.direction = 'sendrecv';
            await this.sendVideo(p.pc, from);
          }
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        this.signal(from, { sdp: p.pc.localDescription!.toJSON() });
        for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => undefined);
      } else if (d.sdp?.type === 'answer') {
        const p = this.peers.get(from);
        if (!p || p.pc.signalingState !== 'have-local-offer') return;
        await p.pc.setRemoteDescription(d.sdp);
        for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => undefined);
      } else if (d.ice) {
        const p = this.peers.get(from);
        if (!p) return;
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(d.ice).catch(() => undefined);
        else p.pending.push(d.ice);
      }
    } catch {
      /* a broken message: the connection is tried again when it fails */
    }
  }

  /** Each connection's state (new, connecting, connected, disconnected, failed): shown on the tiles. */
  states(): Record<string, string> {
    return Object.fromEntries([...this.peers].map(([uid, p]) => [uid, p.pc.connectionState]));
  }
  /** Whether a relay (TURN) is set up: without one, some networks block direct calls. */
  get relayed() {
    return this.ice.some((s) => [s.urls].flat().some((u) => String(u).startsWith('turn')));
  }

  /** Who is connected and can be heard. */
  connected(): string[] {
    return [...this.peers].filter(([, p]) => p.pc.connectionState === 'connected').map(([uid]) => uid);
  }

  private meter(stream: MediaStream): (() => number) | undefined {
    if (!this.ctx) return undefined;
    try {
      const src = this.ctx.createMediaStreamSource(stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      return () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        return Math.min(1, Math.sqrt(sum / buf.length) * 4);
      };
    } catch {
      return undefined;
    }
  }

  private drop(uid: string) {
    const p = this.peers.get(uid);
    if (!p) return;
    this.peers.delete(uid);
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    p.audio.srcObject = null;
    this.onvideo?.(uid, undefined);
  }

  stop() {
    for (const uid of [...this.peers.keys()]) this.drop(uid);
    for (const t of this.local?.getTracks() ?? []) t.stop();
    this.video?.stop();
    this.video = undefined;
    this.local = undefined;
    clearInterval(this.loop);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = undefined;
  }
}
