import 'server-only';
import { supabaseAdmin } from './supabase-admin';

export type TeamRole = 'owner' | 'editor' | 'viewer';

export async function getTeamMembership(teamId: string, userId: string): Promise<TeamRole | null> {
  const { data } = await supabaseAdmin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as TeamRole) ?? null;
}

export function canWrite(role: TeamRole | null): boolean {
  return role === 'owner' || role === 'editor';
}
