-- Design Cadence database schema.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates what is missing.

create extension if not exists pgcrypto;

-- People --------------------------------------------------------------------
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('member', 'lead', 'admin')),
  blob_color text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- For databases created before "admin" and "blob_color" existed (safe to run again).
alter table people drop constraint if exists people_role_check;
alter table people add constraint people_role_check check (role in ('member', 'lead', 'admin'));
alter table people add column if not exists blob_color text;
-- Sign-in: the work email a code is sent to, and the account it links to (see supabase/lock-down.sql).
alter table people add column if not exists email text;
alter table people add column if not exists auth_user_id uuid unique;
create unique index if not exists people_email_key on people (lower(email));

-- Projects ------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  logo_url text,
  color text not null default 'neutral',
  parent_id uuid references projects(id) on delete set null,
  sort_order int not null default 0,
  archived boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
-- For databases created before "pinned" existed (safe to run again).
alter table projects add column if not exists pinned boolean not null default false;

-- Sprints (created automatically by the app, never by hand) -----------------
create table if not exists sprints (
  id uuid primary key,
  number int not null unique,
  start_date date not null,
  end_date date not null,
  meeting_date date not null,
  created_at timestamptz not null default now()
);

-- Tasks: a shared workstream inside a project --------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- Updates: one person's note on a task in a sprint ---------------------------
create table if not exists updates (
  id uuid primary key default gen_random_uuid(),
  sprint_number int not null,
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  type text not null check (type in ('done', 'planned', 'blocker')),
  text text not null default '',
  size text check (size in ('S', 'M', 'L')),
  due_date date,
  status text check (status in ('not_started', 'in_progress', 'done', 'carried_over', 'dropped')),
  help_from_person_id uuid references people(id) on delete set null,
  help_from_text text,
  resolved boolean not null default false,
  resolved_at timestamptz,
  carried_from_id uuid references updates(id) on delete set null,
  carry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
-- For databases created before cards could carry pictures (safe to run again).
alter table updates add column if not exists images text[] not null default '{}';
create index if not exists updates_sprint_idx on updates (sprint_number);
create index if not exists updates_person_idx on updates (person_id);

-- Important dates -----------------------------------------------------------
create table if not exists important_dates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date, -- null = a note for one week only (see sprint_number)
  sprint_number int,
  project_id uuid references projects(id) on delete set null,
  note text,
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- For databases created before undated notes existed (safe to run again).
alter table important_dates alter column date drop not null;
alter table important_dates add column if not exists sprint_number int;

-- Action items --------------------------------------------------------------
create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  owner_id uuid references people(id) on delete set null, -- legacy: replaced by owner_ids
  owner_ids uuid[] not null default '{}',
  due_date date,
  sprint_number int not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- For databases created before action items could have several owners (safe to run again).
alter table action_items add column if not exists owner_ids uuid[] not null default '{}';
update action_items set owner_ids = array[owner_id] where owner_id is not null and owner_ids = '{}';

-- Emoji reactions on updates and dates --------------------------------------
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('update', 'date')),
  target_id uuid not null,
  emoji text not null,
  person_id uuid not null references people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (target_id, emoji, person_id)
);

-- Team-wide settings (key/value) --------------------------------------------
create table if not exists settings (
  id text primary key,
  value jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Sign-in helpers -------------------------------------------------------------
-- Safe to run with or without sign-in switched on. They only matter once
-- supabase/lock-down.sql has been run.
create or replace function public.current_person() returns uuid
language sql stable security definer set search_path = public as $$
  select id from people where auth_user_id = auth.uid() and active limit 1
$$;

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from people where auth_user_id = auth.uid() and active limit 1
$$;

-- The sign-in screen lists names before anyone is signed in. This returns only
-- names, roles and colours of active people who have an email. Never emails.
create or replace function public.login_people() returns table (id uuid, name text, role text, blob_color text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.role, p.blob_color from people p
  where p.active and p.email is not null order by p.sort_order, p.name
$$;

revoke all on function public.current_person(), public.current_role_name(), public.login_people() from public;
grant execute on function public.current_person(), public.current_role_name(), public.login_people() to anon, authenticated;

-- Access --------------------------------------------------------------------
-- Until sign-in is switched on, anyone with the app link can read and edit:
-- Row Level Security has an "allow everyone" policy so the public (anon) key
-- works. supabase/lock-down.sql replaces it with "signed-in team members only".
do $$
declare t text;
begin
  foreach t in array array['people','projects','sprints','tasks','updates','important_dates','action_items','reactions','settings'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'open access') then
      execute format('create policy "open access" on %I for all using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Realtime: broadcast every change so edits appear live during the meeting.
do $$
declare t text;
begin
  foreach t in array array['people','projects','sprints','tasks','updates','important_dates','action_items','reactions','settings'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
