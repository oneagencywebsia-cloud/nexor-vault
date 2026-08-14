import 'server-only';
import { supabaseAdmin } from './supabase-admin';

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 5;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Ventana deslizante de intentos fallidos por identificador (p.ej.
 * "login:email@x.com"). No bloquea intentos legítimos ni acumula estado en
 * memoria del proceso — cada invocación serverless es efímera, así que el
 * conteo vive en Supabase.
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('auth_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .gte('created_at', since);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }
  return { allowed: true };
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  await supabaseAdmin.from('auth_attempts').insert({ identifier });
}

/** Limpia los intentos fallidos de un identificador tras un login correcto. */
export async function clearAttempts(identifier: string): Promise<void> {
  await supabaseAdmin.from('auth_attempts').delete().eq('identifier', identifier);
}
