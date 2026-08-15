-- Carpetas dentro del vault de un equipo: mismo patrón que `folders`
-- (personal) pero el nombre se cifra con la team key en vez de la vault
-- key del usuario, porque cualquier miembro con esa key debe poder verlo.
create table if not exists team_folders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  encrypted_name text not null,
  parent_id uuid references team_folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table team_vault_items add column if not exists folder_id uuid references team_folders(id) on delete set null;

create index if not exists idx_team_folders_team on team_folders(team_id);
create index if not exists idx_team_vault_items_folder on team_vault_items(folder_id);

alter table team_folders enable row level security;
