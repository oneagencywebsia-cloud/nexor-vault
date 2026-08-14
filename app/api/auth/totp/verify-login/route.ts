import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie, verifyPendingTotpToken } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTotp } from '@/lib/totp';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pendingToken = String(body.pendingToken || '');
  const code = String(body.code || '');

  const pending = await verifyPendingTotpToken(pendingToken);
  if (!pending) return NextResponse.json({ error: 'Sesión de login expirada, vuelve a intentarlo' }, { status: 401 });

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('totp_secret')
    .eq('id', pending.userId)
    .maybeSingle();

  if (!user?.totp_secret || !verifyTotp(user.totp_secret, code)) {
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
  }

  const token = await createSessionCookie(pending);
  return NextResponse.json({ ok: true, userId: pending.userId, email: pending.email, token });
}
