-- Run or rerun this file in the Supabase SQL editor to allow the signed-in
-- LoopBlog admin to update their existing YouTube gallery entries.
alter table public.youtube_videos add column if not exists sort_order integer;

with ranked as (
  select id, (row_number() over (order by created_at desc) - 1)::integer as position
  from public.youtube_videos
)
update public.youtube_videos as video
set sort_order = ranked.position
from ranked
where video.id = ranked.id
  and video.sort_order is null;

create index if not exists youtube_videos_sort_order_idx
on public.youtube_videos (sort_order, created_at desc);

drop policy if exists "Authenticated users update their YouTube videos" on public.youtube_videos;

create policy "Authenticated users update their YouTube videos"
on public.youtube_videos
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
