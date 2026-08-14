import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Solo se usa en API routes (server). Nunca importar desde código de cliente.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
