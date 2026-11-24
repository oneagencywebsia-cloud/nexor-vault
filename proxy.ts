import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Defensa CSRF en profundidad para la API. La sesión web va en una cookie
 * SameSite=Lax, que ya bloquea la mayoría de envíos cross-site, pero una
 * comprobación de Origin cierra los casos que Lax deja pasar (subdominios,
 * navegadores antiguos…).
 *
 * - Solo aplica a métodos que modifican datos.
 * - Las peticiones con cabecera Authorization (la extensión, que no usa
 *   cookies) no son vulnerables a CSRF y se dejan pasar.
 * - Si el navegador no envía Origin (herramientas, curl), no se bloquea.
 */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  if (!UNSAFE.has(req.method)) return NextResponse.next();
  if (req.headers.get('authorization')) return NextResponse.next();

  const origin = req.headers.get('origin');
  if (!origin) return NextResponse.next();

  const originHost = hostOf(origin);
  // Detrás de un proxy inverso el host público llega en x-forwarded-host.
  const allowed = new Set(
    [req.headers.get('x-forwarded-host'), req.headers.get('host'), req.nextUrl.host]
      .filter((h): h is string => !!h)
      .map((h) => h.split(',')[0].trim()),
  );

  if (!originHost || !allowed.has(originHost)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
