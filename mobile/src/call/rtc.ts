// WebRTC driver (LiveKit). Needs a development build: livekit-client and @livekit/react-native contain native code and do not run in Expo Go.
// The libraries are loaded with require() so that Expo Go still starts the app and the call screen explains what is missing.
import Constants from 'expo-constants';

export interface RtcStats {
  rttMs?: number;
  lossPct?: number;
  bitrateKbps?: number;
}

/** Live numbers behind the quality badge (measured from WebRTC statistics, not guessed). */
export interface LinkQuality {
  /** excellent | good | poor | bad | lost, the worse of LiveKit's own score and our measurements */
  level: 'excellent' | 'good' | 'poor' | 'bad' | 'lost';
  rttMs?: number;
  lossPct?: number;
  jitterMs?: number;
  upKbps?: number;
  downKbps?: number;
}

/** Everything a call screen draws: camera and screen of both sides, simultaneously. */
export interface CallMedia {
  remoteCamera: unknown | null;
  remoteScreen: unknown | null;
  localCamera: unknown | null;
  localScreen: unknown | null;
  remoteMicMuted: boolean;
  remoteSpeaking: boolean;
}

export const EMPTY_MEDIA: CallMedia = { remoteCamera: null, remoteScreen: null, localCamera: null, localScreen: null, remoteMicMuted: false, remoteSpeaking: false };

export interface RtcDriverEvents {
  onDisconnected: () => void;
  onReconnecting: () => void;
  onReconnected: () => void;
  onMedia: (m: CallMedia) => void;
  onQuality: (q: LinkQuality) => void;
  onRemoteJoined: () => void;
  onRemoteLeft: () => void;
  onData: (text: string) => void;
}

export interface RtcDriver {
  connect(url: string, token: string, ev: RtcDriverEvents, opts: { videoEnabled: boolean }): Promise<void>;
  disconnect(): Promise<void>;
  setMic(on: boolean): Promise<void>;
  setCamera(on: boolean): Promise<void>;
  flipCamera(): Promise<void>;
  setScreenShare(on: boolean): Promise<void>;
  sendChat(text: string): Promise<void>;
  sampleStats(): Promise<RtcStats>;
  localVideoTrack(): unknown | null;
}

export type RtcAvailability = { ok: true } | { ok: false; reason: 'expo_go' | 'not_installed' | 'web' };

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function loadModules(): { lk: any; rn: any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('@livekit/react-native');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lk = require('livekit-client');
    return { lk, rn };
  } catch {
    return null;
  }
}

export function rtcAvailability(): RtcAvailability {
  if (isExpoGo()) return { ok: false, reason: 'expo_go' };
  return loadModules() ? { ok: true } : { ok: false, reason: 'not_installed' };
}

const worse = (a: LinkQuality['level'], b: LinkQuality['level']): LinkQuality['level'] => {
  const order = ['excellent', 'good', 'poor', 'bad', 'lost'] as const;
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
};

/** Turns measured numbers into a level. Thresholds follow common VoIP guidance (ITU G.114: one-way delay under 150 ms is good, loss under 1 % is clean). */
export function levelFrom(q: { rttMs?: number; lossPct?: number; jitterMs?: number }): LinkQuality['level'] {
  const rtt = q.rttMs ?? 0;
  const loss = q.lossPct ?? 0;
  const jit = q.jitterMs ?? 0;
  if (rtt > 800 || loss > 15) return 'bad';
  if (rtt > 350 || loss > 5 || jit > 80) return 'poor';
  if (rtt > 150 || loss > 1.5 || jit > 35) return 'good';
  return 'excellent';
}

export function createRtcDriver(): RtcDriver | null {
  const mods = loadModules();
  if (!mods || isExpoGo()) return null;
  const { lk, rn } = mods;
  rn.registerGlobals?.();
  let room: any = null;
  let statsTimer: ReturnType<typeof setInterval> | null = null;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let ev: RtcDriverEvents | null = null;
  let lkLevel: LinkQuality['level'] = 'excellent';
  let rttEma: number | undefined;
  let prev: { t: number; up: number; down: number; lost: number; recv: number } | null = null;

  const remote = () => (room && room.remoteParticipants ? (Array.from(room.remoteParticipants.values())[0] as any) : null);
  const trackOf = (p: any, source: any) => {
    const pub = p?.getTrackPublication?.(source);
    return pub && pub.track && !pub.isMuted ? pub.track : null;
  };
  const emitMedia = () => {
    if (!room || !ev) return;
    const r = remote();
    const me = room.localParticipant;
    ev.onMedia({
      remoteCamera: trackOf(r, lk.Track.Source.Camera),
      remoteScreen: trackOf(r, lk.Track.Source.ScreenShare),
      localCamera: trackOf(me, lk.Track.Source.Camera),
      localScreen: trackOf(me, lk.Track.Source.ScreenShare),
      remoteMicMuted: !!r && !r.isMicrophoneEnabled,
      remoteSpeaking: !!r?.isSpeaking,
    });
  };

  const sample = async () => {
    if (!room || !ev) return;
    const state = room.state as string;
    if (state !== 'connected') return void ev.onQuality({ level: 'lost' });
    let rttMs: number | undefined;
    let lossPct: number | undefined;
    let jitterMs: number | undefined;
    let up = 0;
    let down = 0;
    let lost = 0;
    let recv = 0;
    try {
      const pcm = room.engine?.pcManager;
      const [pub, sub] = await Promise.all([pcm?.publisher?.getStats?.(), pcm?.subscriber?.getStats?.()]);
      pub?.forEach((s: any) => {
        if (s.type === 'candidate-pair' && (s.nominated || s.state === 'succeeded') && typeof s.currentRoundTripTime === 'number') rttMs = s.currentRoundTripTime * 1000;
        if (s.type === 'outbound-rtp') up += s.bytesSent ?? 0;
        if (s.type === 'remote-inbound-rtp') {
          if (typeof s.roundTripTime === 'number' && rttMs === undefined) rttMs = s.roundTripTime * 1000;
          if (typeof s.fractionLost === 'number') lossPct = Math.max(lossPct ?? 0, s.fractionLost * 100);
          if (typeof s.jitter === 'number') jitterMs = Math.max(jitterMs ?? 0, s.jitter * 1000);
        }
      });
      sub?.forEach((s: any) => {
        if (s.type === 'candidate-pair' && (s.nominated || s.state === 'succeeded') && typeof s.currentRoundTripTime === 'number' && rttMs === undefined) rttMs = s.currentRoundTripTime * 1000;
        if (s.type === 'inbound-rtp') {
          down += s.bytesReceived ?? 0;
          lost += s.packetsLost ?? 0;
          recv += s.packetsReceived ?? 0;
          if (typeof s.jitter === 'number') jitterMs = Math.max(jitterMs ?? 0, s.jitter * 1000);
        }
      });
    } catch {
      /* statistics are optional: LiveKit's own level still works */
    }
    const now = Date.now();
    let upKbps: number | undefined;
    let downKbps: number | undefined;
    if (prev && now > prev.t) {
      const dt = (now - prev.t) / 1000;
      upKbps = Math.max(0, ((up - prev.up) * 8) / 1000 / dt);
      downKbps = Math.max(0, ((down - prev.down) * 8) / 1000 / dt);
      const dLost = lost - prev.lost;
      const dRecv = recv - prev.recv;
      if (dLost + dRecv > 20) lossPct = Math.max(lossPct ?? 0, (Math.max(0, dLost) * 100) / (dLost + dRecv));
    }
    prev = { t: now, up, down, lost, recv };
    if (rttMs !== undefined) rttEma = rttEma === undefined ? rttMs : rttEma * 0.6 + rttMs * 0.4;
    const measured = levelFrom({ rttMs: rttEma, lossPct, jitterMs });
    ev.onQuality({ level: worse(measured, lkLevel === 'excellent' ? 'excellent' : lkLevel), rttMs: rttEma, lossPct, jitterMs, upKbps, downKbps });
  };

  return {
    async connect(url, token, events, opts) {
      ev = events;
      prev = null;
      rttEma = undefined;
      await rn.AudioSession?.startAudioSession?.();
      room = new lk.Room({
        adaptiveStream: true, // the viewer's screen size picks the layer: sharp when big, light when small
        dynacast: true, // layers nobody watches are not sent
        stopLocalTrackOnUnpublish: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        videoCaptureDefaults: { resolution: lk.VideoPresets.h720.resolution, facingMode: 'user' },
        publishDefaults: {
          simulcast: true,
          videoSimulcastLayers: [lk.VideoPresets.h360, lk.VideoPresets.h180],
          videoEncoding: { maxBitrate: 2_200_000, maxFramerate: 30 }, // 720p30 camera
          screenShareEncoding: { maxBitrate: 3_500_000, maxFramerate: 15 }, // 1080p15 for text and slides
          screenShareSimulcastLayers: [],
          degradationPreference: 'balanced',
          dtx: true,
          red: true,
          audioPreset: lk.AudioPresets.speech,
          backupCodec: true,
        },
      });
      room
        .on(lk.RoomEvent.Disconnected, () => { ev?.onDisconnected(); })
        .on(lk.RoomEvent.Reconnecting, () => { lkLevel = 'lost'; ev?.onReconnecting(); void sample(); })
        .on(lk.RoomEvent.Reconnected, () => { lkLevel = 'excellent'; ev?.onReconnected(); })
        .on(lk.RoomEvent.ParticipantConnected, () => { ev?.onRemoteJoined(); emitMedia(); })
        .on(lk.RoomEvent.ParticipantDisconnected, () => { ev?.onRemoteLeft(); emitMedia(); })
        .on(lk.RoomEvent.TrackSubscribed, emitMedia)
        .on(lk.RoomEvent.TrackUnsubscribed, emitMedia)
        .on(lk.RoomEvent.TrackMuted, emitMedia)
        .on(lk.RoomEvent.TrackUnmuted, emitMedia)
        .on(lk.RoomEvent.LocalTrackPublished, emitMedia)
        .on(lk.RoomEvent.LocalTrackUnpublished, emitMedia)
        .on(lk.RoomEvent.ActiveSpeakersChanged, emitMedia)
        .on(lk.RoomEvent.ConnectionQualityChanged, (q: string, p: any) => {
          if (p?.isLocal) {
            lkLevel = q === 'excellent' ? 'excellent' : q === 'good' ? 'good' : q === 'poor' ? 'poor' : q === 'lost' ? 'lost' : 'excellent';
            void sample();
          }
        })
        .on(lk.RoomEvent.DataReceived, (payload: Uint8Array) => ev?.onData(dec.decode(payload)));
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(opts.videoEnabled);
      if (room.remoteParticipants?.size > 0) ev.onRemoteJoined();
      emitMedia();
      if (statsTimer) clearInterval(statsTimer);
      statsTimer = setInterval(() => void sample(), 2000);
      void sample();
    },
    async disconnect() {
      if (statsTimer) clearInterval(statsTimer);
      statsTimer = null;
      try { await room?.disconnect(); } catch { /* already closed */ }
      room = null;
      try { await rn.AudioSession?.stopAudioSession?.(); } catch { /* ignore */ }
    },
    async setMic(on) {
      await room?.localParticipant.setMicrophoneEnabled(on);
      emitMedia();
    },
    async setCamera(on) {
      await room?.localParticipant.setCameraEnabled(on);
      emitMedia();
    },
    async flipCamera() {
      const pub = room?.localParticipant.getTrackPublication(lk.Track.Source.Camera);
      const cur = pub?.videoTrack?.mediaStreamTrack?.getSettings?.().facingMode;
      await pub?.videoTrack?.restartTrack?.({ facingMode: cur === 'environment' ? 'user' : 'environment', resolution: lk.VideoPresets.h720.resolution });
      emitMedia();
    },
    async setScreenShare(on) {
      // camera and screen are two separate tracks: both can be published at the same time
      await room?.localParticipant.setScreenShareEnabled(on, on ? { audio: false, resolution: { width: 1920, height: 1080, frameRate: 15 }, contentHint: 'detail' } : undefined);
      emitMedia();
    },
    async sendChat(text) {
      await room?.localParticipant.publishData(enc.encode(text), { reliable: true });
    },
    async sampleStats() {
      return { rttMs: rttEma };
    },
    localVideoTrack() {
      return room?.localParticipant.getTrackPublication(lk.Track.Source.Camera)?.videoTrack ?? null;
    },
  };
}
