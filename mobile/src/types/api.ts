export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
}

/** Signed-in account (GET /me). */
export interface User {
  id: string;
  name: string | null;
  email?: string | null;
  role: 'STUDENT' | 'GUARDIAN' | 'TEACHER' | 'ADMIN';
  locale?: 'uz' | 'ru' | 'en';
  timezone?: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  isNewUser: boolean;
}
