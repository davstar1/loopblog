-- Run once in the Supabase SQL editor before publishing the Follow button.
create table if not exists public.site_follows (
  visitor_id uuid primary key,
  wants_notifications boolean not null default false,
  notification_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(coalesce(notification_email, '')) <= 320),
  check (not wants_notifications or notification_email is not null)
);

alter table public.site_follows enable row level security;
revoke all on public.site_follows from anon, authenticated;

create or replace function public.get_follow_status(p_visitor_id uuid)
returns table (follower_count bigint, is_following boolean, wants_notifications boolean)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.site_follows),
    exists(select 1 from public.site_follows where visitor_id = p_visitor_id),
    coalesce((select sf.wants_notifications from public.site_follows sf where sf.visitor_id = p_visitor_id), false);
$$;

create or replace function public.follow_loopblog(
  p_visitor_id uuid,
  p_wants_notifications boolean default false,
  p_email text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_email text := nullif(lower(trim(p_email)), '');
  total bigint;
begin
  if p_wants_notifications and (
    clean_email is null or
    clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) then
    raise exception 'Enter a valid email address for notifications.';
  end if;

  insert into public.site_follows (visitor_id, wants_notifications, notification_email)
  values (p_visitor_id, p_wants_notifications, case when p_wants_notifications then clean_email else null end)
  on conflict (visitor_id) do update set
    wants_notifications = excluded.wants_notifications,
    notification_email = excluded.notification_email,
    updated_at = now();

  select count(*) into total from public.site_follows;
  return total;
end;
$$;

create or replace function public.unfollow_loopblog(p_visitor_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  total bigint;
begin
  delete from public.site_follows where visitor_id = p_visitor_id;
  select count(*) into total from public.site_follows;
  return total;
end;
$$;

revoke all on function public.get_follow_status(uuid) from public;
revoke all on function public.follow_loopblog(uuid, boolean, text) from public;
revoke all on function public.unfollow_loopblog(uuid) from public;
grant execute on function public.get_follow_status(uuid) to anon, authenticated;
grant execute on function public.follow_loopblog(uuid, boolean, text) to anon, authenticated;
grant execute on function public.unfollow_loopblog(uuid) to anon, authenticated;
