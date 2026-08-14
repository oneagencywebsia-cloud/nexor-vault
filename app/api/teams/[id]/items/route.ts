import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canWrite, getTeamMembership } from '@/lib/team-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!role) return NextResponse.json({ error: 'No eres miembro de este equipo' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('team_vault_items')
    .select('id, item_type, encrypted_blob, created_at, updated_at')
    .eq('team_id', teamId)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Error leyendo el vault del equipo' }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!canWrite(role)) return NextResponse.json({ error: 'Solo owner/editor pueden añadir items' }, { status: 403 });

  const body = await req.json();
  const { itemType, encryptedBlob } = body;
  if (!encryptedBlob?.iv || !encryptedBlob?.ciphertext) {
    return NextResponse.json({ error: 'encryptedBlob inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('team_vault_items')
    .insert({
      team_id: teamId,
      item_type: itemType || 'login',
      encrypted_blob: JSON.stringify(encryptedBlob),
      created_by: session.userId,
    })
    .select('id, item_type, encrypted_blob, created_at, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo crear el item' }, { status: 500 });
  return NextResponse.json({ item: data });
}
