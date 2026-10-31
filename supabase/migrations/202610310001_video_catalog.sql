-- Apply in the staging Supabase project only.
create extension if not exists pgcrypto;

create table if not exists public.video_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  description text not null default '',
  category text not null,
  poster_url text,
  embed_url text not null,
  rights_holder text not null,
  license_reference text not null,
  license_expires_at timestamptz not null,
  status text not null default 'pending_review'
    check (status in ('draft','pending_review','approved','published','rejected','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_catalog_status_updated_idx
  on public.video_catalog (status, updated_at desc);

alter table public.video_catalog enable row level security;

-- No anon/authenticated policies are intentionally created.
-- The server API uses SUPABASE_SERVICE_ROLE_KEY after ADMIN_CMS_TOKEN validation.
revoke all on public.video_catalog from anon, authenticated;
grant all on public.video_catalog to service_role;
