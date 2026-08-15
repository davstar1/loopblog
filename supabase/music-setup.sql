-- Run once in the Supabase SQL editor before adding music.
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  title text not null,
  artist text,
  audio_url text,
  embed_url text,
  artwork_url text,
  created_at timestamptz not null default now()
);

alter table public.music_tracks add column if not exists embed_url text;
alter table public.music_tracks add column if not exists artwork_url text;
alter table public.music_tracks alter column audio_url drop not null;

alter table public.music_tracks enable row level security;
drop policy if exists "Music is publicly readable" on public.music_tracks;
drop policy if exists "Authenticated users add music" on public.music_tracks;
drop policy if exists "Owners update music" on public.music_tracks;
drop policy if exists "Authenticated users update music" on public.music_tracks;
drop policy if exists "Owners delete music" on public.music_tracks;
drop policy if exists "Authenticated users delete music tracks" on public.music_tracks;
create policy "Music is publicly readable" on public.music_tracks for select using (true);
create policy "Authenticated users add music" on public.music_tracks for insert to authenticated with check (auth.uid() = user_id);
create policy "Authenticated users update music" on public.music_tracks for update to authenticated using (true) with check (true);
create policy "Authenticated users delete music tracks" on public.music_tracks for delete to authenticated using (true);

insert into storage.buckets (id, name, public) values ('loopblogmusic', 'loopblogmusic', true) on conflict (id) do update set public = true;
drop policy if exists "Music files are public" on storage.objects;
drop policy if exists "Authenticated users upload music" on storage.objects;
drop policy if exists "Authenticated users delete music" on storage.objects;
create policy "Music files are public" on storage.objects for select using (bucket_id = 'loopblogmusic');
create policy "Authenticated users upload music" on storage.objects for insert to authenticated with check (bucket_id = 'loopblogmusic');
create policy "Authenticated users delete music" on storage.objects for delete to authenticated using (bucket_id = 'loopblogmusic');

create table if not exists public.site_profile (
  id integer primary key default 1 check (id = 1),
  profile_image_url text,
  banner_image_url text,
  updated_at timestamptz not null default now()
);
alter table public.site_profile alter column profile_image_url drop not null;
alter table public.site_profile add column if not exists banner_image_url text;
alter table public.site_profile enable row level security;
drop policy if exists "Profile is publicly readable" on public.site_profile;
drop policy if exists "Authenticated users update profile" on public.site_profile;
drop policy if exists "Authenticated users edit profile" on public.site_profile;
create policy "Profile is publicly readable" on public.site_profile for select using (true);
create policy "Authenticated users update profile" on public.site_profile for insert to authenticated with check (id = 1);
create policy "Authenticated users edit profile" on public.site_profile for update to authenticated using (id = 1) with check (id = 1);

create table if not exists public.media_comments (
  id uuid primary key default gen_random_uuid(),
  media_kind text not null check (media_kind in ('video', 'music')),
  item_id text not null,
  author_name text not null check (char_length(author_name) between 1 and 80),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.media_comments enable row level security;
drop policy if exists "Media comments are public" on public.media_comments;
drop policy if exists "Visitors add media comments" on public.media_comments;
drop policy if exists "Admins edit media comments" on public.media_comments;
drop policy if exists "Admins delete media comments" on public.media_comments;
create policy "Media comments are public" on public.media_comments for select using (true);
create policy "Visitors add media comments" on public.media_comments for insert to anon, authenticated with check (true);
create policy "Admins edit media comments" on public.media_comments for update to authenticated using (true) with check (true);
create policy "Admins delete media comments" on public.media_comments for delete to authenticated using (true);

create table if not exists public.media_likes (
  id uuid primary key default gen_random_uuid(),
  media_kind text not null check (media_kind in ('video', 'music')),
  item_id text not null,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (media_kind, item_id, visitor_id)
);
alter table public.media_likes enable row level security;
drop policy if exists "Media likes are public" on public.media_likes;
drop policy if exists "Visitors add media likes" on public.media_likes;
drop policy if exists "Visitors remove own media likes" on public.media_likes;
create policy "Media likes are public" on public.media_likes for select using (true);
create policy "Visitors add media likes" on public.media_likes for insert to anon, authenticated with check (true);
create policy "Visitors remove own media likes" on public.media_likes for delete to anon, authenticated using (true);

create index if not exists media_comments_item_idx on public.media_comments (media_kind, item_id, created_at desc);
create index if not exists media_likes_item_idx on public.media_likes (media_kind, item_id);

-- Moderation access for the existing Journal comments table.
alter table public.comments enable row level security;
drop policy if exists "Admins read journal comments" on public.comments;
drop policy if exists "Admins edit journal comments" on public.comments;
drop policy if exists "Admins delete journal comments" on public.comments;
create policy "Admins read journal comments" on public.comments for select to authenticated using (true);
create policy "Admins edit journal comments" on public.comments for update to authenticated using (true) with check (true);
create policy "Admins delete journal comments" on public.comments for delete to authenticated using (true);
