import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ user: null });

  const { data } = await supabaseAdmin
    .from('app_users')
    .select('email, kdf_salt, kdf_params, totp_enabled, public_key, encrypted_private_key')
    .eq('id', session.userId)
    .maybeSingle();

  if (!data) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      email: data.email,
      salt: data.kdf_salt,
      kdfParams: data.kdf_params,
      totpEnabled: data.totp_enabled,
      publicKey: data.public_key,
      encryptedPrivateKey: data.encrypted_private_key ? JSON.parse(data.encrypted_private_key) : null,
    },
  });
}
