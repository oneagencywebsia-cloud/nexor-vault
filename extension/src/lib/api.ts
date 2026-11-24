// Cliente de la API de Nexor. Usa `Authorization: Bearer` (nunca cookies:
// credentials 'omit'), tal y como prevé el servidor para la extensión.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  serverUrl: string,
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(new URL(path, serverUrl).toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión o la URL.', 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new ApiError(msg || `Error ${res.status}`, res.status);
  }
  return data as T;
}
