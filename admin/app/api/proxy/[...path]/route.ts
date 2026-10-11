import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_PUBLIC_URL, BACKEND_URL } from '@/lib/api';
import { isAllowedProxy, sameOrigin } from '@/lib/proxy-allow';

// Brauzer tugmalari (tasdiqlash, rad etish, ...) shu yerga POST qiladi; token httpOnly cookie'dan olinadi va backendga yuboriladi.
// Faqat ruxsat etilgan aniq yo'llar o'tadi (lib/proxy-allow.ts), kross-sayt so'rovlar rad etiladi.
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!sameOrigin(req.headers.get('origin'), req.headers.get('host'))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const path = params.path.join('/');
  if (!isAllowedProxy('POST', path)) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const body = await req.text();
  if (body.length > 20_000) return NextResponse.json({ message: 'Too large' }, { status: 413 });

  const res = await fetch(`${BACKEND_URL}/admin/market/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body || '{}',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  // Imzolangan fayl havolasi nisbiy bo'lib keladi: brauzer ocha oladigan to'liq manzilga aylantiramiz
  if (res.ok && typeof data?.url === 'string' && data.url.startsWith('/')) data.url = `${BACKEND_PUBLIC_URL}${data.url}`;
  return NextResponse.json(data, { status: res.status });
}
