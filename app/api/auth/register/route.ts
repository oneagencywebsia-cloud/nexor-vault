import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || '').toLowerCase().trim();
  const authHash = String(body.authHash || '');
  const salt = String(body.salt || '');
  const kdfParams = body.kdfParams;

  if (!email || !authHash || !salt || !kdfParams) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Ese email ya está registrado' }, { status: 409 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .insert({ email, auth_hash: authHash, kdf_salt: salt, kdf_params: kdfParams })
    .select('id, email')
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 });
  }

  const token = await createSessionCookie({ userId: user.id, email: user.email });
  return NextResponse.json({ ok: true, userId: user.id, email: user.email, token });
}
