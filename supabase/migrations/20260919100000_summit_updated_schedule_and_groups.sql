-- Summit 2026 updated programme schedule and daily group rotations from the September 19, 2026 programme document.
begin;

alter table public.participants add column if not exists american_space text;

create table if not exists public.summit_group_assignments (
  id uuid primary key default gen_random_uuid(),
  day_id text not null references public.days(id) on delete cascade,
  group_number integer not null check (group_number between 1 and 6),
  american_space text not null,
  unique(day_id, american_space),
  unique(day_id, group_number, american_space)
);

alter table public.summit_group_assignments enable row level security;
drop policy if exists "Public can read Summit group assignments" on public.summit_group_assignments;
create policy "Public can read Summit group assignments"
  on public.summit_group_assignments for select to anon, authenticated using (true);
revoke insert, update, delete on public.summit_group_assignments from anon, authenticated;
grant select on public.summit_group_assignments to anon, authenticated;

-- Replace programme data with the exact schedule in the updated document.
update public.sessions set
  title = case sort_order
    when 1 then 'Arrival, Registration and Hall Setup'
    when 2 then 'Setting the Stage'
    when 3 then 'Lunch'
    when 4 then 'Opening and Welcome Remarks (+ Photo Opportunity)'
    when 5 then 'Overview: The AI Revolution and U.S. Public Diplomacy Priorities'
    when 6 then 'Review of American Spaces: Reach, Challenges, Opportunities to advance U.S. foreign policy priorities. (Pre-Summit Survey) - Experience sharing of what works and did not work'
    when 7 then 'Current use cases of AI by American Spaces in Nigeria'
    when 8 then 'Topic to be decided'
    when 9 then 'Wrap-Up and Closing'
  end,
  start_time = case sort_order
    when 1 then '09:00' when 2 then '11:00' when 3 then '12:00' when 4 then '13:00'
    when 5 then '14:00' when 6 then '14:30' when 7 then '15:00' when 8 then '15:30' when 9 then '16:30'
  end,
  facilitator = case sort_order
    when 1 then null when 2 then 'Specialists' when 3 then null when 4 then 'CG Lagos'
    when 5 then 'Julia McKay (PAO, Lagos)' when 6 then 'Specialists/ Directors' when 7 then 'All Directors'
    when 8 then 'Des Williamson' when 9 then null
  end
where day_id='day1';

update public.sessions set
  title = case sort_order
    when 1 then 'Ice Breaker'
    when 2 then 'Hands-On Session: AI-Assisted Program Planning - Using AI to draft program concepts, objectives, and Monitoring & Evaluation frameworks - Generating audience-specific content ideas'
    when 3 then 'Hands-On Session: AI Assisted Flyer and Graphic Designs - Using AI to Design Engaging Visual Content (flyers, graphics, programs)'
    when 4 then 'Tea Break'
    when 5 then 'Hands-On Session: AI Flyer and Graphic Design - Directors design program concepts, objectives, and accompanying flyers'
    when 6 then 'Group Lunch'
    when 7 then 'Hands-On Session: AI for Audience Engagement and Presentation - AI-powered email campaigns: personalized messaging using AI - AI-powered slide deck design or presentation'
    when 8 then 'Hands-On Session: Use of Gemini NotebookLM'
    when 9 then 'Mapping ICS Goals to Achieving High Impacting American Spaces Programming'
    when 10 then 'Hands-On Session: Programming American Spaces using ICS Goals'
    when 11 then 'Parking Lot and Day 2 Wrap-Up'
    when 12 then 'Networking Event – Casual Wear: Trivia Night at the hotel (Popcorn + Soda)'
  end,
  start_time = case sort_order
    when 1 then '08:00' when 2 then '08:05' when 3 then '09:15' when 4 then '11:00' when 5 then '11:15'
    when 6 then '12:00' when 7 then '13:00' when 8 then '14:00' when 9 then '15:00' when 10 then '16:00'
    when 11 then '16:45' when 12 then '18:00'
  end,
  facilitator = case sort_order
    when 1 then 'Josephine' when 2 then 'Dr. Aondoana Orlu' when 3 then 'Samuel Eyitayo' when 4 then null
    when 5 then 'All Directors' when 6 then null when 7 then 'Samuel Edeh and Grace Lamon'
    when 8 then 'Hannah Fitter, (REPS, Accra)' when 9 then 'Julia McKay (PAO, Lagos) and Bill Couch (Public Engagement Officer, Abuja)'
    when 10 then 'All Directors' when 11 then 'Samuel Eyitayo' when 12 then 'All Participants'
  end
where day_id='day2';

update public.sessions set
  title = case sort_order
    when 1 then 'Ice Breaker'
    when 2 then 'American Spaces Nigeria Strategic Plan: Review FY2026 and Plan FY2027'
    when 3 then 'Hands On Session: Introduction to Vibe Coding - What is vibe coding? (Using AI to write functional code through natural language prompts) - Real-world use cases for American Spaces: An automated program registration form with confirmation; A basic attendance/reporting dashboard; A WhatsApp auto-response bot for American Space inquiries'
    when 4 then 'Tea Break'
    when 5 then 'Hands On Session: Introduction to Vibe Coding continued'
    when 6 then 'Group Lunch'
    when 7 then 'Financial matters and Looking Ahead'
    when 8 then 'Practice Session'
    when 9 then 'Summit Evaluation'
    when 10 then 'Closing Ceremony, Certificate Presentation, and Group Photo'
    when 11 then 'Parking Lot and Day 2 Wrap-Up'
    when 12 then 'Representation event (Venue: GQ)'
  end,
  start_time = case sort_order
    when 1 then '08:00' when 2 then '08:10' when 3 then '09:10' when 4 then '10:10' when 5 then '10:25'
    when 6 then '12:00' when 7 then '13:00' when 8 then '13:30' when 9 then '14:40' when 10 then '15:40'
    when 11 then '16:30' when 12 then '18:00'
  end,
  facilitator = case sort_order
    when 1 then 'Josephine' when 2 then 'Bill Couch (Public Engagement Officer, Abuja)' when 3 then 'Elijah Moses-Iyajini (YALI)'
    when 4 then null when 5 then 'Elijah Moses-Iyajini (YALI)' when 6 then null when 7 then 'Julia McKay (PAO, Lagos)'
    when 8 then 'All Directors' when 9 then 'All Directors' when 10 then 'Bill Couch (Public Engagement Officer, Abuja)'
    when 11 then 'Specialists' when 12 then null
  end
where day_id='day3';

-- Remove synthetic facilitator data that was previously used for testing.
update public.sessions set facilitator=null, facilitator_bio=null, facilitator_headshot_url=null
where facilitator like 'Demo Facilitator%';

-- Preserve the source document's wording for the September 23 wrap-up row exactly as supplied.
-- NOTE: the source labels it "Day 2 Wrap-Up" even though it is on September 23.

delete from public.summit_group_assignments;

insert into public.summit_group_assignments(day_id,group_number,american_space) values
('day1',1,'Lagos (AmCenter)'),('day1',1,'Abuja'),('day1',1,'Kano'),('day1',1,'Enugu'),('day1',1,'Osogbo'),
('day1',2,'Calabar'),('day1',2,'Ikeja'),('day1',2,'Ibadan'),('day1',2,'Keffi'),('day1',2,'Yola'),
('day1',3,'Bauchi'),('day1',3,'Maiduguri'),('day1',3,'OgunTechHub'),('day1',3,'Katsina'),('day1',3,'Abeokuta'),
('day1',4,'Abuja (AmCenter)'),('day1',4,'Benin City'),('day1',4,'Zaria'),('day1',4,'Lekki'),
('day1',5,'Minna'),('day1',5,'Jos'),('day1',5,'Uyo'),('day1',5,'Gombe'),('day1',5,'UNILAG'),
('day1',6,'Sokoto'),('day1',6,'Awka'),('day1',6,'Markurdi'),('day1',6,'Port Harcourt'),('day1',6,'Dutse'),

('day2',1,'Calabar'),('day2',1,'Katsina'),('day2',1,'Sokoto'),('day2',1,'Gombe'),('day2',1,'Port Harcourt'),
('day2',2,'Lagos (AmCenter)'),('day2',2,'Maiduguri'),('day2',2,'Lekki'),('day2',2,'Minna'),('day2',2,'Dutse'),
('day2',3,'Abuja'),('day2',3,'Ikeja'),('day2',3,'Benin City'),('day2',3,'Markurdi'),('day2',3,'UNILAG'),
('day2',4,'OgunTechHub'),('day2',4,'Jos'),('day2',4,'Uyo'),('day2',4,'Bauchi'),
('day2',5,'Enugu'),('day2',5,'Keffi'),('day2',5,'Zaria'),('day2',5,'Ibadan'),('day2',5,'Awka'),
('day2',6,'Kano'),('day2',6,'Osogbo'),('day2',6,'Yola'),('day2',6,'Abeokuta'),('day2',6,'Abuja (AmCenter)'),

('day3',1,'Maiduguri'),('day3',1,'Zaria'),('day3',1,'Lekki'),('day3',1,'Port Harcourt'),('day3',1,'Ibadan'),
('day3',2,'Abuja (AmCenter)'),('day3',2,'Osogbo'),('day3',2,'Bauchi'),('day3',2,'Katsina'),('day3',2,'Abeokuta'),
('day3',3,'Enugu'),('day3',3,'Calabar'),('day3',3,'Yola'),('day3',3,'Minna'),('day3',3,'Dutse'),
('day3',4,'Lagos (AmCenter)'),('day3',4,'Keffi'),('day3',4,'Sokoto'),('day3',4,'UNILAG'),
('day3',5,'Markurdi'),('day3',5,'Ikeja'),('day3',5,'OgunTechHub'),('day3',5,'Awka'),('day3',5,'Uyo'),
('day3',6,'Kano'),('day3',6,'Abuja'),('day3',6,'Benin City'),('day3',6,'Jos'),('day3',6,'Gombe');

commit;