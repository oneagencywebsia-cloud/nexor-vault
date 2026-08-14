import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeamMembership } from '@/lib/team-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (!role) return NextResponse.json({ error: 'No eres miembro de este equipo' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('role, joined_at, user:user_id(email)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Error leyendo miembros' }, { status: 500 });
  return NextResponse.json({ members: data });
}
