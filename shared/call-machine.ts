// Qo'ng'iroq holat mashinasi (sof mantiq, platformaga bog'liq emas): mobil ilova (React Native),
// veb va testlar bir xil qoidalardan foydalanadi. NUSXA: mobile/src/call/call-machine.ts (sinxronlik testi bor).
// Mashina HECH NARSA qilmaydi — faqat yangi holat va "effektlar" ro'yxatini qaytaradi; ularni drayver bajaradi.

export type CallState = 'idle' | 'lobby' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'failed';
export type QualityTier = 'good' | 'fair' | 'poor';
export type Banner = null | 'reconnecting' | 'audio_only' | 'poor_connection' | 'failed' | 'window_closed';

export const POLICY = {
  /** Ketma-ket shuncha "yomon" namuna => avtomatik faqat-audio rejimi */
  poorSamplesForAudioOnly: 3,
  /** Faqat-audio rejimidan chiqish uchun ketma-ket "yaxshi" namunalar */
  goodSamplesToRestoreVideo: 6,
  /** Shu vaqtdan ortiq uzilish => 'failed' (foydalanuvchi qayta qo'shilishi mumkin) */
  reconnectGiveUpMs: 120_000,
  /** Qayta ulanish urinishlari orasidagi kutish (ms): 1s,2s,4s,8s,8s... */
  backoffMs: [1000, 2000, 4000, 8000],
  heartbeatMs: 15_000,
  // Sifat chegaralari
  poor: { lossPct: 8, rttMs: 800 },
  fair: { lossPct: 3, rttMs: 400 },
} as const;

export interface QualitySample {
  rttMs?: number;
  lossPct?: number;
  bitrateKbps?: number;
}

export function classifyQuality(s: QualitySample): QualityTier {
  const loss = s.lossPct ?? 0;
  const rtt = s.rttMs ?? 0;
  if (loss > POLICY.poor.lossPct || rtt > POLICY.poor.rttMs) return 'poor';
  if (loss > POLICY.fair.lossPct || rtt > POLICY.fair.rttMs) return 'fair';
  return 'good';
}

export function backoffDelay(attempt: number): number {
  const a = POLICY.backoffMs;
  return a[Math.min(attempt, a.length - 1)];
}

export interface CallContext {
  state: CallState;
  tier: QualityTier;
  audioOnlyAuto: boolean; // tarmoq yomonligi sababli video avtomatik o'chirilgan
  micMuted: boolean;
  cameraOff: boolean; // foydalanuvchi o'zi o'chirgan
  screenSharing: boolean;
  poorStreak: number;
  goodStreak: number;
  reconnectAttempts: number;
  disconnectedAt: number | null;
  joinStartedAt: number | null;
  connectedAt: number | null;
  joinMs: number | null;
  reconnects: number;
  banner: Banner;
  error: string | null;
}

export type CallEvent =
  | { type: 'ENTER_LOBBY' }
  | { type: 'JOIN'; now: number }
  | { type: 'CONNECTED'; now: number }
  | { type: 'CONNECTION_LOST'; now: number }
  | { type: 'RECONNECT_TICK'; now: number } // taymer ishladi: yana urinib ko'r
  | { type: 'RECONNECTED'; now: number }
  | { type: 'QUALITY'; sample: QualitySample }
  | { type: 'TOGGLE_MIC' }
  | { type: 'TOGGLE_CAMERA' }
  | { type: 'SCREEN_SHARE'; on: boolean }
  | { type: 'WINDOW_CLOSED' }
  | { type: 'FATAL'; message: string }
  | { type: 'LEAVE' };

export type Effect =
  | { type: 'connect' }
  | { type: 'disconnect' }
  | { type: 'tryReconnect' }
  | { type: 'scheduleReconnect'; delayMs: number }
  | { type: 'setCameraPublishing'; on: boolean }
  | { type: 'setMicPublishing'; on: boolean }
  | { type: 'setScreenShare'; on: boolean }
  | { type: 'presence'; event: 'joined' | 'left' }
  | { type: 'startHeartbeat' }
  | { type: 'stopHeartbeat' }
  | { type: 'reportQuality'; tier: QualityTier; reconnects: number; joinMs: number | null };

export const initialContext = (): CallContext => ({
  state: 'idle',
  tier: 'good',
  audioOnlyAuto: false,
  micMuted: false,
  cameraOff: false,
  screenSharing: false,
  poorStreak: 0,
  goodStreak: 0,
  reconnectAttempts: 0,
  disconnectedAt: null,
  joinStartedAt: null,
  connectedAt: null,
  joinMs: null,
  reconnects: 0,
  banner: null,
  error: null,
});

export interface Step {
  ctx: CallContext;
  effects: Effect[];
}

const cameraShouldPublish = (c: CallContext) => !c.cameraOff && !c.audioOnlyAuto;

export function reduce(ctx: CallContext, ev: CallEvent): Step {
  const effects: Effect[] = [];
  let c: CallContext = { ...ctx };

  switch (ev.type) {
    case 'ENTER_LOBBY':
      if (c.state === 'idle' || c.state === 'ended' || c.state === 'failed') c = { ...initialContext(), state: 'lobby' };
      break;

    case 'JOIN':
      if (c.state === 'lobby' || c.state === 'failed' || c.state === 'ended') {
        c = { ...c, state: 'connecting', joinStartedAt: ev.now, error: null, banner: null, reconnectAttempts: 0, disconnectedAt: null };
        effects.push({ type: 'connect' });
      }
      break;

    case 'CONNECTED':
      if (c.state === 'connecting') {
        c = { ...c, state: 'connected', connectedAt: ev.now, joinMs: c.joinStartedAt != null ? ev.now - c.joinStartedAt : null, banner: null };
        effects.push({ type: 'presence', event: 'joined' }, { type: 'startHeartbeat' }, { type: 'setMicPublishing', on: !c.micMuted }, { type: 'setCameraPublishing', on: cameraShouldPublish(c) });
      }
      break;

    case 'CONNECTION_LOST':
      if (c.state === 'connected' || c.state === 'connecting') {
        c = { ...c, state: 'reconnecting', disconnectedAt: ev.now, reconnectAttempts: 0, banner: 'reconnecting', reconnects: c.reconnects + 1 };
        effects.push({ type: 'scheduleReconnect', delayMs: backoffDelay(0) });
      }
      break;

    case 'RECONNECT_TICK':
      if (c.state === 'reconnecting') {
        if (c.disconnectedAt != null && ev.now - c.disconnectedAt > POLICY.reconnectGiveUpMs) {
          c = { ...c, state: 'failed', banner: 'failed', error: 'reconnect_timeout' };
          effects.push({ type: 'disconnect' }, { type: 'stopHeartbeat' }, { type: 'presence', event: 'left' });
        } else {
          c = { ...c, reconnectAttempts: c.reconnectAttempts + 1 };
          effects.push({ type: 'tryReconnect' }, { type: 'scheduleReconnect', delayMs: backoffDelay(c.reconnectAttempts) });
        }
      }
      break;

    case 'RECONNECTED':
      if (c.state === 'reconnecting') {
        c = { ...c, state: 'connected', disconnectedAt: null, reconnectAttempts: 0, banner: c.audioOnlyAuto ? 'audio_only' : null };
        // Sessiya serverda qayta ochiladi (eski sessiya oxirgi signal vaqtida yopiladi)
        effects.push({ type: 'presence', event: 'joined' }, { type: 'setMicPublishing', on: !c.micMuted }, { type: 'setCameraPublishing', on: cameraShouldPublish(c) });
      }
      break;

    case 'QUALITY': {
      if (c.state !== 'connected') break;
      const tier = classifyQuality(ev.sample);
      const poor = tier === 'poor';
      const good = tier === 'good';
      c = { ...c, tier, poorStreak: poor ? c.poorStreak + 1 : 0, goodStreak: good ? c.goodStreak + 1 : 0 };
      if (!c.audioOnlyAuto && c.poorStreak >= POLICY.poorSamplesForAudioOnly) {
        c = { ...c, audioOnlyAuto: true, banner: 'audio_only' };
        effects.push({ type: 'setCameraPublishing', on: false });
      } else if (c.audioOnlyAuto && c.goodStreak >= POLICY.goodSamplesToRestoreVideo) {
        c = { ...c, audioOnlyAuto: false, banner: null, poorStreak: 0 };
        effects.push({ type: 'setCameraPublishing', on: !c.cameraOff });
      } else if (!c.audioOnlyAuto) {
        c = { ...c, banner: poor ? 'poor_connection' : null };
      }
      effects.push({ type: 'reportQuality', tier, reconnects: c.reconnects, joinMs: c.joinMs });
      break;
    }

    case 'TOGGLE_MIC':
      if (c.state === 'connected' || c.state === 'reconnecting') {
        c = { ...c, micMuted: !c.micMuted };
        if (c.state === 'connected') effects.push({ type: 'setMicPublishing', on: !c.micMuted });
      }
      break;

    case 'TOGGLE_CAMERA':
      if (c.state === 'connected' || c.state === 'reconnecting') {
        c = { ...c, cameraOff: !c.cameraOff };
        // Yomon tarmoqda foydalanuvchi videoni yoqsa ham, mashina uni qayta o'chirishi mumkin (poorStreak oshsa)
        if (c.state === 'connected') effects.push({ type: 'setCameraPublishing', on: cameraShouldPublish(c) });
      }
      break;

    case 'SCREEN_SHARE':
      if (c.state === 'connected') {
        c = { ...c, screenSharing: ev.on };
        effects.push({ type: 'setScreenShare', on: ev.on });
      }
      break;

    case 'WINDOW_CLOSED':
      if (c.state !== 'ended' && c.state !== 'idle') {
        c = { ...c, state: 'ended', banner: 'window_closed' };
        effects.push({ type: 'disconnect' }, { type: 'stopHeartbeat' }, { type: 'presence', event: 'left' });
      }
      break;

    case 'FATAL':
      if (c.state !== 'ended') {
        c = { ...c, state: 'failed', banner: 'failed', error: ev.message };
        effects.push({ type: 'disconnect' }, { type: 'stopHeartbeat' });
      }
      break;

    case 'LEAVE':
      if (c.state === 'connected' || c.state === 'reconnecting' || c.state === 'connecting') {
        c = { ...c, state: 'ended', banner: null };
        effects.push({ type: 'disconnect' }, { type: 'stopHeartbeat' }, { type: 'presence', event: 'left' });
      } else if (c.state === 'lobby') {
        c = { ...c, state: 'ended' };
      }
      break;
  }
  return { ctx: c, effects };
}
