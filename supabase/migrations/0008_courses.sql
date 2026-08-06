-- CoachOS Phase 5: courses, modules, lessons, enrollments, lesson progress.
-- Run via `supabase db push` or paste into the Supabase SQL editor, against a
-- STAGING project first — see docs/architecture-decisions.md before applying
-- to production. Depends on 0001_init.sql (profiles, set_updated_at()) and
-- 0007_memberships.sql conceptually (enrollment implies an active client
-- relationship, though this migration doesn't hard-FK to it — a coach can
-- enroll a client without a general community membership if that's ever
-- useful, e.g. a course sold standalone).
--
-- Video hosting is Bunny Stream (accepted default). `external_video_url` is
-- a dev/import convenience only — not a first-class authoring path.
--
-- Layout: all tables + indexes first (in dependency order), then RLS +
-- policies + triggers grouped by table at the end — course/module/lesson
-- policies reference `enrollments`, so that table must physically exist
-- before those policies are created; defining all tables up front avoids
-- interleaving-order bugs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create type public.course_status as enum (
  'draft',
  'published',
  'archived'
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  status public.course_status not null default 'draft',
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_coach_id_idx on public.courses (coach_id);
create index if not exists courses_status_idx on public.courses (status);

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_modules_course_id_idx on public.course_modules (course_id);
create index if not exists course_modules_position_idx on public.course_modules (course_id, position);

create type public.lesson_video_status as enum (
  'processing',
  'ready',
  'failed'
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  bunny_library_id text,
  bunny_video_id text,
  external_video_url text, -- dev/import convenience only, see file header
  video_status public.lesson_video_status not null default 'processing',
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_module_id_idx on public.lessons (module_id);
create index if not exists lessons_position_idx on public.lessons (module_id, position);

-- enrollments: the explicit grant of client access to a specific course.
-- Manual coach-created enrollment for v1 (accepted default) — a clean seam
-- for later automatic enrollment from a Stripe purchase, not built here.
-- coach_id is denormalized from courses.coach_id for simpler RLS/queries on
-- lesson_progress below; kept in sync via trigger rather than trusted input.
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists enrollments_course_client_uniq on public.enrollments (course_id, client_id);
create index if not exists enrollments_course_id_idx on public.enrollments (course_id);
create index if not exists enrollments_client_id_idx on public.enrollments (client_id);
create index if not exists enrollments_coach_id_idx on public.enrollments (coach_id);

-- lesson_progress: durable per-client progress, one row per (enrollment,
-- lesson). Position/percent writes are expected to be throttled/checkpointed
-- by the application, not on every player timeupdate event.
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  last_position_seconds integer not null default 0,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lesson_progress_enrollment_lesson_uniq
  on public.lesson_progress (enrollment_id, lesson_id);
create index if not exists lesson_progress_enrollment_id_idx on public.lesson_progress (enrollment_id);
create index if not exists lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);

-- ---------------------------------------------------------------------------
-- RLS + policies + triggers
-- ---------------------------------------------------------------------------
alter table public.courses enable row level security;

create policy "courses: coach full access to own rows"
  on public.courses for all
  using (
    coach_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  )
  with check (
    coach_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

-- Client visibility is enrollment-gated, not membership-gated — seeing a
-- coach's community doesn't imply seeing every course; enrollment is the
-- explicit grant.
create policy "courses: client can view enrolled published courses"
  on public.courses for select
  using (
    status = 'published'
    and exists (
      select 1 from public.enrollments e
      where e.course_id = courses.id and e.client_id = auth.uid()
    )
  );

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute procedure public.set_updated_at();

alter table public.course_modules enable row level security;

create policy "course_modules: coach full access via owned course"
  on public.course_modules for all
  using (exists (select 1 from public.courses c where c.id = course_modules.course_id and c.coach_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_modules.course_id and c.coach_id = auth.uid()));

create policy "course_modules: client can view via enrollment"
  on public.course_modules for select
  using (
    exists (
      select 1 from public.courses c
      join public.enrollments e on e.course_id = c.id
      where c.id = course_modules.course_id and c.status = 'published' and e.client_id = auth.uid()
    )
  );

drop trigger if exists course_modules_set_updated_at on public.course_modules;
create trigger course_modules_set_updated_at
  before update on public.course_modules
  for each row execute procedure public.set_updated_at();

alter table public.lessons enable row level security;

create policy "lessons: coach full access via owned course"
  on public.lessons for all
  using (
    exists (
      select 1 from public.course_modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id and c.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id and c.coach_id = auth.uid()
    )
  );

create policy "lessons: client can view ready lessons via enrollment"
  on public.lessons for select
  using (
    video_status = 'ready'
    and exists (
      select 1 from public.course_modules m
      join public.courses c on c.id = m.course_id
      join public.enrollments e on e.course_id = c.id
      where m.id = lessons.module_id and c.status = 'published' and e.client_id = auth.uid()
    )
  );

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute procedure public.set_updated_at();

alter table public.enrollments enable row level security;

create policy "enrollments: coach full access to own rows"
  on public.enrollments for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "enrollments: client can view own enrollments"
  on public.enrollments for select
  using (client_id = auth.uid());

create or replace function public.enrollments_set_coach_id()
returns trigger
language plpgsql
as $$
begin
  select c.coach_id into new.coach_id from public.courses c where c.id = new.course_id;
  return new;
end;
$$;

drop trigger if exists enrollments_set_coach_id on public.enrollments;
create trigger enrollments_set_coach_id
  before insert or update of course_id on public.enrollments
  for each row execute procedure public.enrollments_set_coach_id();

drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute procedure public.set_updated_at();

alter table public.lesson_progress enable row level security;

create policy "lesson_progress: coach can view via owned enrollment"
  on public.lesson_progress for select
  using (exists (select 1 from public.enrollments e where e.id = lesson_progress.enrollment_id and e.coach_id = auth.uid()));

create policy "lesson_progress: client can manage own progress"
  on public.lesson_progress for all
  using (exists (select 1 from public.enrollments e where e.id = lesson_progress.enrollment_id and e.client_id = auth.uid()))
  with check (exists (select 1 from public.enrollments e where e.id = lesson_progress.enrollment_id and e.client_id = auth.uid()));

drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute procedure public.set_updated_at();
