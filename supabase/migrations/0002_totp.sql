alter table app_users add column if not exists totp_secret text;
alter table app_users add column if not exists totp_enabled boolean not null default false;
