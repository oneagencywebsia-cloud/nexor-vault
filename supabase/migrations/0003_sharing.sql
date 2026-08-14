-- Claves asimétricas por usuario para compartir items zero-knowledge:
-- public_key es pública (spki, base64). encrypted_private_key es la clave
-- privada (pkcs8) cifrada con la vault key del propio usuario (AES-256-GCM)
-- — el servidor nunca ve la clave privada en claro.
alter table app_users add column if not exists public_key text;
alter table app_users add column if not exists encrypted_private_key text;

-- Un item compartido es un paquete cifrado híbrido: encrypted_blob es el
-- item cifrado con una AES key efímera, wrapped_key es esa AES key cifrada
-- con la clave pública RSA-OAEP del receptor. Solo el receptor (con su
-- clave privada) puede desenvolver la AES key y descifrar el item.
create table if not exists shared_items (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references app_users(id) on delete cascade,
  to_user_id uuid not null references app_users(id) on delete cascade,
  item_type text not null default 'login',
  encrypted_blob text not null,
  wrapped_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shared_items_to on shared_items(to_user_id);
create index if not exists idx_shared_items_from on shared_items(from_user_id);

alter table shared_items enable row level security;
