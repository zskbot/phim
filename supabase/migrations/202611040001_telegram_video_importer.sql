-- Apply to the dedicated STAGING Supabase project only.
-- This migration does not alter existing production projects or records.
alter table public.video_catalog alter column embed_url drop not null;
alter table public.video_catalog
  add column if not exists source text not null default 'manual',
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_message_id bigint,
  add column if not exists telegram_file_unique_id text,
  add column if not exists storage_path text,
  add column if not exists media_mime_type text,
  add column if not exists media_size_bytes bigint,
  add column if not exists adult_content_compliant boolean not null default false;

create unique index if not exists video_catalog_telegram_file_unique
  on public.video_catalog (telegram_file_unique_id)
  where telegram_file_unique_id is not null;

create index if not exists video_catalog_telegram_published_idx
  on public.video_catalog (source, status, license_expires_at desc)
  where source = 'telegram';

-- Private bucket: public playback is exposed only through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tx-top-videos', 'tx-top-videos', false, 20971520, array['video/mp4','video/webm','video/quicktime','video/x-matroska'])
on conflict (id) do nothing;

-- No anon/authenticated storage policies are added. Server-side service-role access only.
