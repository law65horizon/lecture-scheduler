-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================
-- DEPARTMENTS
-- ============================================
create table departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  created_at  timestamptz default now()
);

-- ============================================
-- COHORTS
-- ============================================
create table cohorts (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references departments(id) on delete cascade,
  year_level     smallint not null check (year_level between 1 and 4),
  student_count  int not null default 0,
  unique (department_id, year_level)
);

-- ============================================
-- VENUES
-- ============================================
create table venues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  capacity     int not null,
  venue_type   text not null check (venue_type in ('LECTURE_HALL', 'LAB', 'SEMINAR_ROOM')),
  is_active    boolean not null default true
);

-- ============================================
-- TIME SLOTS
-- ============================================
create table time_slots (
  id           uuid primary key default gen_random_uuid(),
  day_of_week  smallint not null check (day_of_week between 1 and 5),
  start_time   time not null,
  end_time     time not null,
  is_active    boolean not null default true,
  unique (day_of_week, start_time)
);

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  role       text not null check (role in ('ADMIN', 'LECTURER', 'STUDENT')),
  email      text not null
);

-- Auto-create profile when a user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Unknown'),
    coalesce(new.raw_user_meta_data->>'role', 'STUDENT'),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- LECTURERS
-- ============================================
create table lecturers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  department_id  uuid not null references departments(id),
  staff_id       text not null unique
);

-- ============================================
-- STUDENTS
-- ============================================
create table students (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  cohort_id   uuid not null references cohorts(id),
  matric_no   text not null unique
);

-- ============================================
-- COURSES
-- ============================================
create table courses (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  title               text not null,
  credit_units        smallint not null,
  semester            smallint not null check (semester in (1, 2)),
  required_venue_type text check (required_venue_type in ('LECTURE_HALL', 'LAB', 'SEMINAR_ROOM')),
  is_repeat           boolean not null default false,
  created_at          timestamptz default now()
);

-- Which cohorts take this course
create table course_cohorts (
  course_id   uuid not null references courses(id) on delete cascade,
  cohort_id   uuid not null references cohorts(id) on delete cascade,
  primary key (course_id, cohort_id)
);

-- Which lecturer teaches this course
create table course_lecturers (
  course_id    uuid not null references courses(id) on delete cascade,
  lecturer_id  uuid not null references lecturers(id) on delete cascade,
  primary key (course_id, lecturer_id)
);

-- ============================================
-- TIMETABLE SESSIONS
-- ============================================
create table timetable_sessions (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses(id),
  lecturer_id     uuid not null references lecturers(id),
  venue_id        uuid not null references venues(id),
  time_slot_id    uuid not null references time_slots(id),
  academic_year   text not null,
  semester        smallint not null check (semester in (1, 2)),
  is_published    boolean not null default false,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  -- H1: no lecturer double-booking
  unique (lecturer_id, time_slot_id, academic_year, semester),
  -- H2: no venue double-booking
  unique (venue_id, time_slot_id, academic_year, semester)
);

-- Cohorts claimed by each session (enforces H3 at DB level)
create table session_cohorts (
  session_id    uuid not null references timetable_sessions(id) on delete cascade,
  cohort_id     uuid not null references cohorts(id),
  time_slot_id  uuid not null references time_slots(id),
  academic_year text not null,
  semester      smallint not null,
  primary key (session_id, cohort_id),
  -- H3: no cohort in two sessions at the same slot
  unique (cohort_id, time_slot_id, academic_year, semester)
);

-- ============================================
-- LECTURER UNAVAILABILITY (optional)
-- ============================================
create table lecturer_unavailability (
  id           uuid primary key default gen_random_uuid(),
  lecturer_id  uuid not null references lecturers(id) on delete cascade,
  time_slot_id uuid not null references time_slots(id),
  reason       text,
  unique (lecturer_id, time_slot_id)
);

-- ============================================
-- REALTIME NOTIFICATION TRIGGER
-- ============================================
create or replace function notify_timetable_change()
returns trigger as $$
begin
  perform pg_notify(
    'timetable_changed',
    json_build_object(
      'operation', TG_OP,
      'session_id', coalesce(new.id, old.id),
      'academic_year', coalesce(new.academic_year, old.academic_year),
      'semester', coalesce(new.semester, old.semester)
    )::text
  );
  return new;
end;
$$ language plpgsql;

create trigger timetable_change_trigger
  after insert or update or delete on timetable_sessions
  for each row execute function notify_timetable_change();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table profiles enable row level security;
alter table departments enable row level security;
alter table cohorts enable row level security;
alter table venues enable row level security;
alter table time_slots enable row level security;
alter table courses enable row level security;
alter table course_cohorts enable row level security;
alter table course_lecturers enable row level security;
alter table lecturers enable row level security;
alter table students enable row level security;
alter table timetable_sessions enable row level security;
alter table session_cohorts enable row level security;
alter table lecturer_unavailability enable row level security;

-- Helper function: get current user's role
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Reference data: everyone authenticated can read
create policy "authenticated read departments"
  on departments for select to authenticated using (true);

create policy "authenticated read cohorts"
  on cohorts for select to authenticated using (true);

create policy "authenticated read venues"
  on venues for select to authenticated using (true);

create policy "authenticated read time_slots"
  on time_slots for select to authenticated using (true);

create policy "authenticated read courses"
  on courses for select to authenticated using (true);

create policy "authenticated read course_cohorts"
  on course_cohorts for select to authenticated using (true);

create policy "authenticated read course_lecturers"
  on course_lecturers for select to authenticated using (true);

create policy "authenticated read lecturers"
  on lecturers for select to authenticated using (true);

-- Timetable: students and lecturers only see published sessions
create policy "read timetable sessions"
  on timetable_sessions for select to authenticated
  using (
    is_published = true
    or get_my_role() = 'ADMIN'
  );

create policy "read session cohorts"
  on session_cohorts for select to authenticated using (true);

-- Admin-only writes (handled via service role in API routes)
create policy "admin write departments"
  on departments for all to authenticated
  using (get_my_role() = 'ADMIN')
  with check (get_my_role() = 'ADMIN');

create policy "admin write cohorts"
  on cohorts for all to authenticated
  using (get_my_role() = 'ADMIN')
  with check (get_my_role() = 'ADMIN');

create policy "admin write venues"
  on venues for all to authenticated
  using (get_my_role() = 'ADMIN')
  with check (get_my_role() = 'ADMIN');

create policy "admin write time_slots"
  on time_slots for all to authenticated
  using (get_my_role() = 'ADMIN')
  with check (get_my_role() = 'ADMIN');

create policy "admin write courses"
  on courses for all to authenticated
  using (get_my_role() = 'ADMIN')
  with check (get_my_role() = 'ADMIN');

create policy "admin write timetable"
  on timetable_sessions for all to authenticated
  using (get_my_role() = 'ADMIN')
  with check (get_my_role() = 'ADMIN');

-- Profiles: users can read their own
create policy "read own profile"
  on profiles for select to authenticated
  using (id = auth.uid());