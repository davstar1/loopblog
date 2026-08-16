-- Run or rerun this entire file in the Supabase SQL editor when the Follow feature changes.
create table if not exists public.site_follows (
  visitor_id uuid primary key,
  display_name text,
  wants_notifications boolean not null default false,
  notification_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(coalesce(notification_email, '')) <= 320),
  check (not wants_notifications or notification_email is not null)
);

alter table public.site_follows add column if not exists display_name text;

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
  p_wants_notifications boolean,
  p_email text,
  p_display_name text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_email text := nullif(lower(trim(p_email)), '');
  clean_name text := nullif(trim(p_display_name), '');
  total bigint;
begin
  if clean_name is not null and char_length(clean_name) > 80 then
    raise exception 'Follower name must be 80 characters or fewer.';
  end if;

  if p_wants_notifications and (
    clean_email is null or
    clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) then
    raise exception 'Enter a valid email address for notifications.';
  end if;

  insert into public.site_follows (visitor_id, display_name, wants_notifications, notification_email)
  values (p_visitor_id, clean_name, p_wants_notifications, case when p_wants_notifications then clean_email else null end)
  on conflict (visitor_id) do update set
    display_name = coalesce(excluded.display_name, site_follows.display_name),
    wants_notifications = excluded.wants_notifications,
    notification_email = excluded.notification_email,
    updated_at = now();

  select count(*) into total from public.site_follows;
  return total;
end;
$$;

-- Keep the previous three-argument call working during a rolling site update.
drop function if exists public.follow_loopblog(uuid, boolean, text);

create or replace function public.follow_loopblog(
  p_visitor_id uuid,
  p_wants_notifications boolean,
  p_email text
)
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.follow_loopblog(p_visitor_id, p_wants_notifications, p_email, null);
$$;

create or replace function public.admin_list_followers()
returns table (
  visitor_id uuid,
  display_name text,
  wants_notifications boolean,
  notification_email text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  return query
  select
    sf.visitor_id,
    sf.display_name,
    sf.wants_notifications,
    sf.notification_email,
    sf.created_at,
    sf.updated_at
  from public.site_follows sf
  order by sf.created_at desc;
end;
$$;

create or replace function public.admin_disable_follower_notifications(p_visitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  update public.site_follows
  set wants_notifications = false,
      notification_email = null,
      updated_at = now()
  where visitor_id = p_visitor_id;

  return found;
end;
$$;

create or replace function public.admin_remove_follower(p_visitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  delete from public.site_follows where visitor_id = p_visitor_id;
  return found;
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
revoke all on function public.follow_loopblog(uuid, boolean, text, text) from public;
revoke all on function public.unfollow_loopblog(uuid) from public;
revoke all on function public.admin_list_followers() from public;
revoke all on function public.admin_disable_follower_notifications(uuid) from public;
revoke all on function public.admin_remove_follower(uuid) from public;
grant execute on function public.get_follow_status(uuid) to anon, authenticated;
grant execute on function public.follow_loopblog(uuid, boolean, text) to anon, authenticated;
grant execute on function public.follow_loopblog(uuid, boolean, text, text) to anon, authenticated;
grant execute on function public.unfollow_loopblog(uuid) to anon, authenticated;
grant execute on function public.admin_list_followers() to authenticated;
grant execute on function public.admin_disable_follower_notifications(uuid) to authenticated;
grant execute on function public.admin_remove_follower(uuid) to authenticated;
