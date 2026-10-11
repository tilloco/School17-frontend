import { apiRequest } from '../lib/api';

// Bozor (marketplace) API: backend/src/marketplace. Turlar faqat ekranlar ishlatadigan maydonlarni qamrab oladi.

export interface Me {
  id: string;
  name: string | null;
  role: 'STUDENT' | 'GUARDIAN' | 'TEACHER' | 'ADMIN';
  locale: 'uz' | 'ru' | 'en';
  timezone: string;
  isMinor: boolean;
  ageKnown: boolean;
}

export interface TeacherCard {
  id: string;
  name: string | null;
  headline: string;
  subjects: string[];
  languages: string[];
  priceMinor: number;
  currency: string;
  instantBooking: boolean;
  verified: true;
  rating: { count: number; average: number | null; bayesian: number };
}

export interface SearchResult {
  page: number;
  total: number;
  hasMore: boolean;
  ranking: { sort: string; description: string; paid: false };
  items: TeacherCard[];
}

export interface TeacherDetail extends TeacherCard {
  bio: string;
  levels: string[];
  timezone: string;
  introVideoUrl: string | null;
  credentials: { kind: string; title: string }[];
}

export interface ReviewList {
  summary: { count: number; average: number | null };
  items: { id: string; rating: number; text: string; author: string; createdAt: string; reply: { text: string } | null }[];
}

export interface SlotList {
  timezone: string;
  durationMin: number;
  slots: string[];
}

export interface Booking {
  id: string;
  status: string;
  myRole: 'student' | 'booker' | 'teacher';
  startAt: string;
  endAt: string;
  durationMin: number;
  priceMinor: number;
  teacher: { id: string; name: string | null };
  student: { id?: string; name: string | null };
  canJoinNow: boolean;
  cancel: { by: string; late: boolean } | null;
  lateCancelPolicy: { freeCancelHours: number };
}

export interface ThreadItem {
  id: string;
  myRole: 'TEACHER' | 'STUDENT' | 'GUARDIAN';
  other: { name: string | null };
  lastMessage: { preview: string; at: string; mine: boolean } | null;
  unread: number;
  readOnly: boolean;
}

export interface ChatMessage {
  id: string;
  seq: number;
  mine: boolean;
  from: 'TEACHER' | 'STUDENT';
  body: string;
  createdAt: string;
  state?: 'SENT' | 'DELIVERED' | 'READ';
  file: { name: string } | null;
}

export interface InboxItem {
  id: string;
  type: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  data: { bookingId?: string; threadId?: string } | null;
}

export interface Tips {
  note: string;
  tips: string[];
}

export interface LegalDoc {
  title: string;
  draftBanner: string;
  version: string;
  sections: { heading: string; body: string }[];
}

const q = (o: Record<string, string | number | undefined>) =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

export const market = {
  me: (token: string) => apiRequest<Me>('/me', { token }),
  catalog: (token: string) => apiRequest<{ subjects: string[]; languages: string[] }>('/catalog', { token }),
  search: (token: string, p: { q?: string; subject?: string; sort?: string; page?: number }) =>
    apiRequest<SearchResult>(`/teachers?${q({ q: p.q, subject: p.subject, sort: p.sort, page: p.page, pageSize: 20 })}`, { token }),
  teacher: (token: string, id: string) => apiRequest<TeacherDetail>(`/teachers/${id}`, { token }),
  reviews: (token: string, id: string) => apiRequest<ReviewList>(`/teachers/${id}/reviews?pageSize=3`, { token }),
  slots: (token: string, id: string, from: string, to: string, duration = 60) =>
    apiRequest<SlotList>(`/teachers/${id}/slots?${q({ from, to, duration })}`, { token }),
  book: (token: string, body: { teacherId: string; startAt: string; durationMin: number; studentId?: string }) =>
    apiRequest<Booking>('/bookings', { method: 'POST', token, body }),
  bookings: (token: string, from: string, to: string) => apiRequest<Booking[]>(`/bookings?${q({ from, to })}`, { token }),
  accept: (token: string, id: string) => apiRequest<Booking>(`/bookings/${id}/accept`, { method: 'POST', token, body: {} }),
  decline: (token: string, id: string) => apiRequest<Booking>(`/bookings/${id}/decline`, { method: 'POST', token, body: {} }),
  cancel: (token: string, id: string) => apiRequest<Booking>(`/bookings/${id}/cancel`, { method: 'POST', token, body: {} }),
  openThread: (token: string, bookingId: string) => apiRequest<ThreadItem>('/threads', { method: 'POST', token, body: { bookingId } }),
  threads: (token: string) => apiRequest<ThreadItem[]>('/threads', { token }),
  messages: (token: string, threadId: string, afterSeq?: number) =>
    apiRequest<ChatMessage[]>(`/threads/${threadId}/messages?${q({ afterSeq, limit: 50 })}`, { token }),
  send: (token: string, threadId: string, body: string) => apiRequest<ChatMessage>(`/threads/${threadId}/messages`, { method: 'POST', token, body: { body } }),
  markRead: (token: string, threadId: string, upToSeq: number) => apiRequest(`/threads/${threadId}/read`, { method: 'POST', token, body: { upToSeq } }),
  blockThread: (token: string, threadId: string) => apiRequest<{ id: string }>('/blocks/thread', { method: 'POST', token, body: { threadId } }),
  reportThread: (token: string, threadId: string, reason: string) => apiRequest(`/threads/${threadId}/report`, { method: 'POST', token, body: { reason } }),
  blockTeacher: (token: string, teacherId: string) => apiRequest<{ id: string }>('/blocks/teacher', { method: 'POST', token, body: { teacherId } }),
  getPaymentInfo: (token: string) => apiRequest<{ set: boolean; cardLast4?: string; holderName?: string }>('/teachers/me/payment-info', { token }),
  setPaymentInfo: (token: string, cardNumber: string, holderName: string) =>
    apiRequest<{ set: boolean; cardLast4: string; holderName: string }>('/teachers/me/payment-info', { method: 'PUT', token, body: { cardNumber, holderName } }),
  removePaymentInfo: (token: string) => apiRequest<{ set: boolean }>('/teachers/me/payment-info', { method: 'DELETE', token }),
  blocks: (token: string) => apiRequest<{ id: string; name: string | null }[]>('/blocks', { token }),
  unblock: (token: string, id: string) => apiRequest(`/blocks/${id}`, { method: 'DELETE', token }),
  inbox: (token: string) => apiRequest<InboxItem[]>('/notifications', { token }),
  readAll: (token: string) => apiRequest('/notifications/read-all', { method: 'POST', token, body: {} }),
  unreadCount: (token: string) => apiRequest<{ unread: number }>('/notifications/unread-count', { token }),
  tips: (audience: string, locale: string) => apiRequest<Tips>(`/safety/tips?${q({ audience, locale })}`),
  terms: (locale: string) => apiRequest<LegalDoc>(`/legal/terms?${q({ locale })}`),
  privacy: (locale: string) => apiRequest<LegalDoc>(`/legal/privacy?${q({ locale })}`),
  acceptConsent: (token: string, kind: string, version: string, locale: string) => apiRequest('/legal/consents', { method: 'POST', token, body: { kind, version, locale } }),
  guardianCode: (token: string) => apiRequest<{ code: string; expiresAt: string }>('/guardian/code', { method: 'POST', token, body: {} }),
  linkChild: (token: string, code: string) => apiRequest<{ childId: string; name: string | null }>('/guardian/link', { method: 'POST', token, body: { code } }),
  exportData: (token: string) => apiRequest<Record<string, unknown>>('/me/export', { token }),
  deleteAccount: (token: string) => apiRequest<{ ok: boolean }>('/me/delete', { method: 'POST', token, body: { confirm: 'DELETE' } }),
};
