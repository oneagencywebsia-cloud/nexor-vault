import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const { encryptedName } = body;
  if (!encryptedName?.iv || !encryptedName?.ciphertext) {
    return NextResponse.json({ error: 'encryptedName inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('folders')
    .update({ encrypted_name: JSON.stringify(encryptedName) })
    .eq('id', id)
    .eq('user_id', session.userId)
    .select('id, encrypted_name, parent_id, created_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo renombrar' }, { status: 404 });
  return NextResponse.json({ folder: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin.from('folders').delete().eq('id', id).eq('user_id', session.userId);

  if (error) return NextResponse.json({ error: 'No se pudo borrar la carpeta' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
