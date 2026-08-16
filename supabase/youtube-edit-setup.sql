-- Run or rerun this file in the Supabase SQL editor to allow the signed-in
-- LoopBlog admin to update their existing YouTube gallery entries.
drop policy if exists "Authenticated users update their YouTube videos" on public.youtube_videos;

create policy "Authenticated users update their YouTube videos"
on public.youtube_videos
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
