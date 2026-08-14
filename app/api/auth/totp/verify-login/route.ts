import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie, verifyPendingTotpToken } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTotp } from '@/lib/totp';
import { checkRateLimit, clearAttempts, recordFailedAttempt } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pendingToken = String(body.pendingToken || '');
  const code = String(body.code || '');

  const pending = await verifyPendingTotpToken(pendingToken);
  if (!pending) return NextResponse.json({ error: 'Sesión de login expirada, vuelve a intentarlo' }, { status: 401 });

  // Un código de 6 dígitos solo tiene 1M combinaciones — sin límite de
  // intentos sería fuerza-bruteable en minutos pese al 2FA.
  const rateLimitId = `totp:${pending.userId}`;
  const rate = await checkRateLimit(rateLimitId);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('totp_secret')
    .eq('id', pending.userId)
    .maybeSingle();

  if (!user?.totp_secret || !verifyTotp(user.totp_secret, code)) {
    await recordFailedAttempt(rateLimitId);
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
  }

  await clearAttempts(rateLimitId);

  const token = await createSessionCookie(pending);
  return NextResponse.json({ ok: true, userId: pending.userId, email: pending.email, token });
}
