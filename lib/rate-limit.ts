import 'server-only';
import { supabaseAdmin } from './supabase-admin';

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 5;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

const BLOCKED: RateLimitResult = { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };

/** Borra de vez en cuando los intentos caducados para que la tabla no crezca sin límite. */
function maybePurge(): void {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  void supabaseAdmin.from('auth_attempts').delete().lt('created_at', cutoff).then(() => undefined);
}

/**
 * Ventana deslizante de intentos fallidos por identificador (p.ej.
 * "login:email@x.com"). No bloquea intentos legítimos ni acumula estado en
 * memoria del proceso — cada invocación serverless es efímera, así que el
 * conteo vive en Supabase. Si la base de datos falla, se bloquea (fail-closed):
 * antes un error dejaba pasar intentos ilimitados.
 */
export async function checkRateLimit(
  identifier: string,
  max: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
): Promise<RateLimitResult> {
  maybePurge();
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabaseAdmin
    .from('auth_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .gte('created_at', since);

  if (error) return BLOCKED;
  if ((count ?? 0) >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  return { allowed: true };
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  await supabaseAdmin.from('auth_attempts').insert({ identifier });
}

/**
 * Cuenta CADA llamada (no solo los fallos). Para endpoints donde el abuso es
 * la propia frecuencia: registro, búsqueda de usuarios, activar/desactivar 2FA…
 */
export async function consumeRateLimit(
  identifier: string,
  max: number,
  windowMs: number = WINDOW_MS,
): Promise<RateLimitResult> {
  const check = await checkRateLimit(identifier, max, windowMs);
  if (!check.allowed) return check;
  await recordFailedAttempt(identifier);
  return { allowed: true };
}

/** Limpia los intentos fallidos de un identificador tras un login correcto. */
export async function clearAttempts(identifier: string): Promise<void> {
  await supabaseAdmin.from('auth_attempts').delete().eq('identifier', identifier);
}

/** Respuesta 429 uniforme. */
export function tooManyRequests(rate: RateLimitResult): Response {
  return Response.json(
    { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
    { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 900) } },
  );
}
