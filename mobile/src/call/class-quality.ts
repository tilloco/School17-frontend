// Sinf video sifat dvigateli (R4): barcha raqamlar SHU faylda, izohli. Sof mantiq: tarmoq va qurilmaga bog'liq emas.
// Nusxa: mobile/src/call/class-quality.ts (shared/class-quality.spec.ts ikkalasi bir xil ekanini tekshiradi).
// HOLAT: haqiqiy telefonlarda sinab ko'rilmagan; raqamlar boshlang'ich taxmin, qurilmada o'lchab to'g'rilanadi.
import { backoffDelay } from './call-machine';

export const CLASS_QUALITY = {
  /** O'qituvchi simulcast qatlamlari (past -> yuqori). Dynacast va adaptiveStream yoqiladi: hech kim ko'rmayotgan qatlam yuborilmaydi. */
  teacherLayers: [
    { name: 'low', width: 320, height: 180, fps: 24, maxKbps: 150 },
    { name: 'mid', width: 640, height: 360, fps: 24, maxKbps: 450 },
    { name: 'high', width: 1280, height: 720, fps: 30, maxKbps: 1500 },
  ],
  /** Sahnadagi o'quvchi videosi: kichik, 15 fps gacha */
  pupilVideo: { maxWidth: 640, maxHeight: 360, minWidth: 320, minHeight: 180, maxFps: 15, maxKbps: 350 },
  /** Nutq uchun mikrofon sozlamasi; DTX/RED qo'llab-quvvatlansa yoqiladi */
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, dtx: true, red: true, maxKbps: 32 },
  /** Kodek ustuvorligi: H.264 arzon Android telefonlarda apparat dekodlanadi; VP8 zaxira. VP9/AV1 ishlatilmaydi (CPU ko'p). Hujjatlardan qayta tekshirish kerak. */
  codecPreference: ['h264', 'vp8'] as const,
  /** O'quvchi klientiga keladigan video plitkalar: o'qituvchi + shu sondan ko'p bo'lmagan ajratilgan/faol so'zlovchi (env: CLASS_VIEWER_TILES) */
  viewerTiles: 3,
  /** Mobil ekranda bir vaqtda ko'rsatiladigan video ko'rinishlar chegarasi */
  maxVideoViewsMobile: 4,
  /** O'qituvchi to'rida bir sahifadagi plitkalar */
  teacherGridPage: 4,
  ladder: {
    /** Har bir pog'ona uchun minimal talab (kbps pastga yuklash, yo'qotish %, RTT ms). Tepadan pastga tekshiriladi. */
    requirements: [
      { step: 0, minDownKbps: 1500, maxLossPct: 3, maxRttMs: 400 }, // FULL
      { step: 1, minDownKbps: 400, maxLossPct: 8, maxRttMs: 800 }, // LOWER
      { step: 2, minDownKbps: 60, maxLossPct: 20, maxRttMs: 2500 }, // AUDIO_ONLY
    ],
    /** Ketma-ket shuncha yomon namunadan keyin pasayadi (bir lahzalik tebranishga e'tibor bermaslik) */
    degradeAfterSamples: 2,
    /** Yaxshilanish shuncha vaqt barqaror bo'lgandan keyin bir pog'ona yuqoriga (tebranmaslik uchun) */
    recoverStableMs: 15_000,
  },
  /** Oldindan tekshiruv (pre-call) */
  precheck: {
    durationMs: 5000,
    goodDownMbps: 1.5,
    weakDownMbps: 0.4,
    maxGoodRttMs: 300,
    /** O'qituvchi yuklash tezligi shundan past bo'lsa ogohlantirish (placeholder: 3 Mbps) */
    minTeacherUpMbps: 3,
  },
  /** Qayta ulanish: kutish vaqtlari call-machine dagi backoffDelay bilan bir xil, urinishlar soni cheklanmagan, har gal yangi token olinadi */
  reconnect: { maxAttemptsBeforeBanner: 2 },
  /** Qayta ulangandan keyin backenddan qayta o'qiladigan holatlar */
  resync: ['permissions', 'stage', 'presentation', 'whiteboard', 'chat', 'questions'] as const,
  /** Statistika namunasi (R10) */
  telemetryEveryMs: 30_000,
} as const;

export type LadderStep = 0 | 1 | 2 | 3; // 0 FULL, 1 LOWER, 2 AUDIO_ONLY, 3 SLIDES_ONLY
export const STEP_NAMES = ['FULL', 'LOWER', 'AUDIO_ONLY', 'SLIDES_ONLY'] as const;

export interface NetSample {
  downKbps: number;
  lossPct: number;
  rttMs: number;
}

export interface LadderState {
  step: LadderStep;
  /** Oxirgi o'zgarish vaqti (ms) */
  since: number;
  /** Yaxshiroq maqsad qachondan beri uzluksiz kuzatilmoqda */
  betterSince: number | null;
  badCount: number;
  /** Foydalanuvchi qo'lda qo'ygan chegara (shundan yaxshiroq pog'onaga chiqmaydi) */
  manualCap: LadderStep | null;
}

export const initialLadder = (now: number): LadderState => ({ step: 0, since: now, betterSince: null, badCount: 0, manualCap: null });

/** Namuna qaysi pog'onani ko'tara oladi (eng yaxshisi) */
export function targetStep(s: NetSample): LadderStep {
  for (const r of CLASS_QUALITY.ladder.requirements) {
    if (s.downKbps >= r.minDownKbps && s.lossPct <= r.maxLossPct && s.rttMs <= r.maxRttMs) return r.step as LadderStep;
  }
  return 3;
}

export type LadderEvent = { type: 'sample'; at: number; sample: NetSample } | { type: 'manual'; at: number; cap: LadderStep | null };

export interface LadderResult {
  state: LadderState;
  changed: boolean;
  /** Foydalanuvchiga ko'rsatiladigan banner kaliti (null = banner yo'q) */
  banner: 'lower' | 'audio_only' | 'slides_only' | null;
}

const bannerFor = (step: LadderStep): LadderResult['banner'] => (step === 1 ? 'lower' : step === 2 ? 'audio_only' : step === 3 ? 'slides_only' : null);
const worse = (a: LadderStep, b: LadderStep): LadderStep => (Math.max(a, b) as LadderStep);

/** Pasayish tez (ikki yomon namuna), yuqoriga chiqish sekin (barqarorlik vaqti) va faqat bir pog'onadan. Ovoz har doim video'dan ustun: 2-pog'onada ham ovoz davom etadi. */
export function reduceLadder(prev: LadderState, ev: LadderEvent): LadderResult {
  const cfg = CLASS_QUALITY.ladder;
  let st = { ...prev };
  if (ev.type === 'manual') {
    st.manualCap = ev.cap;
    if (ev.cap !== null && st.step < ev.cap) {
      st = { ...st, step: ev.cap, since: ev.at, betterSince: null, badCount: 0 };
    }
    return { state: st, changed: st.step !== prev.step, banner: bannerFor(st.step) };
  }
  const floor = st.manualCap ?? 0;
  const target = worse(targetStep(ev.sample), floor as LadderStep);
  if (target > st.step) {
    st.badCount += 1;
    st.betterSince = null;
    if (st.badCount >= cfg.degradeAfterSamples) st = { ...st, step: target, since: ev.at, badCount: 0 };
  } else if (target < st.step) {
    st.badCount = 0;
    if (st.betterSince === null) st.betterSince = ev.at;
    else if (ev.at - st.betterSince >= cfg.recoverStableMs) st = { ...st, step: (st.step - 1) as LadderStep, since: ev.at, betterSince: null };
  } else {
    st.badCount = 0;
    st.betterSince = null;
  }
  return { state: st, changed: st.step !== prev.step, banner: bannerFor(st.step) };
}

/** Pog'onaga mos ravishda nima yoqilgan */
export function ladderCapabilities(step: LadderStep) {
  return {
    teacherVideo: step <= 1,
    preferredLayer: step === 0 ? 'high' : step === 1 ? 'low' : null,
    pupilVideo: step <= 1,
    audio: step <= 2, // 3-pog'onada (faqat slayd/doska) ovoz tarmoq imkon bersa davom etadi, lekin yuklama kamayadi
    slides: true,
  };
}

export interface TileInput {
  teacherId: string;
  spotlightId: string | null;
  activeSpeakers: string[]; // faollik bo'yicha tartiblangan
  step: LadderStep;
  viewerTiles?: number;
  maxViews?: number;
}

/** O'quvchi klienti qaysi ishtirokchilarning videosini oladi (qolganlari faqat audio) */
export function viewerVideoTiles(i: TileInput): string[] {
  if (i.step >= 2) return [];
  const maxTiles = Math.min((i.viewerTiles ?? CLASS_QUALITY.viewerTiles) + 1, i.maxViews ?? CLASS_QUALITY.maxVideoViewsMobile);
  const out: string[] = [i.teacherId];
  const add = (id: string | null) => {
    if (id && !out.includes(id) && out.length < maxTiles) out.push(id);
  };
  add(i.spotlightId);
  for (const id of i.activeSpeakers) add(id);
  return i.step === 1 ? out.slice(0, Math.min(out.length, 2)) : out; // past pog'onada plitkalar kamayadi
}

/** O'qituvchi to'ri: sahna ishtirokchilaridan sahifa; hech qachon maxVideoViews dan ko'p emas */
export function teacherGridPage(stageIds: string[], page: number, pageSize = CLASS_QUALITY.teacherGridPage): { ids: string[]; pages: number } {
  const size = Math.max(1, Math.min(pageSize, CLASS_QUALITY.maxVideoViewsMobile));
  const pages = Math.max(1, Math.ceil(stageIds.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { ids: stageIds.slice(p * size, p * size + size), pages };
}

export interface PrecheckInput {
  downMbps: number;
  upMbps: number | null;
  rttMs: number;
  isTeacher: boolean;
}
export interface PrecheckVerdict {
  verdict: 'good' | 'weak' | 'audio_only';
  /** O'qituvchi uchun: yuklash tezligi yetarli emas */
  teacherUploadLow: boolean;
}

export function precheckVerdict(i: PrecheckInput): PrecheckVerdict {
  const p = CLASS_QUALITY.precheck;
  const verdict = i.downMbps >= p.goodDownMbps && i.rttMs <= p.maxGoodRttMs ? 'good' : i.downMbps >= p.weakDownMbps ? 'weak' : 'audio_only';
  return { verdict, teacherUploadLow: i.isTeacher && (i.upMbps === null || i.upMbps < p.minTeacherUpMbps) };
}

/** Qayta ulanish: urinish raqamiga mos kutish (call-machine bilan bir xil jadval) */
export const reconnectDelayMs = (attempt: number) => backoffDelay(attempt);
