-- Keeper-clone: schema zero-knowledge
-- El servidor nunca ve master password ni vault key en claro.
-- Todo acceso desde la app pasa por API routes con la service role key
-- (que bypassa RLS), así que RLS aquí es defensa en profundidad por si
-- alguna vez se usa la anon key directamente contra la DB.

create extension if not exists "pgcrypto";

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  auth_hash text not null,          -- SHA-256(authKey), NUNCA la vault key ni el password
  kdf_salt text not null,           -- base64, único por usuario
  kdf_params jsonb not null,        -- {algorithm, iterations, memory, parallelism}
  created_at timestamptz not null default now()
);

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  encrypted_name text not null,     -- {iv, ciphertext} en base64, cifrado con vault key
  parent_id uuid references folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  item_type text not null default 'login', -- login | note | card
  encrypted_blob text not null,      -- {iv, ciphertext} en base64: título, usuario, password, notas, URL
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vault_items_user on vault_items(user_id);
create index if not exists idx_folders_user on folders(user_id);

alter table app_users enable row level security;
alter table folders enable row level security;
alter table vault_items enable row level security;

-- Sin políticas para anon/authenticated: solo la service role (usada en
-- los API routes de Next.js) puede leer/escribir. Esto es intencional:
-- el scoping por usuario lo aplica la app tras verificar la sesión.
