-- Run or rerun this file in the Supabase SQL editor to let authenticated admins
-- permanently delete uploaded LoopBlog images from the loopblogimages bucket.
drop policy if exists "Authenticated admins delete LoopBlog images" on storage.objects;

create policy "Authenticated admins delete LoopBlog images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'loopblogimages');
