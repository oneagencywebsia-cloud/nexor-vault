import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSessionCookie, signPendingTotpToken } from '@/lib/session';
import { checkRateLimit, clearAttempts, recordFailedAttempt, tooManyRequests } from '@/lib/rate-limit';
import { hashAuthHash, verifyAuthHash } from '@/lib/auth-hash';
import { readJson } from '@/lib/request';

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = String(body.email || '').toLowerCase().trim();
  const authHash = String(body.authHash || '');

  if (!email || !authHash) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }

  const rateLimitId = `login:${email}`;
  const rate = await checkRateLimit(rateLimitId);
  if (!rate.allowed) return tooManyRequests(rate);

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('id, email, auth_hash, totp_enabled')
    .eq('email', email)
    .maybeSingle();

  const check = await verifyAuthHash(user?.auth_hash, authHash);
  if (!user || !check.ok) {
    await recordFailedAttempt(rateLimitId);
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  await clearAttempts(rateLimitId);

  // Cuenta antigua con el hash en claro: se guarda ya con scrypt + sal.
  if (check.needsUpgrade) {
    await supabaseAdmin.from('app_users').update({ auth_hash: await hashAuthHash(authHash) }).eq('id', user.id);
  }

  if (user.totp_enabled) {
    const pendingToken = await signPendingTotpToken({ userId: user.id, email: user.email });
    return NextResponse.json({ requiresTotp: true, pendingToken });
  }

  const token = await createSessionCookie({ userId: user.id, email: user.email }, { extension: body.client === 'extension' });
  return NextResponse.json({ ok: true, userId: user.id, email: user.email, token });
}
