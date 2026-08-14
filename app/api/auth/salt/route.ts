import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Devuelve el salt/kdf_params de un email para poder derivar la key antes de
// autenticar (patrón "prelogin", igual que Bitwarden). No revela si el email
// existe: si no existe, se devuelve un salt determinista-pero-falso derivado
// del email para que el timing/response sea indistinguible.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 });

  const { data } = await supabaseAdmin
    .from('app_users')
    .select('kdf_salt, kdf_params')
    .eq('email', email)
    .maybeSingle();

  if (data) {
    return NextResponse.json({ salt: data.kdf_salt, kdfParams: data.kdf_params });
  }

  // Salt "señuelo" estable por email para no filtrar existencia de la cuenta.
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`decoy:${email}`));
  const decoySalt = Buffer.from(digest).toString('base64').slice(0, 22);
  return NextResponse.json({
    salt: decoySalt,
    kdfParams: { algorithm: 'argon2id', iterations: 3, memory: 19456, parallelism: 1, hashLength: 32 },
  });
}
