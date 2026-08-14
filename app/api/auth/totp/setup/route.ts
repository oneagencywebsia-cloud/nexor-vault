import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildOtpauthUri, generateTotpSecret } from '@/lib/totp';

// Genera un secreto nuevo y lo guarda (sin activar aún — hace falta
// confirmar con un código válido en /api/auth/totp/enable para evitar
// que un typo en la app de autenticador deje al usuario bloqueado).
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const secret = generateTotpSecret();
  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ totp_secret: secret, totp_enabled: false })
    .eq('id', session.userId);

  if (error) return NextResponse.json({ error: 'No se pudo iniciar la configuración' }, { status: 500 });

  return NextResponse.json({ secret, otpauthUri: buildOtpauthUri(secret, session.email) });
}
