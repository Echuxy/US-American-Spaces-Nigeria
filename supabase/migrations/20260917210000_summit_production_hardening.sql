-- Summit production hardening
-- Authoritative live state, server-validated participant operations, private coordinator authorization.

begin;

create schema if not exists private;

create or replace function private.is_summit_coordinator()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(coalesce(u.email,'')) = lower('amcenterlagosinfo@gmail.com')
  );
$$;
revoke all on function private.is_summit_coordinator() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_summit_coordinator() to authenticated;

-- Storage authorization.
drop policy if exists "Summit coordinator can upload presentation files" on storage.objects;
create policy "Summit coordinator can upload presentation files" on storage.objects
  for insert to authenticated with check (bucket_id='summit-presentations' and (select private.is_summit_coordinator()));
drop policy if exists "Summit coordinator can update presentation files" on storage.objects;
create policy "Summit coordinator can update presentation files" on storage.objects
  for update to authenticated
  using (bucket_id='summit-presentations' and (select private.is_summit_coordinator()))
  with check (bucket_id='summit-presentations' and (select private.is_summit_coordinator()));
drop policy if exists "Summit coordinator can delete presentation files" on storage.objects;
create policy "Summit coordinator can delete presentation files" on storage.objects
  for delete to authenticated using (bucket_id='summit-presentations' and (select private.is_summit_coordinator()));

-- Public-table coordinator policies.
drop policy if exists "Coordinator can insert announcements" on public.announcements;
create policy "Coordinator can insert announcements" on public.announcements for insert to authenticated with check ((select private.is_summit_coordinator()));
drop policy if exists "summit coordinator delete notes" on public.notes;
create policy "summit coordinator delete notes" on public.notes for delete to authenticated using ((select private.is_summit_coordinator()));
drop policy if exists "Coordinator can update parking lot" on public.parking_lot_posts;
create policy "Coordinator can update parking lot" on public.parking_lot_posts for update to authenticated using ((select private.is_summit_coordinator())) with check ((select private.is_summit_coordinator()));
drop policy if exists "Coordinator can read participants" on public.participants;
create policy "Coordinator can read participants" on public.participants for select to authenticated using ((select private.is_summit_coordinator()));
drop policy if exists "summit coordinator delete participants" on public.participants;
create policy "summit coordinator delete participants" on public.participants for delete to authenticated using ((select private.is_summit_coordinator()));
drop policy if exists "Coordinator can insert polls" on public.polls;
create policy "Coordinator can insert polls" on public.polls for insert to authenticated with check ((select private.is_summit_coordinator()));
drop policy if exists "Coordinator can update polls" on public.polls;
create policy "Coordinator can update polls" on public.polls for update to authenticated using ((select private.is_summit_coordinator())) with check ((select private.is_summit_coordinator()));
drop policy if exists "summit coordinator delete session resources" on public.session_resources;
create policy "summit coordinator delete session resources" on public.session_resources for delete to authenticated using ((select private.is_summit_coordinator()));
drop policy if exists "summit coordinator insert session resources" on public.session_resources;
create policy "summit coordinator insert session resources" on public.session_resources for insert to authenticated with check ((select private.is_summit_coordinator()));
drop policy if exists "summit coordinator update session resources" on public.session_resources;
create policy "summit coordinator update session resources" on public.session_resources for update to authenticated using ((select private.is_summit_coordinator())) with check ((select private.is_summit_coordinator()));
drop policy if exists "summit coordinator update sessions" on public.sessions;
create policy "summit coordinator update sessions" on public.sessions for update to authenticated using ((select private.is_summit_coordinator())) with check ((select private.is_summit_coordinator()));

drop function if exists public.is_summit_coordinator();

create table if not exists public.summit_live_state (
  id integer primary key check (id = 1),
  day_id text not null references public.days(id) on delete restrict,
  session_index integer not null check (session_index >= 1),
  slide integer not null default 1 check (slide >= 1),
  updated_at timestamptz not null default now()
);
insert into public.summit_live_state(id,day_id,session_index,slide) values(1,'day1',1,1) on conflict(id) do nothing;
alter table public.summit_live_state enable row level security;
drop policy if exists "summit public read live state" on public.summit_live_state;
create policy "summit public read live state" on public.summit_live_state for select to anon, authenticated using(true);
revoke insert, update, delete on public.summit_live_state from anon, authenticated;
grant select on public.summit_live_state to anon, authenticated;

create or replace function public.register_summit_participant(p_display_name text,p_anonymous_parking boolean,p_device_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
  if p_device_id is null or char_length(trim(p_device_id)) < 8 then raise exception 'Invalid device identity'; end if;
  if char_length(trim(p_display_name)) not between 1 and 120 then raise exception 'Display name must be between 1 and 120 characters'; end if;
  insert into public.participants(display_name,anonymous_parking,device_id,last_seen_at)
  values(trim(p_display_name),coalesce(p_anonymous_parking,false),p_device_id,now())
  on conflict(device_id) do update set display_name=excluded.display_name,anonymous_parking=excluded.anonymous_parking,last_seen_at=now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.register_summit_participant(text,boolean,text) from public;
grant execute on function public.register_summit_participant(text,boolean,text) to anon,authenticated;

create or replace function public.touch_summit_participant(p_device_id text)
returns void language sql security definer set search_path=pg_catalog,public as $$
  update public.participants set last_seen_at=now() where device_id=p_device_id;
$$;
revoke all on function public.touch_summit_participant(text) from public;
grant execute on function public.touch_summit_participant(text) to anon,authenticated;

create or replace function public.summit_submit_parking_post(p_device_id text,p_day_id text,p_text text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_name text; v_anon boolean;
begin
  if not exists(select 1 from public.days where id=p_day_id and departure_day=false) then raise exception 'Invalid programme day'; end if;
  select display_name,anonymous_parking into v_name,v_anon from public.participants where device_id=p_device_id;
  if v_name is null then raise exception 'Participant registration required'; end if;
  if char_length(trim(p_text)) not between 1 and 2000 then raise exception 'Parking Lot post must be between 1 and 2000 characters'; end if;
  insert into public.parking_lot_posts(day_id,text,display_name,anonymous,device_id) values(p_day_id,trim(p_text),v_name,v_anon,p_device_id) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.summit_submit_parking_post(text,text,text) from public;
grant execute on function public.summit_submit_parking_post(text,text,text) to anon,authenticated;

create unique index if not exists poll_responses_poll_device_uidx on public.poll_responses(poll_id,device_id) where device_id is not null;
create index if not exists notes_participant_idx on public.notes(participant_id);
create index if not exists notes_session_idx on public.notes(session_id);
create index if not exists polls_day_idx on public.polls(day_id);
create index if not exists polls_session_idx on public.polls(session_id);
create index if not exists session_resources_session_idx on public.session_resources(session_id);
create index if not exists participants_last_seen_idx on public.participants(last_seen_at desc);

create or replace function public.summit_submit_poll_response(p_poll_id uuid,p_option text,p_device_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_name text; v_anon boolean; v_open boolean;
begin
  select (status='open') into v_open from public.polls where id=p_poll_id;
  if not coalesce(v_open,false) then raise exception 'Poll is closed or unavailable'; end if;
  if not exists(select 1 from public.polls where id=p_poll_id and options @> jsonb_build_array(p_option)) then raise exception 'Invalid poll option'; end if;
  select display_name,anonymous_parking into v_name,v_anon from public.participants where device_id=p_device_id;
  if v_name is null then raise exception 'Participant registration required'; end if;
  insert into public.poll_responses(poll_id,option,display_name,anonymous,device_id)
  values(p_poll_id,p_option,v_name,v_anon,p_device_id)
  on conflict(poll_id,device_id) do update set option=excluded.option,display_name=excluded.display_name,anonymous=excluded.anonymous,created_at=now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.summit_submit_poll_response(uuid,text,text) from public;
grant execute on function public.summit_submit_poll_response(uuid,text,text) to anon,authenticated;

create or replace function public.summit_coordinator_set_live_state(p_day_id text,p_session_index integer,p_slide integer default 1)
returns public.summit_live_state language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_row public.summit_live_state;
begin
  if not private.is_summit_coordinator() then raise exception 'Coordinator authorization required'; end if;
  if not exists(select 1 from public.sessions where day_id=p_day_id and sort_order=p_session_index) then raise exception 'Invalid Summit session'; end if;
  if p_slide < 1 then raise exception 'Slide must be at least 1'; end if;
  update public.summit_live_state set day_id=p_day_id,session_index=p_session_index,slide=p_slide,updated_at=now() where id=1 returning * into v_row;
  return v_row;
end; $$;
revoke all on function public.summit_coordinator_set_live_state(text,integer,integer) from public;
grant execute on function public.summit_coordinator_set_live_state(text,integer,integer) to authenticated;

create or replace function public.summit_coordinator_publish_announcement(p_text text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_id uuid;
begin
  if not private.is_summit_coordinator() then raise exception 'Coordinator authorization required'; end if;
  if char_length(trim(p_text)) not between 1 and 2000 then raise exception 'Announcement must be between 1 and 2000 characters'; end if;
  insert into public.announcements(text) values(trim(p_text)) returning id into v_id; return v_id;
end; $$;
revoke all on function public.summit_coordinator_publish_announcement(text) from public;
grant execute on function public.summit_coordinator_publish_announcement(text) to authenticated;

create or replace function public.summit_coordinator_publish_poll(p_day_id text,p_session_id uuid,p_question text,p_options jsonb)
returns public.polls language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_poll public.polls;
begin
  if not private.is_summit_coordinator() then raise exception 'Coordinator authorization required'; end if;
  if char_length(trim(p_question)) not between 1 and 500 then raise exception 'Poll question must be between 1 and 500 characters'; end if;
  if jsonb_typeof(p_options)<>'array' or jsonb_array_length(p_options) not between 2 and 8 then raise exception 'Poll must contain 2 to 8 options'; end if;
  update public.polls set status='closed',closed_at=now() where status='open';
  insert into public.polls(day_id,session_id,question,options,status) values(p_day_id,p_session_id,trim(p_question),p_options,'open') returning * into v_poll;
  return v_poll;
end; $$;
revoke all on function public.summit_coordinator_publish_poll(text,uuid,text,jsonb) from public;
grant execute on function public.summit_coordinator_publish_poll(text,uuid,text,jsonb) to authenticated;

create or replace function public.summit_coordinator_close_poll(p_poll_id uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.is_summit_coordinator() then raise exception 'Coordinator authorization required'; end if;
  if p_poll_id is null then
    update public.polls set status='closed',closed_at=now() where status='open';
  else
    update public.polls set status='closed',closed_at=now() where id=p_poll_id;
  end if;
end; $$;
revoke all on function public.summit_coordinator_close_poll(uuid) from public;
grant execute on function public.summit_coordinator_close_poll(uuid) to authenticated;

create or replace function public.summit_coordinator_moderate_parking(p_post_id uuid,p_visible boolean,p_pinned boolean default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.is_summit_coordinator() then raise exception 'Coordinator authorization required'; end if;
  update public.parking_lot_posts set visible=coalesce(p_visible,visible),pinned=coalesce(p_pinned,pinned) where id=p_post_id;
end; $$;
revoke all on function public.summit_coordinator_moderate_parking(uuid,boolean,boolean) from public;
grant execute on function public.summit_coordinator_moderate_parking(uuid,boolean,boolean) to authenticated;

-- Poll responses are readable only by the coordinator for live result counts.
drop policy if exists "Coordinator can read poll responses" on public.poll_responses;
create policy "Coordinator can read poll responses" on public.poll_responses for select to authenticated using ((select private.is_summit_coordinator()));
grant select on public.poll_responses to authenticated;

revoke insert on public.participants from anon,authenticated;
revoke insert on public.parking_lot_posts from anon,authenticated;
revoke insert on public.poll_responses from anon,authenticated;
revoke insert on public.announcements from anon,authenticated;
revoke insert,update,delete on public.polls from anon,authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='summit_live_state') then
    alter publication supabase_realtime add table public.summit_live_state;
  end if;
end $$;

commit;
