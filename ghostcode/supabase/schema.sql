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
