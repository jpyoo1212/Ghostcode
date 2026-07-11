-- GhostCode database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists pgcrypto;

create table if not exists secrets (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  ciphertext  text not null,
  iv          text not null,
  auth_tag    text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used        boolean not null default false
);

create index if not exists idx_secrets_code on secrets (code);
create index if not exists idx_secrets_expires_at on secrets (expires_at);

-- Row Level Security is enabled with NO policies. This table is only ever
-- read/written from Next.js API routes using the service role key, which
-- bypasses RLS. No anon-key client access is possible or needed.
alter table secrets enable row level security;

-- Optional: hard auto-delete of expired rows every minute, independent of
-- whether anyone ever tries to decode them. Requires the pg_cron extension,
-- available on Supabase (Database -> Extensions -> pg_cron).
--
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'ghostcode-purge-expired',
--   '* * * * *',
--   $$ delete from secrets where expires_at < now() $$
-- );

-- =========================================================
-- Private Room feature (added on top of the existing schema)
-- =========================================================

create table if not exists rooms (
  id             uuid primary key default gen_random_uuid(),
  room_code      text not null unique,
  key_hash       text not null,
  creator_token  text not null unique,
  joiner_token   text unique,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists idx_rooms_room_code on rooms (room_code);

create table if not exists room_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  ciphertext  text not null,
  iv          text not null,
  sender_role text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists idx_room_messages_room_id on room_messages (room_id);
create index if not exists idx_room_messages_expires_at on room_messages (expires_at);

alter table rooms enable row level security;
alter table room_messages enable row level security;

-- Optional: purge expired rooms/messages every minute (requires pg_cron).
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'ghostcode-purge-expired-rooms',
--   '* * * * *',
--   $$
--     delete from room_messages where expires_at < now();
--     delete from rooms where last_active_at < now() - interval '2 hours';
--   $$
-- );
