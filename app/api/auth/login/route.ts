import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSessionCookie, signPendingTotpToken } from '@/lib/session';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || '').toLowerCase().trim();
  const authHash = String(body.authHash || '');

  if (!email || !authHash) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('id, email, auth_hash, totp_enabled')
    .eq('email', email)
    .maybeSingle();

  if (!user || !safeCompare(user.auth_hash, authHash)) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  if (user.totp_enabled) {
    const pendingToken = await signPendingTotpToken({ userId: user.id, email: user.email });
    return NextResponse.json({ requiresTotp: true, pendingToken });
  }

  const token = await createSessionCookie({ userId: user.id, email: user.email });
  return NextResponse.json({ ok: true, userId: user.id, email: user.email, token });
}
