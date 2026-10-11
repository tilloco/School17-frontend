import type {
  AiRecommendation,
  ApiErrorBody,
  CourseModule,
  DashboardData,
  ExamHistoryItem,
  ExamResult,
  ExamSessionPayload,
  FreeQuota,
  LessonDetail,
  RequestOtpResponse,
  SubmitAnswerResult,
  User,
  VerifyOtpResponse,
} from '../types/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 15000;
export class ApiError extends Error {
  statusCode: number;
  code?: string;

  constructor(body: ApiErrorBody, statusCode: number) {
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    super(message || "Noma'lum xatolik yuz berdi");
    this.statusCode = statusCode;
    this.code = body.code;
  }
}
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  adminKey?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.adminKey) headers['x-admin-key'] = options.adminKey;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        { statusCode: 0, message: "Ulanish juda sekin. Qaytadan urinib ko'ring.", code: 'TIMEOUT' },
        0,
      );
    }
    // Tarmoq xatosi (server ishlamayapti, internet yo'q va h.k.)
    throw new ApiError(
      { statusCode: 0, message: "Serverga ulanib bo'lmadi. Internetni yoki server manzilini tekshiring." },
      0,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    throw new ApiError(data as ApiErrorBody, res.status);
  }

  return data as T;
}

export interface AdminLesson {
  id: string;
  title: string;
  order: number;
}

export interface AdminWeek {
  id: string;
  title: string;
  order: number;
  lessons: AdminLesson[];
}

export interface AdminModuleTree {
  id: string;
  title: string;
  order: number;
  weeks: AdminWeek[];
}

export const api = {
  // --- Auth ---
  
  // --- Profile ---
  getMe: (token: string) => request<User>('/users/me', { token }),

  updateProfile: (token: string, dto: { name?: string; examDate?: string }) =>
    request<User>('/users/me', { method: 'PATCH', token, body: dto }),

  getDashboard: (token: string) => request<DashboardData>('/users/dashboard', { token }),

  // --- Content ---
  // Backend endi bu ikkalasini ham login talab qiladi (anonim scraping'dan himoya
  // uchun) - shuning uchun token har doim yuborilishi kerak.
  listModules: (token: string) => request<CourseModule[]>('/content/modules', { token }),

  getLesson: (token: string, lessonId: string) =>
    request<LessonDetail>(`/content/lessons/${lessonId}`, { token }),

  // --- Quiz ---
  submitAnswer: (token: string, questionId: string, chosenIndex: number) =>
    request<SubmitAnswerResult>('/quiz/answer', { method: 'POST', token, body: { questionId, chosenIndex } }),

  completeLesson: (token: string, lessonId: string) =>
    request<{ message: string }>(`/quiz/lessons/${lessonId}/complete`, { method: 'POST', token }),

  getFreeQuota: (token: string) => request<FreeQuota>('/quiz/free-quota', { token }),

  // --- AI shaxsiylashtirilgan tavsiyalar (faqat Premium) ---
   getAiRecommendation: (token: string, forceRefresh = false) =>
    request<AiRecommendation>(`/ai/recommendation${forceRefresh ? '?refresh=true' : ''}`, { token }),

  // --- Messaging ---
  getConversations: (token: string) => request<any[]>('/conversations', { token }),

  startDm: (token: string, otherUserId: string) =>
    request<any>(`/conversations/dm/${otherUserId}`, { method: 'POST', token }),

  createGroup: (token: string, name: string, memberIds: string[]) =>
    request<any>('/conversations/group', { method: 'POST', token, body: { name, memberIds } }),

    getMessages: (token: string, conversationId: string, cursor?: string) =>
    request<any[]>(`/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ''}`, { token }),

  // --- Sinov imtihoni (mock exam) ---
  startExam: (token: string) => request<ExamSessionPayload>('/exam/start', { method: 'POST', token }),

  saveExamAnswer: (
    token: string,
    sessionId: string,
    answerId: string,
    data: { chosenIndex?: number; partAText?: string; partBText?: string },
  ) =>
    request<{ saved: boolean }>(`/exam/${sessionId}/answer/${answerId}`, {
      method: 'POST',
      token,
      body: data,
    }),

  submitExam: (token: string, sessionId: string) =>
    request<ExamResult>(`/exam/${sessionId}/submit`, { method: 'POST', token }),
  loginWithGoogle: (idToken: string) =>
  request<VerifyOtpResponse>('/auth/google', { method: 'POST', body: { idToken } }),

  adminLogin: (email: string, password: string) =>
  request<{ accessToken: string; admin: { id: string; email: string; role: string } }>(
    '/admin/auth/login',
    { method: 'POST', body: { email, password } },
  ),

  getExamResult: (token: string, sessionId: string) =>
    request<ExamResult>(`/exam/${sessionId}/result`, { token }),
  getExamHistory: (token: string) => request<ExamHistoryItem[]>('/exam/history', { token }),

  // --- Admin: savol qo'shish ---
  listModulesAdmin: (adminKey: string) => request<AdminModuleTree[]>('/content/admin/modules', { adminKey }),
    searchUsers: (token: string, query: string) =>
    request<any[]>(`/users/search?q=${encodeURIComponent(query)}`, { token }),

  createQuestionAdmin: (
    adminKey: string,
    dto: { lessonId: string; text: string; options: string[]; correctIndex: number; explanation: string },
  ) => request<{ id: string }>('/content/questions', { method: 'POST', adminKey, body: dto }),

  createQuestionsBulkAdmin: (adminKey: string, dto: { lessonId: string; text: string }) =>
    request<{ message: string; count: number }>('/content/questions/bulk', { method: 'POST', adminKey, body: dto }),
};

// Qo'shimcha modullar (masalan src/call) uchun umumiy so'rov funksiyasi
export const apiRequest = request;
