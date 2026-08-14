import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Busca la clave pública de un usuario por email para poder compartirle un
// item. Solo devuelve la clave pública (por definición no sensible) — nunca
// datos del vault de ese usuario.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('id, public_key')
    .eq('email', email)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: 'No existe ninguna cuenta con ese email' }, { status: 404 });
  if (user.id === session.userId) return NextResponse.json({ error: 'No puedes compartir contigo mismo' }, { status: 400 });
  if (!user.public_key) {
    return NextResponse.json({ error: 'Ese usuario aún no ha abierto su vault (sin claves configuradas)' }, { status: 409 });
  }

  return NextResponse.json({ userId: user.id, publicKey: user.public_key });
}
