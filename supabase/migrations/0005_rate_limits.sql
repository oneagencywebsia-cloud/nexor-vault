-- Rate limiting anti fuerza bruta: cada fila es un intento fallido. Se
-- cuentan los intentos recientes por identificador (email) en una ventana
-- deslizante — sin Redis, aprovechando que ya tenemos Supabase.
create table if not exists auth_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null, -- p.ej. "login:email@x.com" o "totp:email@x.com"
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_attempts_identifier_time on auth_attempts(identifier, created_at);

alter table auth_attempts enable row level security;
