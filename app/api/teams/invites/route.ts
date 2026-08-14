import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('team_invites')
    .select('id, role, wrapped_team_key, created_at, team:team_id(id, name)')
    .eq('invited_user_id', session.userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Error leyendo invitaciones' }, { status: 500 });
  return NextResponse.json({ invites: data });
}
