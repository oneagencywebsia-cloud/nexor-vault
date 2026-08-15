import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeamMembership } from '@/lib/team-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (role !== 'owner') return NextResponse.json({ error: 'Solo el owner puede renombrar el equipo' }, { status: 403 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('teams').update({ name }).eq('id', teamId).select('id, name').single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo renombrar el equipo' }, { status: 500 });
  return NextResponse.json({ team: data });
}

// El caller (owner) ya no tiene forma de recuperar el team_vault_items una
// vez borrado (nunca tuvo la team key en el servidor, así que no hay nada
// que descifrar del lado del server); el cascade en Postgres se encarga
// de limpiar members/invites/items del equipo.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (role !== 'owner') return NextResponse.json({ error: 'Solo el owner puede eliminar el equipo' }, { status: 403 });

  const { error } = await supabaseAdmin.from('teams').delete().eq('id', teamId);
  if (error) return NextResponse.json({ error: 'No se pudo eliminar el equipo' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
