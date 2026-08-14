import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, clearAttempts, recordFailedAttempt } from '@/lib/rate-limit';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Re-verifica el master password de una sesión YA autenticada (usado por
// /unlock tras auto-lock). A propósito NO pasa por 2FA ni emite una sesión
// nueva: la sesión (cookie/token) sigue siendo la misma, solo se confirma
// que quien está desbloqueando conoce el master password.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const authHash = String(body.authHash || '');
  if (!authHash) return NextResponse.json({ error: 'Falta authHash' }, { status: 400 });

  const rateLimitId = `unlock:${session.userId}`;
  const rate = await checkRateLimit(rateLimitId);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('auth_hash')
    .eq('id', session.userId)
    .maybeSingle();

  if (!user || !safeCompare(user.auth_hash, authHash)) {
    await recordFailedAttempt(rateLimitId);
    return NextResponse.json({ error: 'Master password incorrecto' }, { status: 401 });
  }

  await clearAttempts(rateLimitId);
  return NextResponse.json({ ok: true });
}
