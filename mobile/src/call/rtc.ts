// Haqiqiy WebRTC drayveri (LiveKit). HOLAT: UNTESTED — haqiqiy qurilma/server bilan sinalmagan (KNOWN_GAPS.md).
//
// MUHIM: livekit-client va @livekit/react-native native modul talab qiladi => Expo Go'da ISHLAMAYDI,
// "development build" (expo-dev-client, allaqachon dependency) yoki do'kon build'i kerak.
// Kutubxonalar package.json'ga HALI QO'SHILMAGAN (katta yuklama); o'rnatish: docs/CALLS.md.
// Shu sababli ular require() bilan kechiktirib yuklanadi: o'rnatilmagan bo'lsa ilova qulamaydi, ekran tushuntirish ko'rsatadi.
import Constants from 'expo-constants';

export interface RtcStats {
  rttMs?: number;
  lossPct?: number;
  bitrateKbps?: number;
}

export interface RtcDriverEvents {
  onDisconnected: () => void;
  onReconnecting: () => void;
  onReconnected: () => void;
  onRemoteVideo: (track: unknown | null) => void;
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

export function createRtcDriver(): RtcDriver | null {
  const mods = loadModules();
  if (!mods || isExpoGo()) return null;
  const { lk, rn } = mods;
  rn.registerGlobals?.();
  let room: any = null;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  return {
    async connect(url, token, ev, opts) {
      room = new lk.Room({
        adaptiveStream: true, // abonent video o'lchamini ekranga moslab oladi
        dynacast: true,
        videoCaptureDefaults: { resolution: lk.VideoPresets.h360.resolution },
        publishDefaults: { simulcast: true, videoEncoding: { maxBitrate: 600_000, maxFramerate: 24 } },
      });
      room
        .on(lk.RoomEvent.Disconnected, ev.onDisconnected)
        .on(lk.RoomEvent.Reconnecting, ev.onReconnecting)
        .on(lk.RoomEvent.Reconnected, ev.onReconnected)
        .on(lk.RoomEvent.ParticipantConnected, ev.onRemoteJoined)
        .on(lk.RoomEvent.ParticipantDisconnected, ev.onRemoteLeft)
        .on(lk.RoomEvent.TrackSubscribed, (track: any) => track.kind === 'video' && ev.onRemoteVideo(track))
        .on(lk.RoomEvent.TrackUnsubscribed, (track: any) => track.kind === 'video' && ev.onRemoteVideo(null))
        .on(lk.RoomEvent.DataReceived, (payload: Uint8Array) => ev.onData(dec.decode(payload)));
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(opts.videoEnabled);
      if (room.remoteParticipants?.size > 0) ev.onRemoteJoined();
    },
    async disconnect() {
      await room?.disconnect();
      room = null;
    },
    async setMic(on) {
      await room?.localParticipant.setMicrophoneEnabled(on);
    },
    async setCamera(on) {
      await room?.localParticipant.setCameraEnabled(on);
    },
    async flipCamera() {
      const pub = room?.localParticipant.getTrackPublication(lk.Track.Source.Camera);
      await pub?.videoTrack?.restartTrack?.({ facingMode: 'environment' });
    },
    async setScreenShare(on) {
      await room?.localParticipant.setScreenShareEnabled(on);
    },
    async sendChat(text) {
      await room?.localParticipant.publishData(enc.encode(text), { reliable: true });
    },
    async sampleStats() {
      // getStats ning aniq ko'rinishi SDK versiyasiga bog'liq — UNTESTED; xato bo'lsa bo'sh qaytaramiz
      try {
        const pub = room?.localParticipant.getTrackPublication(lk.Track.Source.Camera);
        const s = await pub?.videoTrack?.getSenderStats?.();
        return { rttMs: s?.roundTripTime ? s.roundTripTime * 1000 : undefined, lossPct: s?.packetsLost && s?.packetsSent ? (s.packetsLost * 100) / (s.packetsLost + s.packetsSent) : undefined };
      } catch {
        return {};
      }
    },
    localVideoTrack() {
      return room?.localParticipant.getTrackPublication(lk.Track.Source.Camera)?.videoTrack ?? null;
    },
  };
}
