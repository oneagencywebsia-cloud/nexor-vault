import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeamMembership } from '@/lib/team-auth';

// El caller ya hizo el trabajo criptográfico en el cliente: desenvolvió su
// propia copia de la team key y la re-envolvió con la clave pública del
// invitado (RSA-OAEP). Este endpoint solo valida permisos y persiste la
// invitación — nunca ve la team key en claro.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id: teamId } = await params;

  const role = await getTeamMembership(teamId, session.userId);
  if (role !== 'owner') return NextResponse.json({ error: 'Solo el owner puede invitar' }, { status: 403 });

  const body = await req.json();
  const email = String(body.email || '').toLowerCase().trim();
  const inviteRole = body.role === 'viewer' ? 'viewer' : 'editor';
  const wrappedTeamKey = String(body.wrappedTeamKey || '');
  if (!email || !wrappedTeamKey) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  const { data: invitee } = await supabaseAdmin
    .from('app_users')
    .select('id, public_key')
    .eq('email', email)
    .maybeSingle();
  if (!invitee) return NextResponse.json({ error: 'No existe ninguna cuenta con ese email' }, { status: 404 });
  if (!invitee.public_key) {
    return NextResponse.json({ error: 'Ese usuario aún no ha abierto su vault (sin claves configuradas)' }, { status: 409 });
  }

  const { data: existingMember } = await supabaseAdmin
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('user_id', invitee.id)
    .maybeSingle();
  if (existingMember) return NextResponse.json({ error: 'Ya es miembro del equipo' }, { status: 409 });

  const { error } = await supabaseAdmin
    .from('team_invites')
    .insert({ team_id: teamId, invited_user_id: invitee.id, role: inviteRole, wrapped_team_key: wrappedTeamKey });

  if (error) return NextResponse.json({ error: 'No se pudo invitar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
