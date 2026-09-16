-- Summit of American Spaces in Nigeria 2026
-- Dedicated to Supabase project: americanspacesng (vrhrszqdqqqwryeqmmgu)
-- This migration intentionally does not touch the existing DoughLedger tables.

create extension if not exists pgcrypto;

create table if not exists public.days (
  id text primary key,
  day_number integer not null unique,
  date_label text not null,
  title text not null,
  departure_day boolean not null default false
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  day_id text not null references public.days(id) on delete cascade,
  sort_order integer not null,
  start_time text not null,
  title text not null,
  facilitator text,
  facilitator_bio text,
  facilitator_headshot_url text,
  unique(day_id, sort_order)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  anonymous_parking boolean not null default false,
  device_id text not null,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.parking_lot_posts (
  id uuid primary key default gen_random_uuid(),
  day_id text not null references public.days(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 2000),
  display_name text not null default 'Participant',
  anonymous boolean not null default false,
  device_id text,
  votes integer not null default 0 check (votes >= 0),
  visible boolean not null default true,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  day_id text references public.days(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option text not null,
  display_name text not null default 'Participant',
  anonymous boolean not null default false,
  device_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.session_resources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  title text not null,
  resource_url text not null,
  resource_type text,
  sort_order integer not null default 0
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants(id) on delete cascade,
  device_id text not null,
  session_id uuid references public.sessions(id) on delete set null,
  note_text text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(trim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists sessions_day_order_idx on public.sessions(day_id, sort_order);
create index if not exists parking_day_created_idx on public.parking_lot_posts(day_id, created_at desc);
create index if not exists polls_status_created_idx on public.polls(status, created_at desc);
create index if not exists poll_responses_poll_idx on public.poll_responses(poll_id, created_at);
create index if not exists notes_device_session_idx on public.notes(device_id, session_id);

-- Seed the published Summit programme. These values preserve the current programme source.
insert into public.days (id, day_number, date_label, title, departure_day) values
  ('day1', 1, 'Monday, September 21, 2026', 'Programme Day 1', false),
  ('day2', 2, 'Tuesday, September 22, 2026', 'Programme Day 2', false),
  ('day3', 3, 'Wednesday, September 23, 2026', 'Programme Day 3', false),
  ('day4', 4, 'Thursday, September 24, 2026', 'Departure Day', true)
on conflict (id) do update set
  day_number = excluded.day_number,
  date_label = excluded.date_label,
  title = excluded.title,
  departure_day = excluded.departure_day;

-- Sessions are inserted only when their day has no sessions yet, making the migration safe to rerun.
do $$
begin
  if not exists (select 1 from public.sessions limit 1) then
    insert into public.sessions (day_id, sort_order, start_time, title, facilitator) values
      ('day1', 1, '09:00', 'Arrival, Registration and Hall Setup', null),
      ('day1', 2, '11:00', 'Setting the Stage', 'Specialists'),
      ('day1', 3, '12:00', 'Lunch', null),
      ('day1', 4, '13:00', 'Opening and Welcome Remarks (+ Photo Opportunity)', 'CG Lagos'),
      ('day1', 5, '14:00', 'Overview: The AI Revolution and U.S. Public Diplomacy Priorities', 'Julia McKay (PAO, Lagos)'),
      ('day1', 6, '14:30', 'Review of American Spaces: Reach, Challenges, Opportunities to advance U.S. foreign policy priorities. (Pre-Summit Survey)', 'Specialists / Directors'),
      ('day1', 7, '15:00', 'Current use cases of AI by American Spaces in Nigeria', 'All Directors'),
      ('day1', 8, '15:30', 'Topic to be decided', 'Des Williamson'),
      ('day1', 9, '16:30', 'Wrap-Up and Closing', null),
      ('day2', 1, '08:00', 'Ice Breaker', 'Josephine'),
      ('day2', 2, '08:05', 'Hands-On Session: AI-Assisted Program Planning', 'Dr. Aondoana Orlu'),
      ('day2', 3, '09:15', 'Hands-On Session: AI Assisted Flyer and Graphic Designs', 'Samuel Eyitayo'),
      ('day2', 4, '11:00', 'Tea Break', null),
      ('day2', 5, '11:15', 'Hands-On Session: AI Flyer and Graphic Design', 'All Directors'),
      ('day2', 6, '12:00', 'Group Lunch', null),
      ('day2', 7, '13:00', 'Hands-On Session: AI for Audience Engagement and Presentation', 'Samuel Edeh and Grace Lamon'),
      ('day2', 8, '14:00', 'Hands-On Session: Use of Gemini NotebookLM', 'Hannah Fitter, (REPS, Accra)'),
      ('day2', 9, '15:00', 'Mapping ICS Goals to Achieving High Impacting American Spaces Programming', 'Julia McKay (PAO, Lagos) and Bill Couch (Public Engagement Officer, Abuja)'),
      ('day2', 10, '16:00', 'Hands-On Session: Programming American Spaces using ICS Goals', 'All Directors'),
      ('day2', 11, '16:45', 'Parking Lot and Day 2 Wrap-Up', 'Samuel Eyitayo'),
      ('day2', 12, '18:00', 'Networking Event – Casual Wear: Trivia Night at the hotel (Popcorn + Soda)', 'All Participants'),
      ('day3', 1, '08:00', 'Ice Breaker', 'Josephine'),
      ('day3', 2, '08:10', 'American Spaces Nigeria Strategic Plan: Review FY2026 and Plan FY2027', 'Bill Couch (Public Engagement Officer, Abuja)'),
      ('day3', 3, '09:10', 'Hands On Session: Introduction to Vibe Coding', 'Elijah Moses-Iyajini (YALI)'),
      ('day3', 4, '10:10', 'Tea Break', null),
      ('day3', 5, '10:25', 'Hands On Session: Introduction to Vibe Coding continued', 'Elijah Moses-Iyajini (YALI)'),
      ('day3', 6, '12:00', 'Group Lunch', null),
      ('day3', 7, '13:00', 'Financial matters and Looking Ahead', 'Julia McKay (PAO, Lagos)'),
      ('day3', 8, '13:30', 'Practice Session', 'All Directors'),
      ('day3', 9, '14:40', 'Summit Evaluation', 'All Directors'),
      ('day3', 10, '15:40', 'Closing Ceremony, Certificate Presentation, and Group Photo', 'Bill Couch (Public Engagement Officer, Abuja)'),
      ('day3', 11, '16:30', 'Parking Lot and Day 3 Wrap-Up', 'Specialists'),
      ('day3', 12, '18:00', 'Representation event (Venue: GQ)', null);
  end if;
end $$;

-- RLS: the public participant surface may register and read the Parking Lot.
-- No public update/delete policies are granted. Coordinator moderation remains a
-- controlled realtime command until a server-side coordinator identity is added.
alter table public.days enable row level security;
alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.parking_lot_posts enable row level security;
alter table public.polls enable row level security;
alter table public.poll_responses enable row level security;
alter table public.session_resources enable row level security;
alter table public.notes enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "summit public read days" on public.days;
create policy "summit public read days" on public.days for select to anon, authenticated using (true);

drop policy if exists "summit public read sessions" on public.sessions;
create policy "summit public read sessions" on public.sessions for select to anon, authenticated using (true);

drop policy if exists "summit participant register" on public.participants;
create policy "summit participant register" on public.participants for insert to anon, authenticated with check (true);

drop policy if exists "summit participant read own registration" on public.participants;
create policy "summit participant read own registration" on public.participants for select to anon, authenticated using (false);

drop policy if exists "summit public read parking" on public.parking_lot_posts;
create policy "summit public read parking" on public.parking_lot_posts for select to anon, authenticated using (visible = true);

drop policy if exists "summit participant post parking" on public.parking_lot_posts;
create policy "summit participant post parking" on public.parking_lot_posts for insert to anon, authenticated with check (true);

drop policy if exists "summit public read open polls" on public.polls;
create policy "summit public read open polls" on public.polls for select to anon, authenticated using (status = 'open');

drop policy if exists "summit participant record poll response" on public.poll_responses;
create policy "summit participant record poll response" on public.poll_responses for insert to anon, authenticated with check (true);

drop policy if exists "summit public read resources" on public.session_resources;
create policy "summit public read resources" on public.session_resources for select to anon, authenticated using (true);

drop policy if exists "summit public read announcements" on public.announcements;
create policy "summit public read announcements" on public.announcements for select to anon, authenticated using (true);

-- Participant notes are intentionally device-scoped at the application level.
drop policy if exists "summit participant notes insert" on public.notes;
create policy "summit participant notes insert" on public.notes for insert to anon, authenticated with check (true);
drop policy if exists "summit participant notes read" on public.notes;
create policy "summit participant notes read" on public.notes for select to anon, authenticated using (false);

-- Restrict mutation of published programme/configuration tables through the Data API.
revoke insert, update, delete on table public.days, public.sessions, public.session_resources from anon, authenticated;
revoke update, delete on table public.participants, public.parking_lot_posts, public.poll_responses, public.notes, public.announcements from anon, authenticated;
revoke insert, update, delete on table public.polls, public.announcements from anon, authenticated;

-- Explicit grants for the intended public surface.
grant select on public.days, public.sessions, public.parking_lot_posts, public.polls, public.session_resources, public.announcements to anon, authenticated;
grant insert on public.participants, public.parking_lot_posts, public.poll_responses, public.notes to anon, authenticated;

-- Realtime broadcast authorization is intentionally public for the participant channel.
-- Public channels are suitable for low-sensitivity event control messages; sensitive
-- coordinator credentials must never be embedded in the browser.
