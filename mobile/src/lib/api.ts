import { deviceId } from './device-id';
import type { ApiErrorBody, User, VerifyOtpResponse } from '../types/api';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 15000;
/** A free server that has been idle needs up to a minute to wake; the second try waits for it instead of giving up again. */
const RETRY_TIMEOUT_MS = 45000;
export class ApiError extends Error {
  statusCode: number;
  code?: string;
  /** Serverning to'liq xato tanasi (masalan { missing: [...] }) */
  details: Record<string, unknown>;

  constructor(body: ApiErrorBody, statusCode: number) {
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    super(message || "Noma'lum xatolik yuz berdi");
    this.statusCode = statusCode;
    this.code = body.code;
    this.details = body as unknown as Record<string, unknown>;
  }
}
let unauthorized: (() => void) | null = null;
/** The auth provider registers what to do when the server says the saved sign-in is not valid any more. */
export function setUnauthorizedHandler(fn: (() => void) | null) { unauthorized = fn; }

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
}

let capturing: string[] | null = null;
/** Runs fn and reports which GET requests it started right away (screens use this to remember their last result). */
export function captureGets<T>(fn: () => T): { result: T; keys: string[] } {
  const previous = capturing;
  const keys: string[] = [];
  capturing = keys;
  try {
    return { result: fn(), keys };
  } finally {
    capturing = previous;
  }
}

/** Reads (GET) are tried once more after a short pause when the network blinks; writes are never repeated by themselves. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isRead = !options.method || options.method === 'GET';
  if (isRead && capturing) capturing.push(`${(options.token ?? '').slice(-12)}|${path}`);
  try {
    return await requestOnce<T>(path, options);
  } catch (e) {
    if (isRead && e instanceof ApiError && e.statusCode === 0) {
      await new Promise((r) => setTimeout(r, 700));
      return requestOnce<T>(path, options, RETRY_TIMEOUT_MS);
    }
    throw e;
  }
}

async function requestOnce<T>(path: string, options: RequestOptions = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.headers) Object.assign(headers, options.headers);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
    if (res.status === 401 && options.token) unauthorized?.(); // the saved sign-in is no longer valid: the app goes back to the welcome screen
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
  getMe: (token: string) => request<User>('/me', { token }),
  registerEmail: (body: { email: string; password: string; name: string; role: 'STUDENT' | 'TEACHER' | 'GUARDIAN'; dateOfBirth: string; acceptTerms: boolean; locale: string; username?: string }) =>
    request<{ accessToken: string }>('/auth/email/register', { method: 'POST', body }),
  loginEmail: (email: string, password: string) => request<{ accessToken: string }>('/auth/email/login', { method: 'POST', body: { email, password } }),
  requestPhoneCode: async (phone: string) => request<{ sent: boolean; ttlSeconds: number; devCode?: string }>('/auth/phone/request', { method: 'POST', body: { phone }, headers: { 'X-Device-Id': await deviceId() } }),
  verifyPhoneCode: (body: Record<string, unknown>) => request<{ accessToken?: string; needsProfile?: boolean }>('/auth/phone/verify', { method: 'POST', body }),
  loginWithGoogle: (idToken: string) => request<VerifyOtpResponse>('/auth/google', { method: 'POST', body: { idToken } }),
  usernameAvailable: (u: string) => request<{ ok: boolean; reason?: 'TAKEN' | 'BAD' }>(`/auth/username-check?u=${encodeURIComponent(u)}`),
};

export const apiRequest = request;
