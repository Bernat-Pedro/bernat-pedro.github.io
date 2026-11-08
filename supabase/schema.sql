create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  avatar_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_ci_unique on public.profiles (lower(username));

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_request_not_self check (requester_id <> recipient_id)
);
create index if not exists friend_requests_recipient_status_idx on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists friend_requests_requester_status_idx on public.friend_requests (requester_id, status, created_at desc);
create unique index if not exists friend_requests_one_pending_direction on public.friend_requests (requester_id, recipient_id) where status = 'pending';

create table if not exists public.friendships (
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint friendship_canonical_pair check (user_low < user_high)
);
create index if not exists friendships_user_high_idx on public.friendships (user_high, user_low);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  category text not null check (category in ('Dinner', 'Birthday', 'Outdoor', 'Celebration', 'Games', 'Travel', 'Other')),
  event_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  description text check (description is null or length(description) <= 1000),
  location text check (location is null or length(location) <= 200),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_time_order check ((all_day and ends_at is null) or (not all_day and ends_at > starts_at))
);
create index if not exists events_creator_date_idx on public.events (creator_id, event_date);
create index if not exists events_starts_at_idx on public.events (starts_at);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  reminders_enabled boolean not null default true,
  reminder_15_enabled boolean not null default true,
  reminder_start_enabled boolean not null default true,
  friend_request_notifications boolean not null default true,
  notification_sound boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  friend_request_id uuid references public.friend_requests(id) on delete cascade,
  kind text not null check (kind in ('reminder_15', 'reminder_start', 'friend_request')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notification_target check (
    (kind = 'friend_request' and friend_request_id is not null and event_id is null) or
    (kind <> 'friend_request' and event_id is not null and friend_request_id is null)
  )
);
create unique index if not exists notifications_event_kind_unique on public.notifications (user_id, event_id, kind) where event_id is not null;
create unique index if not exists notifications_friend_request_unique on public.notifications (user_id, friend_request_id) where friend_request_id is not null;
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create or replace function public.send_friend_request(recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender uuid := auth.uid();
  new_request uuid;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  if recipient_id is null or recipient_id = sender then raise exception 'You cannot send a request to yourself'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(sender::text, recipient_id::text) || ':' || greatest(sender::text, recipient_id::text), 0));
  if not exists (select 1 from public.profiles where id = recipient_id) then raise exception 'Profile not found'; end if;
  if exists (select 1 from public.friendships where user_low = least(sender, recipient_id) and user_high = greatest(sender, recipient_id)) then
    raise exception 'You are already friends';
  end if;
  if exists (select 1 from public.friend_requests fr where fr.status = 'pending' and ((fr.requester_id = sender and fr.recipient_id = $1) or (fr.requester_id = $1 and fr.recipient_id = sender))) then
    raise exception 'A pending request already exists between these accounts';
  end if;
  insert into public.friend_requests (requester_id, recipient_id) values (sender, recipient_id) returning id into new_request;
  return new_request;
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept_request boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.friend_requests%rowtype;
begin
  select * into request_row from public.friend_requests where id = request_id for update;
  if not found or request_row.recipient_id <> auth.uid() then raise exception 'Friend request not found'; end if;
  if request_row.status <> 'pending' then raise exception 'This request has already been handled'; end if;
  update public.friend_requests set status = case when accept_request then 'accepted' else 'declined' end, responded_at = now() where id = request_id;
  if accept_request then
    insert into public.friendships (user_low, user_high) values (least(request_row.requester_id, request_row.recipient_id), greatest(request_row.requester_id, request_row.recipient_id)) on conflict do nothing;
  end if;
end;
$$;

create or replace function public.remove_friend(friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or friend_id = current_user_id then raise exception 'Invalid friend'; end if;
  delete from public.friendships where user_low = least(current_user_id, friend_id) and user_high = greatest(current_user_id, friend_id);
  if not found then raise exception 'Friendship not found'; end if;
  update public.friend_requests set status = 'declined', responded_at = now()
  where status = 'accepted' and ((requester_id = current_user_id and recipient_id = friend_id) or (requester_id = friend_id and recipient_id = current_user_id));
end;
$$;

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, friend_request_id, kind)
  select new.recipient_id, new.id, 'friend_request'
  where new.status = 'pending'
    and coalesce((select friend_request_notifications from public.notification_preferences where user_id = new.recipient_id), true)
  on conflict (user_id, friend_request_id) where friend_request_id is not null do nothing;
  return new;
end;
$$;
drop trigger if exists friend_request_notification on public.friend_requests;
create trigger friend_request_notification after insert on public.friend_requests for each row execute function public.notify_friend_request();

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Request participants can view requests" on public.friend_requests;
create policy "Request participants can view requests" on public.friend_requests for select to authenticated using (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "Friends can see their relationship" on public.friendships;
create policy "Friends can see their relationship" on public.friendships for select to authenticated using (user_low = auth.uid() or user_high = auth.uid());

drop policy if exists "Events visible to creator and accepted friends" on public.events;
create policy "Events visible to creator and accepted friends" on public.events for select to authenticated using (
  creator_id = auth.uid() or exists (
    select 1 from public.friendships f where
      (f.user_low = auth.uid() and f.user_high = events.creator_id) or
      (f.user_high = auth.uid() and f.user_low = events.creator_id)
  )
);
drop policy if exists "Users create own events" on public.events;
create policy "Users create own events" on public.events for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists "Creators update own events" on public.events;
create policy "Creators update own events" on public.events for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
drop policy if exists "Creators delete own events" on public.events;
create policy "Creators delete own events" on public.events for delete to authenticated using (creator_id = auth.uid());

drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users view own notifications" on public.notifications;
create policy "Users view own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users create own event reminders" on public.notifications;
create policy "Users create own event reminders" on public.notifications for insert to authenticated with check (
  user_id = auth.uid() and kind <> 'friend_request' and exists (
    select 1 from public.events e where e.id = notifications.event_id and (
      e.creator_id = auth.uid() or exists (
        select 1 from public.friendships f where
          (f.user_low = auth.uid() and f.user_high = e.creator_id) or
          (f.user_high = auth.uid() and f.user_low = e.creator_id)
      )
    )
  )
);

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
       ('event-photos', 'event-photos', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can view profile pictures" on storage.objects;
create policy "Authenticated users can view profile pictures" on storage.objects for select to authenticated using (bucket_id = 'avatars');
drop policy if exists "Users upload own profile pictures" on storage.objects;
create policy "Users upload own profile pictures" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update own profile pictures" on storage.objects;
create policy "Users update own profile pictures" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own profile pictures" on storage.objects;
create policy "Users delete own profile pictures" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Friends can view allowed event photos" on storage.objects;
create policy "Friends can view allowed event photos" on storage.objects for select to authenticated using (
  bucket_id = 'event-photos' and exists (
    select 1 from public.events e where e.photo_path = name and (
      e.creator_id = auth.uid() or exists (
        select 1 from public.friendships f where
          (f.user_low = auth.uid() and f.user_high = e.creator_id) or
          (f.user_high = auth.uid() and f.user_low = e.creator_id)
      )
    )
  )
);
drop policy if exists "Users upload own event photos" on storage.objects;
create policy "Users upload own event photos" on storage.objects for insert to authenticated with check (bucket_id = 'event-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update own event photos" on storage.objects;
create policy "Users update own event photos" on storage.objects for update to authenticated using (bucket_id = 'event-photos' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'event-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own event photos" on storage.objects;
create policy "Users delete own event photos" on storage.objects for delete to authenticated using (bucket_id = 'event-photos' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
declare table_name text;
begin
  foreach table_name in array array['events', 'friend_requests', 'friendships', 'notifications'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

grant select, insert, update on public.profiles to authenticated;
grant select on public.friend_requests, public.friendships to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;