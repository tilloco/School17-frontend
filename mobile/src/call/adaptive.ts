// Adaptive call quality: who gets the bandwidth first, and how the picture degrades when the network gets worse.
// Pure logic (no React Native imports) so it is unit-tested on the laptop (shared/adaptive.spec.ts).
//
// Priorities, highest first:
//   1. Voice          always on, ~60 kbps, never touched.
//   2. Screen share   words must stay readable: the RESOLUTION is kept (1080p) and the FRAME RATE falls first (15 -> 3 fps),
//                     because slides and text hardly move.
//   3. Face camera    sharp when there is plenty of bandwidth; when it is tight the face drops to 360p, then 180p, and only at the very
//                     bottom is paused. A blurry face costs nothing; a blurry screen makes the lesson useless.
// Changes down are fast (a few seconds), changes up are slow and one step at a time, so the picture does not flicker (like WhatsApp).

export type CamLayer = 'high' | 'medium' | 'low' | 'off';
export interface CamTier { id: number; layer: CamLayer; kbps: number; fps: number; label: string }
export interface ScreenTier { id: number; kbps: number; fps: number; label: string }

export const AUDIO_KBPS = 60;
export const CAMERA_TIERS: CamTier[] = [
  { id: 0, layer: 'high', kbps: 2200, fps: 30, label: '720p 30' },
  { id: 1, layer: 'high', kbps: 1300, fps: 24, label: '720p 24' },
  { id: 2, layer: 'medium', kbps: 600, fps: 24, label: '360p 24' },
  { id: 3, layer: 'medium', kbps: 350, fps: 15, label: '360p 15' },
  { id: 4, layer: 'low', kbps: 150, fps: 12, label: '180p 12' },
  { id: 5, layer: 'off', kbps: 0, fps: 0, label: 'off' },
];
export const SCREEN_TIERS: ScreenTier[] = [
  { id: 0, kbps: 3500, fps: 15, label: '1080p 15' },
  { id: 1, kbps: 2200, fps: 12, label: '1080p 12' },
  { id: 2, kbps: 1300, fps: 8, label: '1080p 8' },
  { id: 3, kbps: 800, fps: 5, label: '1080p 5' },
  { id: 4, kbps: 450, fps: 3, label: '1080p 3' },
];
const CAM_FLOOR_KBPS = 150; // while sharing, keep this much for the face before the screen takes the rest

export interface LinkSample {
  /** the network's own estimate of our upload capacity (WebRTC availableOutgoingBitrate), kbps */
  availKbps?: number;
  /** what we actually sent in the last interval, kbps */
  upKbps?: number;
  downKbps?: number;
  rttMs?: number;
  lossPct?: number;
}
export interface CallContext { screenOn: boolean; cameraOn: boolean; remoteScreenOn: boolean }

export interface Plan {
  camera: CamTier;
  screen: ScreenTier | null;
  /** what to receive from the other side's camera */
  remoteCamera: 'high' | 'low' | 'off';
  /** why, for the small line in the quality card */
  reason: 'start' | 'network_worse' | 'network_better' | 'context';
}

/** Upload budget in kbps after safety margins; loss and delay mean the queue is already full, so we take less than the estimate says. */
export function budgetKbps(estKbps: number, lossPct = 0, rttMs = 0): number {
  const lossFactor = lossPct > 12 ? 0.5 : lossPct > 6 ? 0.65 : lossPct > 3 ? 0.8 : 1;
  const delayFactor = rttMs > 700 ? 0.6 : rttMs > 400 ? 0.8 : 1;
  return Math.max(0, estKbps * 0.85 * lossFactor * delayFactor - AUDIO_KBPS);
}

/** The best (camera, screen) pair that fits the budget, screen first. */
export function choose(budget: number, ctx: Pick<CallContext, 'screenOn' | 'cameraOn'>): { cam: number; screen: number } {
  const lastScreen = SCREEN_TIERS.length - 1;
  const off = CAMERA_TIERS.length - 1;
  if (ctx.screenOn) {
    const floor = ctx.cameraOn ? CAM_FLOOR_KBPS : 0;
    let s = SCREEN_TIERS.findIndex((t) => t.kbps + floor <= budget);
    if (s < 0) s = lastScreen; // even the lightest screen does not fit: keep it anyway, the face gives way
    if (!ctx.cameraOn) return { cam: off, screen: s };
    const rest = budget - SCREEN_TIERS[s].kbps;
    const c = CAMERA_TIERS.findIndex((t) => t.kbps > 0 && t.kbps <= rest);
    return { cam: c < 0 ? off : c, screen: s };
  }
  if (!ctx.cameraOn) return { cam: off, screen: 0 };
  const c = CAMERA_TIERS.findIndex((t) => t.kbps > 0 && t.kbps <= budget);
  return { cam: c < 0 ? off : c, screen: 0 };
}

/** What to pull from the other camera. The remote screen always keeps full quality. */
export function remoteCameraFor(s: LinkSample, ctx: Pick<CallContext, 'remoteScreenOn'>): 'high' | 'low' | 'off' {
  const loss = s.lossPct ?? 0;
  const rtt = s.rttMs ?? 0;
  if (loss > 10 || rtt > 800) return ctx.remoteScreenOn ? 'off' : 'low';
  if (loss > 4 || rtt > 400 || (s.downKbps !== undefined && ctx.remoteScreenOn && s.downKbps < 700 && s.downKbps > 0 && loss > 1.5)) return 'low';
  return 'high';
}

export const DOWN_STREAK = 2; // samples (2 s each) before stepping down: ~4 s
export const UP_STREAK = 8; // samples before stepping up: ~16 s of a clearly better network
export const UP_HOLD_MS = 15_000; // and at least this long since the last change

export class AdaptiveController {
  private cur: { cam: number; screen: number } | null = null;
  private est: number | undefined;
  private down = 0;
  private up = 0;
  private lastChange = 0;
  private remote: Plan['remoteCamera'] = 'high';
  private remoteStreak = 0;
  private lastCtx: CallContext | null = null;

  /** Call every sample (about every 2 s). Returns a new plan only when something should change. */
  update(sample: LinkSample, ctx: CallContext, now: number): Plan | null {
    const raw = sample.availKbps && sample.availKbps > 0 ? sample.availKbps : sample.upKbps && sample.upKbps > 0 ? sample.upKbps * 1.3 : undefined;
    if (raw !== undefined) {
      this.est = this.est === undefined ? raw : raw < this.est ? this.est * 0.5 + raw * 0.5 : this.est * 0.9 + raw * 0.1; // fast down, slow up
    }
    const est = this.est ?? 2500; // before the first measurement: a moderate start
    const target = choose(budgetKbps(est, sample.lossPct, sample.rttMs), ctx);
    const rem = remoteCameraFor(sample, ctx);
    let changed = false;
    let reason: Plan['reason'] = 'start';

    const ctxChanged = !!this.lastCtx && (this.lastCtx.screenOn !== ctx.screenOn || this.lastCtx.cameraOn !== ctx.cameraOn);
    this.lastCtx = { ...ctx };

    if (!this.cur) {
      this.cur = target;
      changed = true;
      this.lastChange = now;
    } else if (ctxChanged) {
      this.cur = target; // sharing started or stopped: re-plan right away, nobody should wait 16 s for a sharp screen
      this.lastChange = now;
      this.down = 0;
      this.up = 0;
      changed = true;
      reason = 'context';
    } else {
      const worse = target.cam > this.cur.cam || target.screen > this.cur.screen;
      const better = target.cam < this.cur.cam || target.screen < this.cur.screen;
      if (worse) {
        this.up = 0;
        this.down++;
        if (this.down >= DOWN_STREAK) {
          // down: jump straight to what fits (a congested link must not be left waiting)
          this.cur = { cam: Math.max(this.cur.cam, target.cam), screen: Math.max(this.cur.screen, target.screen) }; // only ever worsen here
          this.down = 0;
          this.lastChange = now;
          changed = true;
          reason = 'network_worse';
        }
      } else if (better) {
        this.down = 0;
        this.up++;
        if (this.up >= UP_STREAK && now - this.lastChange >= UP_HOLD_MS) {
          // up: ONE step, the screen first (readability), then the face
          if (target.screen < this.cur.screen) this.cur = { ...this.cur, screen: this.cur.screen - 1 };
          else if (target.cam < this.cur.cam) this.cur = { ...this.cur, cam: this.cur.cam - 1 };
          this.up = 0;
          this.lastChange = now;
          changed = true;
          reason = 'network_better';
        }
      } else {
        this.down = 0;
        this.up = 0;
      }
    }

    // the other camera: same idea, a little faster to reduce, slow to restore
    if (rem !== this.remote) {
      this.remoteStreak++;
      const reducing = (rem === 'off' && this.remote !== 'off') || (rem === 'low' && this.remote === 'high');
      if (reducing ? this.remoteStreak >= DOWN_STREAK : this.remoteStreak >= UP_STREAK) {
        this.remote = rem;
        this.remoteStreak = 0;
        changed = true;
        reason = reducing ? 'network_worse' : 'network_better';
      }
    } else {
      this.remoteStreak = 0;
    }

    if (!changed) return null;
    const cam = CAMERA_TIERS[this.cur.cam];
    return { camera: ctx.cameraOn ? cam : CAMERA_TIERS[CAMERA_TIERS.length - 1], screen: ctx.screenOn ? SCREEN_TIERS[this.cur.screen] : null, remoteCamera: this.remote, reason };
  }

  /** The upload estimate the controller works with (kbps), for tests and the quality card. */
  estimate(): number | undefined {
    return this.est;
  }
}
