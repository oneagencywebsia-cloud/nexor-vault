import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Aprovisiona el par de claves de compartir (solo la primera vez — no
// sobreescribe si ya existen, para no invalidar shares/keys previos).
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const { publicKey, encryptedPrivateKey } = body;
  if (!publicKey || !encryptedPrivateKey?.iv || !encryptedPrivateKey?.ciphertext) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('app_users')
    .select('public_key')
    .eq('id', session.userId)
    .maybeSingle();

  if (existing?.public_key) {
    return NextResponse.json({ ok: true, alreadyExisted: true });
  }

  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ public_key: publicKey, encrypted_private_key: JSON.stringify(encryptedPrivateKey) })
    .eq('id', session.userId);

  if (error) return NextResponse.json({ error: 'No se pudo guardar la clave' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
