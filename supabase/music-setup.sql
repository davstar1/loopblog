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
alter table public.music_tracks alter column audio_url drop not null;

alter table public.music_tracks enable row level security;
drop policy if exists "Music is publicly readable" on public.music_tracks;
drop policy if exists "Authenticated users add music" on public.music_tracks;
drop policy if exists "Owners delete music" on public.music_tracks;
create policy "Music is publicly readable" on public.music_tracks for select using (true);
create policy "Authenticated users add music" on public.music_tracks for insert to authenticated with check (auth.uid() = user_id);
create policy "Owners delete music" on public.music_tracks for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('loopblogmusic', 'loopblogmusic', true) on conflict (id) do update set public = true;
drop policy if exists "Music files are public" on storage.objects;
drop policy if exists "Authenticated users upload music" on storage.objects;
create policy "Music files are public" on storage.objects for select using (bucket_id = 'loopblogmusic');
create policy "Authenticated users upload music" on storage.objects for insert to authenticated with check (bucket_id = 'loopblogmusic');

create table if not exists public.site_profile (
  id integer primary key default 1 check (id = 1),
  profile_image_url text not null,
  updated_at timestamptz not null default now()
);
alter table public.site_profile enable row level security;
drop policy if exists "Profile is publicly readable" on public.site_profile;
drop policy if exists "Authenticated users update profile" on public.site_profile;
drop policy if exists "Authenticated users edit profile" on public.site_profile;
create policy "Profile is publicly readable" on public.site_profile for select using (true);
create policy "Authenticated users update profile" on public.site_profile for insert to authenticated with check (id = 1);
create policy "Authenticated users edit profile" on public.site_profile for update to authenticated using (id = 1) with check (id = 1);
