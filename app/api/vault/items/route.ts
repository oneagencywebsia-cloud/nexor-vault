import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('vault_items')
    .select('id, item_type, encrypted_blob, folder_id, created_at, updated_at')
    .eq('user_id', session.userId)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Error leyendo el vault' }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const { itemType, encryptedBlob, folderId } = body;
  if (!encryptedBlob?.iv || !encryptedBlob?.ciphertext) {
    return NextResponse.json({ error: 'encryptedBlob inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('vault_items')
    .insert({
      user_id: session.userId,
      item_type: itemType || 'login',
      encrypted_blob: JSON.stringify(encryptedBlob),
      folder_id: folderId || null,
    })
    .select('id, item_type, encrypted_blob, folder_id, created_at, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo crear el item' }, { status: 500 });
  return NextResponse.json({ item: data });
}
