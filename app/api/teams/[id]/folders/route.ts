import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canWrite, getTeamMembership } from '@/lib/team-auth';
import { sendPushToTeamMembers } from '@/lib/push';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!role) return NextResponse.json({ error: 'No eres miembro de este equipo' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('team_folders')
    .select('id, encrypted_name, parent_id, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Error leyendo carpetas del equipo' }, { status: 500 });
  return NextResponse.json({ folders: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!canWrite(role)) return NextResponse.json({ error: 'Solo owner/editor pueden crear carpetas' }, { status: 403 });

  const body = await req.json();
  const { encryptedName, parentId } = body;
  if (!encryptedName?.iv || !encryptedName?.ciphertext) {
    return NextResponse.json({ error: 'encryptedName inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('team_folders')
    .insert({ team_id: teamId, encrypted_name: JSON.stringify(encryptedName), parent_id: parentId || null })
    .select('id, encrypted_name, parent_id, created_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo crear la carpeta' }, { status: 500 });

  sendPushToTeamMembers(teamId, session.userId, {
    title: 'Nueva carpeta en el equipo',
    body: 'Se ha añadido una carpeta al vault del equipo.',
    url: `/teams/${teamId}`,
  }).catch(() => {});

  return NextResponse.json({ folder: data });
}
