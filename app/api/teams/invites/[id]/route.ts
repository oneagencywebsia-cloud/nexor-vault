import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Aceptar: la invitación ya trae wrapped_team_key envuelta específicamente
// para este usuario, así que solo hace falta moverla a team_members tal
// cual — no hace falta ningún trabajo criptográfico adicional en el server.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const { data: invite } = await supabaseAdmin
    .from('team_invites')
    .select('team_id, role, wrapped_team_key, invited_user_id')
    .eq('id', id)
    .maybeSingle();

  if (!invite || invite.invited_user_id !== session.userId) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { error: insertError } = await supabaseAdmin.from('team_members').insert({
    team_id: invite.team_id,
    user_id: session.userId,
    role: invite.role,
    wrapped_team_key: invite.wrapped_team_key,
  });
  if (insertError) return NextResponse.json({ error: 'No se pudo unir al equipo' }, { status: 500 });

  await supabaseAdmin.from('team_invites').delete().eq('id', id);
  return NextResponse.json({ ok: true, teamId: invite.team_id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const { data: invite } = await supabaseAdmin
    .from('team_invites')
    .select('invited_user_id')
    .eq('id', id)
    .maybeSingle();
  if (!invite || invite.invited_user_id !== session.userId) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from('team_invites').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'No se pudo rechazar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
