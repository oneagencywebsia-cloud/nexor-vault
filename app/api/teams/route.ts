import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Equipos a los que pertenece el usuario, con su rol y su copia envuelta
// de la team key (solo él puede desenvolverla con su clave privada).
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('role, wrapped_team_key, team:team_id(id, name, owner_id)')
    .eq('user_id', session.userId);

  if (error) return NextResponse.json({ error: 'Error leyendo equipos' }, { status: 500 });
  return NextResponse.json({ teams: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  const wrappedTeamKey = String(body.wrappedTeamKey || '');
  if (!name || !wrappedTeamKey) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .insert({ name, owner_id: session.userId })
    .select('id, name')
    .single();
  if (teamError || !team) return NextResponse.json({ error: 'No se pudo crear el equipo' }, { status: 500 });

  const { error: memberError } = await supabaseAdmin
    .from('team_members')
    .insert({ team_id: team.id, user_id: session.userId, role: 'owner', wrapped_team_key: wrappedTeamKey });
  if (memberError) return NextResponse.json({ error: 'No se pudo unir al equipo creado' }, { status: 500 });

  return NextResponse.json({ ok: true, team });
}
