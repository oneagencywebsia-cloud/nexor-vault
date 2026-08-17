import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Solo se usa en API routes (server). Nunca importar desde código de cliente.
//
// Se crea perezosamente (via Proxy) en vez de al importar el módulo: Next.js
// evalúa todas las rutas API durante "Collecting page data" en el build, y
// en plataformas donde las env vars de servidor no están disponibles en
// build time (p.ej. Easypanel, a diferencia de Vercel) eso rompía el build
// aunque nunca se llegara a usar supabaseAdmin de verdad ahí. Con el Proxy,
// la validación y el cliente real solo se crean en la primera petición.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno');
  }
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
