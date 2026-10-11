import { API_URL, ApiError, apiRequest } from '../lib/api';

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
  paymentTiming: 'PAY_BEFORE' | 'PAY_AFTER';
  paymentInfoAvailable: boolean;
  bio: string;
  levels: string[];
  timezone: string;
  introVideoUrl: string | null;
  credentials: { kind: string; title: string }[];
}

export type DirectStatus = 'UNPAID' | 'PUPIL_MARKED_PAID' | 'TEACHER_CONFIRMED' | 'NOT_RECEIVED' | 'WAIVED';
export interface DirectPaymentView {
  bookingId: string;
  trial: boolean;
  side?: 'teacher' | 'pupil';
  status: DirectStatus | null;
  amountMinor?: number;
  paymentTiming?: 'PAY_BEFORE' | 'PAY_AFTER';
  teacher?: { id: string; name: string | null };
  hasProof?: boolean;
  canMarkPaid?: boolean;
  canConfirm?: boolean;
  canMarkNotReceived?: boolean;
  canWaive?: boolean;
  note?: string;
}

export interface OwnProfile {
  id: string;
  headline: string;
  bio: string;
  subjects: string[];
  levels: string[];
  languages: string[];
  priceMinor: number;
  introVideoUrl: string | null;
  instantBooking: boolean;
  paymentTiming: 'PAY_BEFORE' | 'PAY_AFTER';
  hasPhoto: boolean;
  verificationStatus: 'DRAFT' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason: string | null;
  timeOff: { id: string; startAt: string; endAt: string; reason: string | null }[];
}
export interface AvailabilityRuleView { weekday: number; start: string; end: string }

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
  isTrial?: boolean;
  reschedule?: { proposedStartAt: string; byMe: boolean } | null;
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
  file: { id: string; name: string; mime?: string; sizeBytes?: number } | null;
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
  send: (token: string, threadId: string, body: string, fileId?: string) => apiRequest<ChatMessage>(`/threads/${threadId}/messages`, { method: 'POST', token, body: fileId ? { body, fileId } : { body } }),
  fileUrl: (token: string, fileId: string) => apiRequest<{ url: string }>(`/files/${fileId}/download-url`, { method: 'POST', token, body: {} }),
  markRead: (token: string, threadId: string, upToSeq: number) => apiRequest(`/threads/${threadId}/read`, { method: 'POST', token, body: { upToSeq } }),
  blockThread: (token: string, threadId: string) => apiRequest<{ id: string }>('/blocks/thread', { method: 'POST', token, body: { threadId } }),
  reportThread: (token: string, threadId: string, reason: string) => apiRequest(`/threads/${threadId}/report`, { method: 'POST', token, body: { reason } }),
  blockTeacher: (token: string, teacherId: string) => apiRequest<{ id: string }>('/blocks/teacher', { method: 'POST', token, body: { teacherId } }),
  getPaymentInfo: (token: string) => apiRequest<{ set: boolean; cardLast4?: string; holderName?: string }>('/teachers/me/payment-info', { token }),
  setPaymentInfo: (token: string, cardNumber: string, holderName: string) =>
    apiRequest<{ set: boolean; cardLast4: string; holderName: string }>('/teachers/me/payment-info', { method: 'PUT', token, body: { cardNumber, holderName } }),
  removePaymentInfo: (token: string) => apiRequest<{ set: boolean }>('/teachers/me/payment-info', { method: 'DELETE', token }),
  pendingReviews: (token: string) => apiRequest<PendingReview[]>('/reviews/pending', { token }),
  myReviews: (token: string) => apiRequest<OwnReview[]>('/reviews/mine', { token }),
  createReview: (token: string, bookingId: string, rating: number, text: string) => apiRequest<OwnReview>(`/bookings/${bookingId}/review`, { method: 'POST', token, body: { rating, text } }),
  updateReview: (token: string, id: string, rating: number, text: string) => apiRequest<OwnReview>(`/reviews/${id}`, { method: 'PUT', token, body: { rating, text } }),
  replyReview: (token: string, id: string, text: string) => apiRequest<OwnReview>(`/reviews/${id}/reply`, { method: 'PUT', token, body: { text } }),
  reviewsPage: (token: string, teacherId: string) => apiRequest<ReviewList>(`/teachers/${teacherId}/reviews?pageSize=20`, { token }),
  requestReschedule: (token: string, bookingId: string, startAt: string) => apiRequest<Booking>(`/bookings/${bookingId}/reschedule`, { method: 'POST', token, body: { startAt } }),
  myClasses: (token: string) => apiRequest<ClassItem[]>('/classes/mine', { token }),
  classDetail: (token: string, id: string) => apiRequest<ClassDetail>(`/classes/${id}`, { token }),
  classSessions: (token: string, id: string) => apiRequest<ClassSessionItem[]>(`/classes/${id}/sessions`, { token }),
  createClass: (token: string, body: Record<string, unknown>) => apiRequest<{ id: string; joinCode: string; inviteToken: string }>('/classes', { method: 'POST', token, body }),
  updateClass: (token: string, id: string, body: Record<string, unknown>) => apiRequest<ClassDetail>(`/classes/${id}`, { method: 'PATCH', token, body }),
  cancelClass: (token: string, id: string) => apiRequest(`/classes/${id}/cancel`, { method: 'POST', token, body: {} }),
  cancelClassSession: (token: string, id: string, sessionId: string) => apiRequest(`/classes/${id}/sessions/${sessionId}/cancel`, { method: 'POST', token, body: {} }),
  regenerateClassCode: (token: string, id: string) => apiRequest<{ joinCode: string; inviteToken: string }>(`/classes/${id}/regenerate-code`, { method: 'POST', token, body: {} }),
  joinClass: (token: string, body: { code?: string; token?: string; studentId?: string }) => apiRequest<ClassDetail>('/classes/join', { method: 'POST', token, body }),
  leaveClass: (token: string, id: string, studentId: string) => apiRequest(`/classes/${id}/leave`, { method: 'POST', token, body: { studentId } }),
  removeClassPupil: (token: string, id: string, pupilId: string) => apiRequest(`/classes/${id}/pupils/${pupilId}`, { method: 'DELETE', token }),
  children: (token: string) => apiRequest<{ id: string; name: string | null }[]>('/guardian/children', { token }),
  roomState: (token: string, sid: string) => apiRequest<ClassRoomState>(`/class-sessions/${sid}`, { token }),
  roomRoster: (token: string, sid: string) => apiRequest<RosterRow[]>(`/class-sessions/${sid}/roster`, { token }),
  roomStart: (token: string, sid: string) => apiRequest<ClassRoomState>(`/class-sessions/${sid}/start`, { method: 'POST', token, body: {} }),
  roomHand: (token: string, sid: string, raised: boolean) => apiRequest(`/class-sessions/${sid}/hand`, { method: 'POST', token, body: { raised } }),
  roomStageMode: (token: string, sid: string, mode: string) => apiRequest(`/class-sessions/${sid}/stage/mode`, { method: 'POST', token, body: { mode } }),
  roomPost: (token: string, sid: string, path: string, body: object = {}) => apiRequest(`/class-sessions/${sid}/${path}`, { method: 'POST', token, body }),
  classMessages: (token: string, sid: string, after?: number) => apiRequest<ClassMsg[]>(`/class-sessions/${sid}/messages${after ? `?after=${after}` : ''}`, { token }),
  classSend: (token: string, sid: string, body: string) => apiRequest<ClassMsg>(`/class-sessions/${sid}/messages`, { method: 'POST', token, body: { body } }),
  classDeleteMessage: (token: string, sid: string, id: string) => apiRequest(`/class-sessions/${sid}/messages/${id}`, { method: 'DELETE', token }),
  classReportMessage: (token: string, sid: string, id: string, reason: string) => apiRequest(`/class-sessions/${sid}/messages/${id}/report`, { method: 'POST', token, body: { reason } }),
  classQuestions: (token: string, sid: string) => apiRequest<ClassQuestionItem[]>(`/class-sessions/${sid}/questions`, { token }),
  classAsk: (token: string, sid: string, text: string, anonymous: boolean) => apiRequest<ClassQuestionItem>(`/class-sessions/${sid}/questions`, { method: 'POST', token, body: { text, anonymous } }),
  classUpvote: (token: string, sid: string, id: string) => apiRequest(`/class-sessions/${sid}/questions/${id}/upvote`, { method: 'POST', token, body: {} }),
  classQuestionAction: (token: string, sid: string, id: string, action: 'answer' | 'later' | 'hide' | 'pin' | 'call', body: object = {}) => apiRequest(`/class-sessions/${sid}/questions/${id}/${action}`, { method: 'POST', token, body }),
  classFiles: (token: string, id: string, q = '') => apiRequest<ClassFileItem[]>(`/classes/${id}/files${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { token }),
  addClassFile: (token: string, id: string, fileId: string) => apiRequest<ClassFileItem>(`/classes/${id}/files`, { method: 'POST', token, body: { fileId } }),
  setClassFileDownload: (token: string, id: string, fid: string, allowDownload: boolean) => apiRequest(`/classes/${id}/files/${fid}`, { method: 'PATCH', token, body: { allowDownload } }),
  deleteClassFile: (token: string, id: string, fid: string) => apiRequest(`/classes/${id}/files/${fid}`, { method: 'DELETE', token }),
  classFileDownload: (token: string, id: string, fid: string) => apiRequest<{ url: string }>(`/classes/${id}/files/${fid}/download-url`, { method: 'POST', token, body: {} }),
  classFileReport: (token: string, id: string, fid: string, reason: string) => apiRequest(`/classes/${id}/files/${fid}/report`, { method: 'POST', token, body: { reason } }),
  present: (token: string, sid: string, fileId: string, page: number) => apiRequest(`/class-sessions/${sid}/present`, { method: 'POST', token, body: { fileId, page } }),
  presentStop: (token: string, sid: string) => apiRequest(`/class-sessions/${sid}/present/stop`, { method: 'POST', token, body: {} }),
  owed: (token: string) => apiRequest<OwedGroup[]>('/teachers/me/money/owed', { token }),
  remind: (token: string, bookingId: string) => apiRequest<{ reminded: number }>('/teachers/me/money/remind', { method: 'POST', token, body: { bookingId } }),
  income: (token: string, month: string) => apiRequest<IncomeView>(`/teachers/me/money/income?month=${month}`, { token }),
  myPayments: (token: string) => apiRequest<MyPaymentRow[]>('/direct-payments/mine', { token }),
  exportCsv: async (token: string, from: string, to: string) => {
    const res = await fetch(`${API_URL}/teachers/me/money/export.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new ApiError({ message: 'Export failed', code: 'EXPORT_FAILED' } as never, res.status);
    return res.text();
  },
  directPayment: (token: string, bookingId: string) => apiRequest<DirectPaymentView>(`/bookings/${bookingId}/direct-payment`, { token }),
  directAction: (token: string, bookingId: string, what: 'paid' | 'received' | 'not-received' | 'waive', body: object = {}) =>
    apiRequest<DirectPaymentView>(`/bookings/${bookingId}/direct-payment/${what}`, { method: 'POST', token, body }),
  revealCard: (token: string, teacherProfileId: string) =>
    apiRequest<{ cardNumber: string; holderName: string }>(`/teachers/${teacherProfileId}/payment-info/reveal`, { method: 'POST', token, body: {} }),
  catalogFull: (token: string) => apiRequest<{ subjects: string[]; levels: string[]; languages: string[] }>('/catalog', { token }),
  ownProfile: (token: string) => apiRequest<OwnProfile>('/teachers/me/profile', { token }),
  saveProfile: (token: string, body: Record<string, unknown>) => apiRequest<OwnProfile>('/teachers/me/profile', { method: 'PUT', token, body }),
  submitProfile: (token: string, ) => apiRequest<OwnProfile>('/teachers/me/submit', { method: 'POST', token, body: {} }),
  setPhoto: (token: string, fileId: string) => apiRequest<{ hasPhoto: boolean }>('/teachers/me/photo', { method: 'PUT', token, body: { fileId } }),
  getAvailability: (token: string) => apiRequest<AvailabilityRuleView[]>('/teachers/me/availability', { token }),
  saveAvailability: (token: string, rules: AvailabilityRuleView[]) => apiRequest<AvailabilityRuleView[]>('/teachers/me/availability', { method: 'PUT', token, body: { rules } }),
  addTimeOff: (token: string, startAt: string, endAt: string) => apiRequest('/teachers/me/time-off', { method: 'POST', token, body: { startAt, endAt } }),
  removeTimeOff: (token: string, id: string) => apiRequest(`/teachers/me/time-off/${id}`, { method: 'DELETE', token }),
  counterOffer: (token: string, bookingId: string, startAt: string) => apiRequest<Booking>(`/bookings/${bookingId}/counter-offer`, { method: 'POST', token, body: { startAt } }),
  acceptTime: (token: string, bookingId: string) => apiRequest<Booking>(`/bookings/${bookingId}/reschedule/accept`, { method: 'POST', token, body: {} }),
  rejectTime: (token: string, bookingId: string) => apiRequest<Booking>(`/bookings/${bookingId}/reschedule/reject`, { method: 'POST', token, body: {} }),
  moneySummary: (token: string) => apiRequest<{ unpaidLessons: number; awaitingConfirmation: number }>('/teachers/me/money/summary', { token }),
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

export interface OwedGroup { pupilName: string; count: number; totalMinor: number; remindBookingId: string; canRemind: boolean; lessons: { bookingId: string; startAt: string; amountMinor: number }[] }
export interface IncomeView { month: string; timezone: string; confirmedCount: number; confirmedMinor: number; awaitingConfirmation: number; unpaidLessons: number }
export interface MyPaymentRow { bookingId: string; status: string; amountMinor: number; startAt: string; teacher: { id: string; name: string } }
export interface PendingReview { bookingId: string; teacher: { id: string; name: string | null }; completedAt: string }
export interface OwnReview { id: string; bookingId: string; rating: number; text: string | null; status: string; reply: { text: string } | null; canEditUntil: string }

export interface ClassSessionItem { id: string; startAt: string; endAt: string; status: string; isTrial: boolean }
export interface ClassItem {
  id: string; title: string; subject: string; capacity: number; status: string; enrolled?: number;
  teacher?: { id: string; name: string | null }; pupil?: { id: string; name: string };
  next: { id: string; startAt: string; isTrial: boolean } | null;
}
export interface ClassDetail {
  id: string; title: string; subject: string; description: string; capacity: number; enrolled: number; priceMinor: number; status: string; role: 'teacher' | 'pupil';
  pupils?: { id: string; name: string | null }[]; classmates?: { name: string }[]; mySeats?: string[];
}
export interface ClassRoomState {
  id: string; role: 'teacher' | 'pupil'; status: string; startAt: string; lobbyOpensAt: string; stageMode: 'LISTEN_ONLY' | 'HAND_RAISE' | 'OPEN_STAGE'; locked: boolean;
  teacherReconnecting: boolean; teacherNoShow: boolean; stageCount: number; stageMax: number;
  presentation: { fileId: string; name: string; page: number; pageCount: number; renderedPages: number; renderStatus: string } | null;
  classId: string;
  me: { handRaised: boolean; stage: 'NONE' | 'VOICE' | 'VOICE_VIDEO'; removed: boolean } | null;
}
export interface RosterRow { pupilId: string; name: string | null; present: boolean; hand: boolean; stage: 'NONE' | 'VOICE' | 'VOICE_VIDEO'; removed: boolean }
export interface ClassMsg { id: string; seq: number; from: 'teacher' | 'pupil'; name: string; body: string | null; deleted: boolean; at: string }
export interface ClassQuestionItem {
  id: string; text: string; status: 'OPEN' | 'ANSWERED' | 'LATER' | 'HIDDEN'; pinned: boolean; upvotes: number; author: string | null; anonymous: boolean;
  mine: boolean; voted: boolean; reply: { text: string } | null;
}
export interface ClassFileItem { id: string; name: string; pageCount: number; renderedPages: number; renderStatus: 'PREPARING' | 'READY' | 'FAILED'; allowDownload: boolean; sizeBytes: number | null }
