import { apiRequest } from '../lib/api';
import type { QualityTier } from './call-machine';

export interface CallLobby {
  bookingId: string;
  status: string;
  mySide: 'TEACHER' | 'STUDENT';
  other: { name: string };
  startAt: string;
  endAt: string;
  joinWindow: { opensAt: string; closesAt: string };
  serverTime: string;
  canJoin: boolean;
  reason: 'NOT_CONFIRMED' | 'TOO_EARLY' | 'WINDOW_CLOSED' | null;
  provider: string;
  clientHints: { heartbeatSeconds: number; audioOnlyAfterPoorSamples: number; reconnectGraceSeconds: number; maxVideo: { width: number; height: number; fps: number; kbps: number } };
}

export interface CallToken {
  url: string;
  token: string;
  identity: string;
  expiresAt: string;
  provider: string;
}

export interface CallSummary {
  bookingId: string;
  status: string;
  finalized: boolean;
  scheduledSeconds: number;
  mySeconds: number;
  togetherSeconds: number;
  billableSeconds: number;
  outcome: string;
  note: string;
  canRejoin: boolean;
}

export interface QualityReport {
  rttMs?: number;
  lossPct?: number;
  bitrateKbps?: number;
  tier?: QualityTier | 'audio_only';
  joinMs?: number;
  reconnects?: number;
}

export const callApi = {
  lobby: (token: string, bookingId: string) => apiRequest<CallLobby>(`/calls/${bookingId}/lobby`, { token }),
  token: (token: string, bookingId: string) => apiRequest<CallToken>(`/calls/${bookingId}/token`, { method: 'POST', token, body: {} }),
  presence: (token: string, bookingId: string, event: 'joined' | 'heartbeat' | 'left', quality?: QualityReport) =>
    apiRequest<{ accepted: boolean }>(`/calls/${bookingId}/presence`, { method: 'POST', token, body: { event, quality } }),
  end: (token: string, bookingId: string) => apiRequest<CallSummary>(`/calls/${bookingId}/end`, { method: 'POST', token, body: {} }),
  summary: (token: string, bookingId: string) => apiRequest<CallSummary>(`/calls/${bookingId}/summary`, { token }),
};
