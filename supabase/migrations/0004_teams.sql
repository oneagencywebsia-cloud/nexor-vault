-- Vaults de equipo: una "team key" AES simétrica compartida por todos los
-- miembros, envuelta (RSA-OAEP) individualmente con la clave pública de
-- cada uno — igual mecanismo que shared_items pero para una key persistente
-- en vez de un item puntual. El nombre del equipo va en claro (como en
-- Bitwarden/Keeper orgs, no es dato sensible del vault).

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'editor', -- owner | editor | viewer
  wrapped_team_key text not null, -- team key cifrada con la public key de este miembro
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Invitaciones pendientes: mismo patrón accept/decline que shared_items.
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  invited_user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'editor',
  wrapped_team_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists team_vault_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  item_type text not null default 'login',
  encrypted_blob text not null, -- cifrado con la team key (AES-256-GCM)
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_team_invites_invited on team_invites(invited_user_id);
create index if not exists idx_team_vault_items_team on team_vault_items(team_id);

alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table team_vault_items enable row level security;
