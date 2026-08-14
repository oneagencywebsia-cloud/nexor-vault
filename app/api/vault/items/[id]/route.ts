import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const { encryptedBlob, folderId, itemType } = body;
  if (!encryptedBlob?.iv || !encryptedBlob?.ciphertext) {
    return NextResponse.json({ error: 'encryptedBlob inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('vault_items')
    .update({
      encrypted_blob: JSON.stringify(encryptedBlob),
      folder_id: folderId ?? null,
      item_type: itemType || 'login',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', session.userId) // scoping: solo puede editar sus propios items
    .select('id, item_type, encrypted_blob, folder_id, created_at, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('vault_items')
    .delete()
    .eq('id', id)
    .eq('user_id', session.userId);

  if (error) return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
