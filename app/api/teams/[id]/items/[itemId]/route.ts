import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canWrite, getTeamMembership } from '@/lib/team-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId, itemId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!canWrite(role)) return NextResponse.json({ error: 'Solo owner/editor pueden editar' }, { status: 403 });

  const body = await req.json();
  const { encryptedBlob, itemType, folderId } = body;
  if (!encryptedBlob?.iv || !encryptedBlob?.ciphertext) {
    return NextResponse.json({ error: 'encryptedBlob inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('team_vault_items')
    .update({
      encrypted_blob: JSON.stringify(encryptedBlob),
      item_type: itemType || 'login',
      folder_id: folderId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('team_id', teamId)
    .select('id, item_type, encrypted_blob, folder_id, created_at, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId, itemId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!canWrite(role)) return NextResponse.json({ error: 'Solo owner/editor pueden borrar' }, { status: 403 });

  const { error } = await supabaseAdmin.from('team_vault_items').delete().eq('id', itemId).eq('team_id', teamId);
  if (error) return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
