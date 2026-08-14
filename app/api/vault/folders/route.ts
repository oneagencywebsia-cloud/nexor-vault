import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('folders')
    .select('id, encrypted_name, parent_id, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Error leyendo carpetas' }, { status: 500 });
  return NextResponse.json({ folders: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const { encryptedName, parentId } = body;
  if (!encryptedName?.iv || !encryptedName?.ciphertext) {
    return NextResponse.json({ error: 'encryptedName inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('folders')
    .insert({
      user_id: session.userId,
      encrypted_name: JSON.stringify(encryptedName),
      parent_id: parentId || null,
    })
    .select('id, encrypted_name, parent_id, created_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo crear la carpeta' }, { status: 500 });
  return NextResponse.json({ folder: data });
}
