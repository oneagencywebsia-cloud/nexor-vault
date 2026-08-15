import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canWrite, getTeamMembership } from '@/lib/team-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId, fid } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!canWrite(role)) return NextResponse.json({ error: 'Solo owner/editor pueden modificar carpetas' }, { status: 403 });

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
    if (parentId === fid) {
      return NextResponse.json({ error: 'Una carpeta no puede ser su propio padre' }, { status: 400 });
    }
    if (parentId) {
      const { data: allFolders } = await supabaseAdmin.from('team_folders').select('id, parent_id').eq('team_id', teamId);
      const descendants = new Set<string>([fid]);
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
    .from('team_folders')
    .update(updates)
    .eq('id', fid)
    .eq('team_id', teamId)
    .select('id, encrypted_name, parent_id, created_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar la carpeta' }, { status: 404 });
  return NextResponse.json({ folder: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId, fid } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!canWrite(role)) return NextResponse.json({ error: 'Solo owner/editor pueden borrar carpetas' }, { status: 403 });

  const { error } = await supabaseAdmin.from('team_folders').delete().eq('id', fid).eq('team_id', teamId);
  if (error) return NextResponse.json({ error: 'No se pudo borrar la carpeta' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
