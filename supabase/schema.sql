-- =====================================================================
-- Blueprint — Supabase schema
-- Run this whole file in the Supabase dashboard → SQL Editor.
-- It is idempotent: use it both for a fresh project and to upgrade an
-- existing one (re-running it keeps all existing data).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per registered user (id matches auth.users.id).
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null check (char_length(display_name) between 1 and 80),
  email               text not null default '',
  discipline          text not null default '' check (char_length(discipline) <= 60),
  bio                 text not null default '' check (char_length(bio) <= 1000),
  profile_picture_url text not null default '' check (char_length(profile_picture_url) <= 2048),
  github_url          text not null default '' check (github_url = '' or (github_url ~* '^https?://' and char_length(github_url) <= 500)),
  linkedin_url        text not null default '' check (linkedin_url = '' or (linkedin_url ~* '^https?://' and char_length(linkedin_url) <= 500)),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 5000),
  image_url    text not null default '' check (char_length(image_url) <= 2048),
  project_link text not null default '' check (project_link = '' or (project_link ~* '^https?://' and char_length(project_link) <= 500)),
  github_link  text not null default '' check (github_link  = '' or (github_link  ~* '^https?://' and char_length(github_link)  <= 500)),
  cad_link     text not null default '' check (cad_link     = '' or (cad_link     ~* '^https?://' and char_length(cad_link)     <= 500)),
  report_link  text not null default '' check (report_link  = '' or (report_link  ~* '^https?://' and char_length(report_link)  <= 500)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists projects_created_at_idx on public.projects (created_at desc);
create index if not exists projects_user_id_created_at_idx on public.projects (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Columns added after the first release (added here so upgrades work)
-- ---------------------------------------------------------------------

-- YouTube channel on profiles, YouTube video/demo on projects.
alter table public.profiles add column if not exists youtube_url text not null default '';
alter table public.profiles drop constraint if exists profiles_youtube_url_check;
alter table public.profiles add constraint profiles_youtube_url_check
  check (youtube_url = '' or (youtube_url ~* '^https?://' and char_length(youtube_url) <= 500));

alter table public.projects add column if not exists youtube_link text not null default '';
alter table public.projects drop constraint if exists projects_youtube_link_check;
alter table public.projects add constraint projects_youtube_link_check
  check (youtube_link = '' or (youtube_link ~* '^https?://' and char_length(youtube_link) <= 500));

-- College / university shown under the student's name.
alter table public.profiles add column if not exists school text not null default '';
alter table public.profiles drop constraint if exists profiles_school_check;
alter table public.profiles add constraint profiles_school_check check (char_length(school) <= 120);

-- Resume (PDF) on profiles: public URL of resumes/{uid}.
alter table public.profiles add column if not exists resume_url text not null default '';
alter table public.profiles drop constraint if exists profiles_resume_url_check;
alter table public.profiles add constraint profiles_resume_url_check
  check (resume_url = '' or (resume_url ~* '^https?://' and char_length(resume_url) <= 2048));

-- Topic tags (e.g. {Embedded Systems, Robotics, IoT}): up to 8, each 1–40 chars.
create or replace function public.valid_tags(tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(tags) <= 8
    and coalesce((select bool_and(char_length(t) between 1 and 40) from unnest(tags) as t), true);
$$;

alter table public.projects add column if not exists tags text[] not null default '{}';
alter table public.projects drop constraint if exists projects_tags_check;
alter table public.projects add constraint projects_tags_check check (public.valid_tags(tags));
create index if not exists projects_tags_idx on public.projects using gin (tags);

-- Upgrade: projects used to have a single "discipline" category. Move it
-- into tags, then drop the old column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'discipline'
  ) then
    update public.projects
      set tags = array[left(trim(discipline), 40)]
      where trim(discipline) <> '' and cardinality(tags) = 0;
    alter table public.projects drop column discipline;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Create a profile automatically when someone signs up. Works even when
-- email confirmation is on (the client has no session yet at that point).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, discipline)
  values (
    new.id,
    coalesce(new.email, ''),
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Student'
      ),
      80
    ),
    left(coalesce(new.raw_user_meta_data ->> 'discipline', ''), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-controlled columns: clients can't forge timestamps, change a
-- profile's email, or move a project to another user.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.protect_project_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_protect_columns on public.projects;
create trigger projects_protect_columns
  before insert or update on public.projects
  for each row execute function public.protect_project_columns();

-- ---------------------------------------------------------------------
-- Row Level Security: public read, owner-only write
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

grant select on public.profiles, public.projects to anon, authenticated;
grant insert, update, delete on public.profiles, public.projects to authenticated;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select to anon, authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Projects are viewable by everyone" on public.projects;
create policy "Projects are viewable by everyone"
  on public.projects for select to anon, authenticated
  using (true);

drop policy if exists "Users can create their own projects" on public.projects;
create policy "Users can create their own projects"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own projects" on public.projects;
create policy "Users can update their own projects"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own projects" on public.projects;
create policy "Users can delete their own projects"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Storage buckets
--   profile_pictures/{uid}        user headshots
--   project_images/{projectId}    hardware photos, CAD renders, screenshots
--   resumes/{uid}                 resume PDFs
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile_pictures', 'profile_pictures', true, 5242880, array['image/*']),
  ('project_images',   'project_images',   true, 5242880, array['image/*']),
  ('resumes',          'resumes',          true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Profile pictures: the object name must be the uploader's user id.
drop policy if exists "Profile pictures are publicly readable" on storage.objects;
create policy "Profile pictures are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'profile_pictures');

drop policy if exists "Users can upload their own profile picture" on storage.objects;
create policy "Users can upload their own profile picture"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile_pictures' and name = (select auth.uid())::text);

drop policy if exists "Users can replace their own profile picture" on storage.objects;
create policy "Users can replace their own profile picture"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile_pictures' and name = (select auth.uid())::text)
  with check (bucket_id = 'profile_pictures' and name = (select auth.uid())::text);

drop policy if exists "Users can delete their own profile picture" on storage.objects;
create policy "Users can delete their own profile picture"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile_pictures' and name = (select auth.uid())::text);

-- Resumes: the object name must be the uploader's user id.
drop policy if exists "Resumes are publicly readable" on storage.objects;
create policy "Resumes are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'resumes');

drop policy if exists "Users can upload their own resume" on storage.objects;
create policy "Users can upload their own resume"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and name = (select auth.uid())::text);

drop policy if exists "Users can replace their own resume" on storage.objects;
create policy "Users can replace their own resume"
  on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and name = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and name = (select auth.uid())::text);

drop policy if exists "Users can delete their own resume" on storage.objects;
create policy "Users can delete their own resume"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and name = (select auth.uid())::text);

-- Project images: the object name must be a project id the uploader owns.
-- The app always inserts the project row before uploading its image.
drop policy if exists "Project images are publicly readable" on storage.objects;
create policy "Project images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'project_images');

drop policy if exists "Users can upload images for their own projects" on storage.objects;
create policy "Users can upload images for their own projects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project_images'
    and exists (
      select 1 from public.projects p
      where p.id::text = objects.name and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can replace images for their own projects" on storage.objects;
create policy "Users can replace images for their own projects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project_images'
    and exists (
      select 1 from public.projects p
      where p.id::text = objects.name and p.user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'project_images'
    and exists (
      select 1 from public.projects p
      where p.id::text = objects.name and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete images for their own projects" on storage.objects;
create policy "Users can delete images for their own projects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project_images'
    and exists (
      select 1 from public.projects p
      where p.id::text = objects.name and p.user_id = (select auth.uid())
    )
  );

-- Make the API pick up column changes immediately.
notify pgrst, 'reload schema';
