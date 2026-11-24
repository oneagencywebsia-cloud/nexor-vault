import 'server-only';

/** Lee el cuerpo JSON sin lanzar: un cuerpo roto da {} en vez de un 500. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * IP del cliente detrás del proxy inverso. Se usa la ÚLTIMA entrada de
 * X-Forwarded-For: es la que añade nuestro proxy; las anteriores las puede
 * inventar el cliente.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

/** true si la carpeta existe y es del usuario (null/undefined = sin carpeta, vale). */
export async function ownsFolder(userId: string, folderId: unknown): Promise<boolean> {
  if (folderId === null || folderId === undefined || folderId === '') return true;
  if (typeof folderId !== 'string') return false;
  const { supabaseAdmin } = await import('./supabase-admin');
  const { data } = await supabaseAdmin
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
