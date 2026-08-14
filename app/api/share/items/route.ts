import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Lista lo recibido (pendiente de aceptar/rechazar) y lo enviado (para que
// el remitente vea qué está pendiente del lado del receptor).
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const [incoming, outgoing] = await Promise.all([
    supabaseAdmin
      .from('shared_items')
      .select('id, item_type, encrypted_blob, wrapped_key, created_at, from_user:from_user_id(email)')
      .eq('to_user_id', session.userId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('shared_items')
      .select('id, item_type, created_at, to_user:to_user_id(email)')
      .eq('from_user_id', session.userId)
      .order('created_at', { ascending: false }),
  ]);

  if (incoming.error || outgoing.error) {
    return NextResponse.json({ error: 'Error leyendo shares' }, { status: 500 });
  }

  return NextResponse.json({ incoming: incoming.data, outgoing: outgoing.data });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const { toEmail, itemType, encryptedBlob, wrappedKey } = body;
  if (!toEmail || !encryptedBlob?.iv || !encryptedBlob?.ciphertext || !wrappedKey) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }

  const { data: recipient } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('email', String(toEmail).toLowerCase().trim())
    .maybeSingle();

  if (!recipient) return NextResponse.json({ error: 'No existe ninguna cuenta con ese email' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('shared_items')
    .insert({
      from_user_id: session.userId,
      to_user_id: recipient.id,
      item_type: itemType || 'login',
      encrypted_blob: JSON.stringify(encryptedBlob),
      wrapped_key: wrappedKey,
    })
    .select('id')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo compartir el item' }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
