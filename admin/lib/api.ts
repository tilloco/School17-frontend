import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Server komponentlar uchun backend klienti. Token httpOnly cookie'da (admin_token): brauzer skriptlari uni ko'rmaydi.
// ESLATMA: bu fayl avval mobil ilova klientining nusxasi bo'lib, kompilyatsiya bo'lmas edi (adminFetch yo'q edi). Qayta yozildi.
export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
/** Brauzer ochadigan imzolangan fayl havolalari uchun backendning OMMAVIY manzili (BACKEND_URL ichki bo'lishi mumkin) */
export const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || BACKEND_URL;

export class AdminApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function adminFetch<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const token = cookies().get('admin_token')?.value;
  if (!token) redirect('/login');
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new AdminApiError(0, 'Backend is unreachable');
  }
  if (res.status === 401) redirect('/login');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AdminApiError(res.status, (data && (Array.isArray(data.message) ? data.message.join(', ') : data.message)) || `HTTP ${res.status}`, data);
  return data as T;
}

/** Eski panel sahifalari uchun: /uploads/... nisbiy yo'llarni to'liq manzilga aylantiradi */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND_PUBLIC_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
