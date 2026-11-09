begin;

alter table public.notification_preferences add column if not exists notifications_enabled boolean not null default true;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);
create index if not exists messages_pair_history_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc, id desc);
create index if not exists messages_incoming_unread_idx on public.messages (recipient_id, created_at desc) where read_at is null;
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);

alter table public.messages enable row level security;
drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages" on public.messages for select to authenticated
  using (auth.uid() in (sender_id, recipient_id));
drop policy if exists "Friends send messages" on public.messages;
create policy "Friends send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and read_at is null and exists (
    select 1 from public.friendships f
    where f.user_low = least(sender_id, recipient_id) and f.user_high = greatest(sender_id, recipient_id)
  ));
drop policy if exists "Recipients mark messages read" on public.messages;
create policy "Recipients mark messages read" on public.messages for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (sender_id, recipient_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

create or replace function public.validate_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.friendships
    where user_low = least(new.sender_id, new.recipient_id)
      and user_high = greatest(new.sender_id, new.recipient_id) for key share;
  if not found then raise exception 'You can only text current friends'; end if;
  new.body := trim(new.body);
  new.created_at := now();
  new.read_at := null;
  return new;
end;
$$;
drop trigger if exists validate_message_before_insert on public.messages;
create trigger validate_message_before_insert before insert on public.messages
  for each row execute function public.validate_message();

alter table public.notifications add column if not exists message_id uuid references public.messages(id) on delete cascade;
alter table public.notifications add column if not exists push_claimed_at timestamptz;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reminder_15', 'reminder_start', 'friend_request', 'message'));
alter table public.notifications drop constraint if exists notification_target;
alter table public.notifications add constraint notification_target check (
  (kind = 'friend_request' and friend_request_id is not null and event_id is null and message_id is null) or
  (kind = 'message' and message_id is not null and event_id is null and friend_request_id is null) or
  (kind in ('reminder_15', 'reminder_start') and event_id is not null and friend_request_id is null and message_id is null)
);
create unique index if not exists notifications_message_unique on public.notifications (message_id) where message_id is not null;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.respect_notification_preferences()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare preferences public.notification_preferences%rowtype;
begin
  select * into preferences from public.notification_preferences where user_id = new.user_id;
  if preferences.notifications_enabled = false then return null; end if;
  if new.kind = 'friend_request' and preferences.friend_request_notifications = false then return null; end if;
  if new.kind in ('reminder_15', 'reminder_start') then
    if preferences.reminders_enabled = false then return null; end if;
    if new.kind = 'reminder_15' and preferences.reminder_15_enabled = false then return null; end if;
    if new.kind = 'reminder_start' and preferences.reminder_start_enabled = false then return null; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists respect_notification_preferences on public.notifications;
create trigger respect_notification_preferences before insert on public.notifications
  for each row execute function public.respect_notification_preferences();

create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (user_id, message_id, kind) values (new.recipient_id, new.id, 'message');
  return new;
end;
$$;
drop trigger if exists notify_message on public.messages;
create trigger notify_message after insert on public.messages for each row execute function public.notify_message();

create or replace function public.text_inbox()
returns table (friend_id uuid, message_id uuid, body text, created_at timestamptz, unread_count bigint)
language sql stable security invoker set search_path = public, pg_temp as $$
  with visible as (
    select m.*, case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as peer
    from public.messages m where auth.uid() in (m.sender_id, m.recipient_id)
  ), latest as (
    select distinct on (peer) peer, id, body, created_at from visible order by peer, created_at desc, id desc
  )
  select latest.peer, latest.id, latest.body, latest.created_at,
    (select count(*) from visible incoming where incoming.peer = latest.peer and incoming.recipient_id = auth.uid() and incoming.read_at is null)
  from latest order by latest.created_at desc, latest.id desc;
$$;
revoke all on function public.text_inbox() from public, anon;
grant execute on function public.text_inbox() to authenticated;
revoke all on function public.validate_message(), public.notify_message(), public.respect_notification_preferences() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_preferences') then
      alter publication supabase_realtime add table public.notification_preferences;
    end if;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;