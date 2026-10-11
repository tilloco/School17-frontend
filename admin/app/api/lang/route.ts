import { NextRequest, NextResponse } from 'next/server';
import { LANGS } from '@/lib/dict';
import { sameOrigin } from '@/lib/proxy-allow';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get('origin'), req.headers.get('host'))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const { lang } = await req.json().catch(() => ({ lang: '' }));
  if (!(LANGS as readonly string[]).includes(lang)) return NextResponse.json({ message: 'Bad language' }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
