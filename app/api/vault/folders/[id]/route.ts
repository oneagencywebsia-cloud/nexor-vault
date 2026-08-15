import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const updates: Record<string, string | null> = {};

  if (body.encryptedName !== undefined) {
    if (!body.encryptedName?.iv || !body.encryptedName?.ciphertext) {
      return NextResponse.json({ error: 'encryptedName inválido' }, { status: 400 });
    }
    updates.encrypted_name = JSON.stringify(body.encryptedName);
  }

  if ('parentId' in body) {
    const parentId = body.parentId || null;
    if (parentId === id) {
      return NextResponse.json({ error: 'Una carpeta no puede ser su propio padre' }, { status: 400 });
    }
    if (parentId) {
      // Evita ciclos: el nuevo padre no puede ser un descendiente de esta carpeta.
      const { data: allFolders } = await supabaseAdmin
        .from('folders')
        .select('id, parent_id')
        .eq('user_id', session.userId);
      const descendants = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const f of allFolders ?? []) {
          if (f.parent_id && descendants.has(f.parent_id) && !descendants.has(f.id)) {
            descendants.add(f.id);
            grew = true;
          }
        }
      }
      if (descendants.has(parentId)) {
        return NextResponse.json({ error: 'No se puede mover una carpeta dentro de sí misma' }, { status: 400 });
      }
    }
    updates.parent_id = parentId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('folders')
    .update(updates)
    .eq('id', id)
    .eq('user_id', session.userId)
    .select('id, encrypted_name, parent_id, created_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar la carpeta' }, { status: 404 });
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
