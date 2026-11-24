import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTotp } from '@/lib/totp';
import { checkRateLimit, clearAttempts, recordFailedAttempt, tooManyRequests } from '@/lib/rate-limit';
import { readJson } from '@/lib/request';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await readJson(req);
  const code = String(body.code || '');

  const rateLimitId = `totp-manage:${session.userId}`;
  const rate = await checkRateLimit(rateLimitId);
  if (!rate.allowed) return tooManyRequests(rate);

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('totp_secret')
    .eq('id', session.userId)
    .maybeSingle();

  if (!user?.totp_secret || !verifyTotp(user.totp_secret, code)) {
    await recordFailedAttempt(rateLimitId);
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
  }

  await clearAttempts(rateLimitId);

  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ totp_enabled: true })
    .eq('id', session.userId);

  if (error) return NextResponse.json({ error: 'No se pudo activar 2FA' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
