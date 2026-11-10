-- CuriousStride 30-Day Reflection Challenge
-- Supabase/Postgres schema, Row Level Security policies and RPC functions.
-- Run this file first, then supabase/seed.sql.

create extension if not exists pgcrypto;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  duration_days integer not null default 30 check (duration_days between 1 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  start_day integer not null check (start_day >= 1),
  end_day integer not null check (end_day >= start_day),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, slug),
  unique (challenge_id, sort_order)
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  stage_id uuid not null references public.stages(id),
  status text not null default 'unpublished' check (status in ('published', 'unpublished')),
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, day_number)
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  title text not null,
  introduction text not null default '',
  question text not null,
  follow_up text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (prompt_id, version_number)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prompts_active_version_id_fkey'
  ) then
    alter table public.prompts
      add constraint prompts_active_version_id_fkey
      foreign key (active_version_id) references public.prompt_versions(id) on delete set null;
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  avatar_url text not null default '',
  registration_date timestamptz not null default now(),
  challenge_start_date date not null default current_date,
  timezone text not null default 'UTC',
  status text not null default 'active' check (status in ('active', 'paused', 'deactivated', 'completed')),
  cloud_sync_enabled boolean not null default false,
  reminder_enabled boolean not null default false,
  reminder_time time not null default '19:00',
  onboarding_version integer not null default 0 check (onboarding_version >= 0),
  onboarding_completed_at timestamptz,
  privacy_acknowledged_at timestamptz,
  reminder_consent_at timestamptz,
  last_active_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists onboarding_version integer not null default 0;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists privacy_acknowledged_at timestamptz;
alter table public.profiles add column if not exists reminder_consent_at timestamptz;

-- Administrator membership is deliberately separate from participant profiles.
-- No public or participant-facing function inserts into this table. Grant/revoke
-- administrator access only from a trusted SQL session or another privileged backend.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  prompt_version_id uuid not null references public.prompt_versions(id),
  day_number integer not null,
  assigned_at timestamptz not null default now(),
  unique (user_id, prompt_id),
  unique (user_id, challenge_id, day_number)
);

create table if not exists public.site_content (
  challenge_id uuid primary key references public.challenges(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  published boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_slug text not null,
  day_number integer not null check (day_number between 1 and 365),
  prompt_id uuid references public.prompts(id) on delete set null,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  prompt_snapshot jsonb not null default '{}'::jsonb,
  response_text text not null default '',
  completed boolean not null default false,
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_slug, day_number)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cloud_reflections_response_length_check') then
    alter table public.cloud_reflections
      add constraint cloud_reflections_response_length_check check (char_length(response_text) <= 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cloud_reflections_snapshot_size_check') then
    alter table public.cloud_reflections
      add constraint cloud_reflections_snapshot_size_check check (octet_length(prompt_snapshot::text) <= 20000);
  end if;
end $$;

create table if not exists public.participant_events (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.participant_day_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id, day_number)
);

create index if not exists prompts_challenge_status_day_idx on public.prompts(challenge_id, status, day_number);
create index if not exists prompt_assignments_user_challenge_idx on public.prompt_assignments(user_id, challenge_id, day_number);
create index if not exists profiles_last_active_idx on public.profiles(last_active_at desc);
create index if not exists participant_events_challenge_created_idx on public.participant_events(challenge_id, created_at desc);
create index if not exists participant_day_status_challenge_idx on public.participant_day_status(challenge_id, user_id, completed);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_challenges_updated_at on public.challenges;
create trigger set_challenges_updated_at before update on public.challenges
for each row execute function public.set_updated_at();

drop trigger if exists set_prompts_updated_at on public.prompts;
create trigger set_prompts_updated_at before update on public.prompts
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_cloud_reflections_updated_at on public.cloud_reflections;
create trigger set_cloud_reflections_updated_at before update on public.cloud_reflections
for each row execute function public.set_updated_at();

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_registrations_open boolean := true;
begin
  if tg_op = 'INSERT' then
    select coalesce((sc.payload->>'registrationsOpen')::boolean, true)
    into v_registrations_open
    from public.site_content sc
    join public.challenges c on c.id = sc.challenge_id
    where c.active = true and sc.published = true
    order by sc.updated_at desc
    limit 1;

    if coalesce(v_registrations_open, true) = false then
      raise exception 'CuriousStride registrations are currently closed';
    end if;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    registration_date,
    challenge_start_date,
    timezone,
    last_active_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'Participant'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    now(),
    current_date,
    'UTC',
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

create or replace function public.ensure_my_profile(
  p_timezone text default 'UTC',
  p_challenge_slug text default 'curiousstride-30-day'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
  v_timezone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_profile_exists boolean := false;
  v_registrations_open boolean := true;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    v_timezone := 'UTC';
  end if;
  select * into v_user from auth.users where id = auth.uid();
  if not found then raise exception 'Authenticated user not found'; end if;

  select exists(select 1 from public.profiles where id = auth.uid()) into v_profile_exists;
  if not v_profile_exists and not public.is_current_user_admin() then
    select coalesce((sc.payload->>'registrationsOpen')::boolean, true)
    into v_registrations_open
    from public.challenges c
    left join public.site_content sc on sc.challenge_id = c.id and sc.published = true
    where c.slug = p_challenge_slug and c.active = true
    limit 1;
    if coalesce(v_registrations_open, true) = false then
      raise exception 'CuriousStride registrations are currently closed';
    end if;
  end if;

  insert into public.profiles (
    id, email, full_name, avatar_url, registration_date, challenge_start_date, timezone, last_active_at
  ) values (
    v_user.id,
    coalesce(v_user.email, ''),
    coalesce(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', split_part(coalesce(v_user.email, 'Participant'), '@', 1)),
    coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture', ''),
    now(),
    (now() at time zone v_timezone)::date,
    v_timezone,
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    timezone = case when public.profiles.timezone = 'UTC' then excluded.timezone else public.profiles.timezone end,
    last_active_at = now(),
    updated_at = now()
  returning * into v_profile;

  return to_jsonb(v_profile);
end;
$$;

create or replace function public.save_my_profile_settings(
  p_timezone text,
  p_cloud_sync_enabled boolean,
  p_reminder_enabled boolean,
  p_reminder_time time,
  p_challenge_slug text default 'curiousstride-30-day'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid timezone. Use an IANA timezone such as Asia/Dubai.';
  end if;
  if exists (
    select 1 from public.profiles
    where id = auth.uid()
      and onboarding_completed_at is not null
      and timezone <> p_timezone
  ) then
    raise exception 'The challenge timezone is fixed after Day 1 begins';
  end if;
  update public.profiles set
    timezone = case
      when onboarding_completed_at is null then p_timezone
      when timezone = p_timezone then timezone
      else timezone
    end,
    cloud_sync_enabled = coalesce(p_cloud_sync_enabled, false),
    reminder_enabled = coalesce(p_reminder_enabled, false),
    reminder_time = coalesce(p_reminder_time, '19:00'::time),
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;
  if not found then raise exception 'Profile not found'; end if;
  return to_jsonb(v_profile);
end;
$$;

create or replace function public.complete_my_onboarding(
  p_timezone text,
  p_reminder_enabled boolean default false,
  p_reminder_time time default '19:00',
  p_onboarding_version integer default 1,
  p_challenge_slug text default 'curiousstride-30-day'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
  v_timezone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_local_date date;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.challenges where slug = p_challenge_slug and active = true) then
    raise exception 'Challenge not found';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Invalid timezone. Use an IANA timezone such as Asia/Dubai.';
  end if;
  if coalesce(p_onboarding_version, 0) < 1 then
    raise exception 'Invalid onboarding version';
  end if;
  v_local_date := (now() at time zone v_timezone)::date;

  update public.profiles set
    timezone = case when onboarding_completed_at is null then v_timezone else timezone end,
    challenge_start_date = case when onboarding_completed_at is null then v_local_date else challenge_start_date end,
    reminder_enabled = coalesce(p_reminder_enabled, false),
    reminder_time = coalesce(p_reminder_time, '19:00'::time),
    onboarding_version = greatest(onboarding_version, p_onboarding_version),
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    privacy_acknowledged_at = coalesce(privacy_acknowledged_at, now()),
    reminder_consent_at = case
      when coalesce(p_reminder_enabled, false) then coalesce(reminder_consent_at, now())
      else reminder_consent_at
    end,
    last_active_at = now(),
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;

  if not found then raise exception 'Profile not found'; end if;
  return to_jsonb(v_profile);
end;
$$;

create or replace function public.get_public_site_content(
  p_challenge_slug text default 'curiousstride-30-day'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sc.payload, '{}'::jsonb)
  from public.challenges c
  left join public.site_content sc on sc.challenge_id = c.id and sc.published = true
  where c.slug = p_challenge_slug and c.active = true
  limit 1;
$$;

create or replace function public.get_my_journey(
  p_challenge_slug text default 'curiousstride-30-day'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_challenge public.challenges%rowtype;
  v_profile public.profiles%rowtype;
  v_local_date date;
  v_current_day integer;
  v_prompts jsonb;
  v_registrations_open boolean := true;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_challenge
  from public.challenges
  where slug = p_challenge_slug and active = true;
  if not found then raise exception 'Challenge not found'; end if;

  perform public.ensure_my_profile('UTC', p_challenge_slug);
  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.status = 'deactivated' then
    raise exception 'This CuriousStride account has been deactivated';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_profile.timezone) then
    v_profile.timezone := 'UTC';
  end if;
  v_local_date := (now() at time zone v_profile.timezone)::date;
  if v_profile.onboarding_completed_at is null then
    v_current_day := 0;
  else
    v_current_day := greatest(0, least(v_challenge.duration_days, (v_local_date - v_profile.challenge_start_date) + 1));
  end if;

  if v_profile.status in ('active', 'completed') then
    insert into public.prompt_assignments (
      user_id, challenge_id, prompt_id, prompt_version_id, day_number
    )
    select auth.uid(), v_challenge.id, p.id, p.active_version_id, p.day_number
    from public.prompts p
    where p.challenge_id = v_challenge.id
      and p.status = 'published'
      and p.active_version_id is not null
      and p.day_number <= v_current_day
    on conflict (user_id, prompt_id) do nothing;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'day_number', a.day_number,
        'stage_slug', s.slug,
        'stage_name', s.name,
        'status', p.status,
        'prompt_version_id', pv.id,
        'version_number', pv.version_number,
        'title', pv.title,
        'introduction', pv.introduction,
        'question', pv.question,
        'follow_up', pv.follow_up,
        'assigned_at', a.assigned_at
      ) order by a.day_number
    ),
    '[]'::jsonb
  ) into v_prompts
  from public.prompt_assignments a
  join public.prompts p on p.id = a.prompt_id
  join public.prompt_versions pv on pv.id = a.prompt_version_id
  join public.stages s on s.id = p.stage_id
  where a.user_id = auth.uid()
    and a.challenge_id = v_challenge.id
    and a.day_number <= v_current_day;

  select coalesce((sc.payload->>'registrationsOpen')::boolean, true)
  into v_registrations_open
  from public.site_content sc
  where sc.challenge_id = v_challenge.id and sc.published = true;
  v_registrations_open := coalesce(v_registrations_open, true);

  update public.profiles set last_active_at = now() where id = auth.uid();

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'current_day', v_current_day,
    'challenge', jsonb_build_object(
      'id', v_challenge.id,
      'slug', v_challenge.slug,
      'title', v_challenge.title,
      'durationDays', v_challenge.duration_days
    ),
    'available_prompts', v_prompts,
    'registrations_open', v_registrations_open
  );
end;
$$;

create or replace function public.touch_activity(
  p_challenge_slug text default 'curiousstride-30-day'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

create or replace function public.record_participant_event(
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb,
  p_challenge_slug text default 'curiousstride-30-day'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge_id uuid;
  v_duration integer;
  v_safe_metadata jsonb := '{}'::jsonb;
  v_day integer;
  v_completed boolean;
  v_profile public.profiles%rowtype;
  v_current_day integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_event_type not in ('reflection_saved', 'pdf_exported', 'backup_exported', 'closing_reflections_saved') then
    raise exception 'Unsupported event type';
  end if;

  select id, duration_days into v_challenge_id, v_duration
  from public.challenges where slug = p_challenge_slug and active = true;
  if v_challenge_id is null then raise exception 'Challenge not found'; end if;

  if p_event_type = 'reflection_saved' then
    v_day := nullif(p_metadata->>'dayNumber', '')::integer;
    v_completed := coalesce((p_metadata->>'completed')::boolean, false);
    select * into v_profile from public.profiles where id = auth.uid();
    if not found then raise exception 'Profile not found'; end if;
    if v_profile.onboarding_completed_at is null then raise exception 'Complete onboarding before recording progress'; end if;
    if v_profile.status not in ('active', 'completed') then raise exception 'This account cannot record challenge progress'; end if;
    v_current_day := greatest(0, least(v_duration,
      (((now() at time zone case
        when exists (select 1 from pg_timezone_names z where z.name = v_profile.timezone)
          then v_profile.timezone else 'UTC' end)::date - v_profile.challenge_start_date) + 1)
    ));
    if v_day is null or v_day < 1 or v_day > v_current_day then
      raise exception 'That challenge day is not available';
    end if;
    if not exists (
      select 1 from public.prompt_assignments a
      where a.user_id = auth.uid()
        and a.challenge_id = v_challenge_id
        and a.day_number = v_day
    ) then
      raise exception 'That prompt has not been assigned to this participant';
    end if;
    v_safe_metadata := jsonb_build_object('dayNumber', v_day, 'completed', v_completed);
    insert into public.participant_day_status (user_id, challenge_id, day_number, completed, updated_at)
    values (auth.uid(), v_challenge_id, v_day, v_completed, now())
    on conflict (user_id, challenge_id, day_number) do update set
      completed = excluded.completed,
      updated_at = now();
  elsif p_event_type in ('pdf_exported', 'backup_exported') then
    v_safe_metadata := jsonb_build_object('pageCount', nullif(p_metadata->>'pageCount', '')::integer);
  else
    v_safe_metadata := '{}'::jsonb;
  end if;

  insert into public.participant_events (user_id, challenge_id, event_type, metadata)
  values (auth.uid(), v_challenge_id, left(p_event_type, 80), v_safe_metadata);
  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

create or replace function public.admin_dashboard(
  p_challenge_slug text default 'curiousstride-30-day'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge_id uuid;
  v_registered integer;
  v_active integer;
  v_completed integer;
  v_published integer;
  v_recent jsonb;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  select id into v_challenge_id from public.challenges where slug = p_challenge_slug;
  if v_challenge_id is null then raise exception 'Challenge not found'; end if;

  select count(*) into v_registered from public.profiles p
  where not exists (select 1 from public.admin_users au where au.user_id = p.id);
  select count(*) into v_active from public.profiles p
  where p.last_active_at >= now() - interval '7 days' and p.status <> 'deactivated'
    and not exists (select 1 from public.admin_users au where au.user_id = p.id);
  select count(*) into v_completed
  from public.profiles p
  where not exists (select 1 from public.admin_users au where au.user_id = p.id)
    and (p.status = 'completed'
     or (select count(*) from public.participant_day_status d where d.user_id = p.id and d.challenge_id = v_challenge_id and d.completed) >= 30);
  select count(*) into v_published from public.prompts where challenge_id = v_challenge_id and status = 'published' and active_version_id is not null;

  select coalesce(jsonb_agg(item order by registration_date desc), '[]'::jsonb)
  into v_recent
  from (
    select jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'registration_date', p.registration_date,
      'challenge_start_date', p.challenge_start_date,
      'timezone', p.timezone,
      'status', p.status,
      'last_active_at', p.last_active_at
    ) as item, p.registration_date
    from public.profiles p
    where not exists (select 1 from public.admin_users au where au.user_id = p.id)
    order by p.registration_date desc
    limit 5
  ) recent;

  return jsonb_build_object(
    'registered_participants', v_registered,
    'active_participants', v_active,
    'completed_challenges', v_completed,
    'published_prompts', v_published,
    'completion_rate', case when v_registered = 0 then 0 else round((v_completed::numeric / v_registered) * 100) end,
    'recent_participants', v_recent
  );
end;
$$;

create or replace function public.admin_list_prompts(
  p_challenge_slug text default 'curiousstride-30-day'
)
returns table (
  id uuid,
  day_number integer,
  stage_slug text,
  stage_name text,
  status text,
  version_number integer,
  version_id uuid,
  title text,
  introduction text,
  question text,
  follow_up text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  return query
  select p.id, p.day_number, s.slug, s.name, p.status, pv.version_number, pv.id,
         pv.title, pv.introduction, pv.question, pv.follow_up, p.updated_at
  from public.prompts p
  join public.challenges c on c.id = p.challenge_id
  join public.stages s on s.id = p.stage_id
  left join public.prompt_versions pv on pv.id = p.active_version_id
  where c.slug = p_challenge_slug
  order by p.day_number;
end;
$$;

create or replace function public.admin_prompt_versions(p_prompt_id uuid)
returns table (
  id uuid,
  version_number integer,
  title text,
  introduction text,
  question text,
  follow_up text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  return query
  select pv.id, pv.version_number, pv.title, pv.introduction, pv.question, pv.follow_up, pv.created_by, pv.created_at
  from public.prompt_versions pv
  where pv.prompt_id = p_prompt_id
  order by pv.version_number desc;
end;
$$;

create or replace function public.admin_save_prompt(
  p_prompt_id uuid,
  p_challenge_slug text,
  p_day_number integer,
  p_stage_slug text,
  p_title text,
  p_introduction text,
  p_question text,
  p_follow_up text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge_id uuid;
  v_stage_id uuid;
  v_prompt public.prompts%rowtype;
  v_version public.prompt_versions%rowtype;
  v_next_version integer;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  if p_day_number not between 1 and 30 then raise exception 'Day number must be between 1 and 30'; end if;
  if p_status not in ('published', 'unpublished') then raise exception 'Invalid prompt status'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 or length(trim(coalesce(p_question, ''))) = 0 then
    raise exception 'Title and question are required';
  end if;

  select id into v_challenge_id from public.challenges where slug = p_challenge_slug;
  if v_challenge_id is null then raise exception 'Challenge not found'; end if;
  select id into v_stage_id from public.stages where challenge_id = v_challenge_id and slug = p_stage_slug;
  if v_stage_id is null then raise exception 'Stage not found'; end if;

  if p_prompt_id is null then
    select * into v_prompt from public.prompts where challenge_id = v_challenge_id and day_number = p_day_number;
    if not found then
      insert into public.prompts (challenge_id, day_number, stage_id, status)
      values (v_challenge_id, p_day_number, v_stage_id, p_status)
      returning * into v_prompt;
    end if;
  else
    select * into v_prompt from public.prompts where id = p_prompt_id and challenge_id = v_challenge_id;
    if not found then raise exception 'Prompt not found'; end if;
  end if;

  if exists (select 1 from public.prompt_assignments a where a.prompt_id = v_prompt.id)
     and (v_prompt.day_number <> p_day_number or v_prompt.stage_id <> v_stage_id) then
    raise exception 'A prompt schedule cannot change after the prompt has been assigned. Create the schedule before launch.';
  end if;

  update public.prompts set
    day_number = p_day_number,
    stage_id = v_stage_id,
    status = p_status,
    updated_at = now()
  where id = v_prompt.id
  returning * into v_prompt;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.prompt_versions where prompt_id = v_prompt.id;

  insert into public.prompt_versions (
    prompt_id, version_number, title, introduction, question, follow_up, created_by
  ) values (
    v_prompt.id,
    v_next_version,
    trim(p_title),
    trim(coalesce(p_introduction, '')),
    trim(p_question),
    nullif(trim(coalesce(p_follow_up, '')), ''),
    auth.uid()
  ) returning * into v_version;

  update public.prompts set active_version_id = v_version.id, updated_at = now() where id = v_prompt.id;

  return jsonb_build_object(
    'id', v_prompt.id,
    'day_number', p_day_number,
    'stage_slug', p_stage_slug,
    'stage_name', (select name from public.stages where id = v_stage_id),
    'status', p_status,
    'version_number', v_version.version_number,
    'version_id', v_version.id,
    'title', v_version.title,
    'introduction', v_version.introduction,
    'question', v_version.question,
    'follow_up', v_version.follow_up,
    'updated_at', now()
  );
end;
$$;

create or replace function public.admin_set_prompt_status(p_prompt_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_prompt public.prompts%rowtype;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('published', 'unpublished') then raise exception 'Invalid prompt status'; end if;
  update public.prompts set status = p_status, updated_at = now()
  where id = p_prompt_id
  returning * into v_prompt;
  if not found then raise exception 'Prompt not found'; end if;
  return jsonb_build_object('id', v_prompt.id, 'day_number', v_prompt.day_number, 'status', v_prompt.status);
end;
$$;

create or replace function public.admin_participants(
  p_challenge_slug text default 'curiousstride-30-day'
)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  registration_date timestamptz,
  challenge_start_date date,
  timezone text,
  status text,
  last_active_at timestamptz,
  current_day integer,
  completed_count integer
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_challenge public.challenges%rowtype;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  select * into v_challenge from public.challenges where slug = p_challenge_slug;
  if not found then raise exception 'Challenge not found'; end if;

  return query
  select p.id, p.email, p.full_name, p.avatar_url, p.registration_date, p.challenge_start_date,
         p.timezone, p.status, p.last_active_at,
         case when p.onboarding_completed_at is null then 0 else
           greatest(0, least(v_challenge.duration_days,
             (((now() at time zone case when exists (select 1 from pg_timezone_names z where z.name = p.timezone) then p.timezone else 'UTC' end)::date - p.challenge_start_date) + 1)
           ))::integer
         end as current_day,
         coalesce((select count(*)::integer from public.participant_day_status d where d.user_id = p.id and d.challenge_id = v_challenge.id and d.completed), 0) as completed_count
  from public.profiles p
  where not exists (select 1 from public.admin_users au where au.user_id = p.id)
  order by p.registration_date desc;
end;
$$;

create or replace function public.admin_update_participant_status(p_user_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('active', 'paused', 'deactivated', 'completed') then raise exception 'Invalid status'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user_id) then
    raise exception 'Administrator accounts are managed separately';
  end if;
  update public.profiles set status = p_status, updated_at = now() where id = p_user_id returning * into v_profile;
  if not found then raise exception 'Participant not found'; end if;
  return to_jsonb(v_profile);
end;
$$;

create or replace function public.admin_save_site_content(
  p_challenge_slug text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge_id uuid;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  select id into v_challenge_id from public.challenges where slug = p_challenge_slug;
  if v_challenge_id is null then raise exception 'Challenge not found'; end if;
  insert into public.site_content (challenge_id, payload, published, updated_by, updated_at)
  values (v_challenge_id, coalesce(p_payload, '{}'::jsonb), true, auth.uid(), now())
  on conflict (challenge_id) do update set
    payload = excluded.payload,
    published = true,
    updated_by = auth.uid(),
    updated_at = now();
  return p_payload;
end;
$$;

create or replace function public.admin_analytics(
  p_challenge_slug text default 'curiousstride-30-day'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_challenge_id uuid;
  v_registrations jsonb;
  v_stage_completion jsonb;
  v_total_events integer;
  v_average_completed numeric;
  v_return_rate numeric;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required'; end if;
  select id into v_challenge_id from public.challenges where slug = p_challenge_slug;
  if v_challenge_id is null then raise exception 'Challenge not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', value) order by week_start), '[]'::jsonb)
  into v_registrations
  from (
    select week_start,
           to_char(week_start, 'Mon DD') as label,
           count(p.id)::integer as value
    from generate_series(date_trunc('week', now()) - interval '6 weeks', date_trunc('week', now()), interval '1 week') week_start
    left join public.profiles p on p.registration_date >= week_start and p.registration_date < week_start + interval '1 week'
      and not exists (select 1 from public.admin_users au where au.user_id = p.id)
    group by week_start
  ) weekly;

  select coalesce(jsonb_agg(jsonb_build_object('label', s.name, 'value', coalesce(reached.value, 0)) order by s.sort_order), '[]'::jsonb)
  into v_stage_completion
  from public.stages s
  left join lateral (
    select count(*)::integer as value
    from public.profiles p
    where not exists (select 1 from public.admin_users au where au.user_id = p.id)
      and (select count(*) from public.participant_day_status d where d.user_id = p.id and d.challenge_id = v_challenge_id and d.completed) >= s.end_day
  ) reached on true
  where s.challenge_id = v_challenge_id;

  select count(*)::integer into v_total_events
  from public.participant_events e
  where e.challenge_id = v_challenge_id
    and not exists (select 1 from public.admin_users au where au.user_id = e.user_id);

  select coalesce(avg(completed_count), 0)
  into v_average_completed
  from (
    select p.id, count(d.day_number) filter (where d.completed)::integer as completed_count
    from public.profiles p
    left join public.participant_day_status d on d.user_id = p.id and d.challenge_id = v_challenge_id
    where not exists (select 1 from public.admin_users au where au.user_id = p.id)
    group by p.id
  ) counts;

  select case when count(*) = 0 then 0 else
    round((count(*) filter (where active_days >= 2)::numeric / count(*)) * 100)
  end
  into v_return_rate
  from (
    select p.id, count(distinct e.created_at::date) as active_days
    from public.profiles p
    left join public.participant_events e on e.user_id = p.id and e.challenge_id = v_challenge_id
    where not exists (select 1 from public.admin_users au where au.user_id = p.id)
    group by p.id
  ) activity;

  return jsonb_build_object(
    'registrations', v_registrations,
    'stage_completion', v_stage_completion,
    'total_events', v_total_events,
    'average_completed', round(v_average_completed),
    'return_rate', v_return_rate
  );
end;
$$;

-- Row Level Security
alter table public.challenges enable row level security;
alter table public.stages enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.prompt_assignments enable row level security;
alter table public.site_content enable row level security;
alter table public.cloud_reflections enable row level security;
alter table public.participant_events enable row level security;
alter table public.participant_day_status enable row level security;

-- Public challenge/stage metadata is safe. Prompt text is intentionally not public.
drop policy if exists challenges_public_read on public.challenges;
create policy challenges_public_read on public.challenges for select using (active = true);

drop policy if exists stages_public_read on public.stages;
create policy stages_public_read on public.stages for select using (
  exists (select 1 from public.challenges c where c.id = stages.challenge_id and c.active = true)
);

-- Profiles are owner-readable. Mutations use validated security-definer RPCs so
-- participants cannot change their start date, status or other protected fields.
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists profiles_owner_update on public.profiles;

-- Cloud journal rows are visible and writable only to their owner.
drop policy if exists cloud_reflections_owner_select on public.cloud_reflections;
create policy cloud_reflections_owner_select on public.cloud_reflections for select to authenticated using (user_id = auth.uid());

drop policy if exists cloud_reflections_owner_insert on public.cloud_reflections;
create policy cloud_reflections_owner_insert on public.cloud_reflections for insert to authenticated with check (user_id = auth.uid());

drop policy if exists cloud_reflections_owner_update on public.cloud_reflections;
create policy cloud_reflections_owner_update on public.cloud_reflections for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists cloud_reflections_owner_delete on public.cloud_reflections;
create policy cloud_reflections_owner_delete on public.cloud_reflections for delete to authenticated using (user_id = auth.uid());

-- Sensitive tables have no direct participant policies; security-definer RPCs perform checks.
-- Explicit grants are limited to the API functions and owner-safe tables.
revoke all on public.prompts, public.prompt_versions, public.admin_users, public.prompt_assignments,
  public.participant_events, public.participant_day_status, public.site_content from anon, authenticated;

revoke all on public.challenges, public.stages, public.profiles, public.cloud_reflections from anon, authenticated;

grant select on public.challenges, public.stages to anon, authenticated;
grant select, insert, update, delete on public.cloud_reflections to authenticated;
grant select on public.profiles to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.get_public_site_content(text) from public, anon, authenticated;
revoke execute on function public.ensure_my_profile(text, text) from public, anon, authenticated;
revoke execute on function public.save_my_profile_settings(text, boolean, boolean, time, text) from public, anon, authenticated;
revoke execute on function public.complete_my_onboarding(text, boolean, time, integer, text) from public, anon, authenticated;
revoke execute on function public.get_my_journey(text) from public, anon, authenticated;
revoke execute on function public.touch_activity(text) from public, anon, authenticated;
revoke execute on function public.record_participant_event(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.is_current_user_admin() from public, anon, authenticated;
revoke execute on function public.admin_dashboard(text) from public, anon, authenticated;
revoke execute on function public.admin_list_prompts(text) from public, anon, authenticated;
revoke execute on function public.admin_prompt_versions(uuid) from public, anon, authenticated;
revoke execute on function public.admin_save_prompt(uuid, text, integer, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_set_prompt_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_participants(text) from public, anon, authenticated;
revoke execute on function public.admin_update_participant_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_save_site_content(text, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_analytics(text) from public, anon, authenticated;

grant execute on function public.get_public_site_content(text) to anon, authenticated;
grant execute on function public.ensure_my_profile(text, text) to authenticated;
grant execute on function public.save_my_profile_settings(text, boolean, boolean, time, text) to authenticated;
grant execute on function public.complete_my_onboarding(text, boolean, time, integer, text) to authenticated;
grant execute on function public.get_my_journey(text) to authenticated;
grant execute on function public.touch_activity(text) to authenticated;
grant execute on function public.record_participant_event(text, jsonb, text) to authenticated;
grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.admin_dashboard(text) to authenticated;
grant execute on function public.admin_list_prompts(text) to authenticated;
grant execute on function public.admin_prompt_versions(uuid) to authenticated;
grant execute on function public.admin_save_prompt(uuid, text, integer, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_prompt_status(uuid, text) to authenticated;
grant execute on function public.admin_participants(text) to authenticated;
grant execute on function public.admin_update_participant_status(uuid, text) to authenticated;
grant execute on function public.admin_save_site_content(text, jsonb) to authenticated;
grant execute on function public.admin_analytics(text) to authenticated;

-- Optional reminder delivery ledger used by the send-reminders Edge Function.
create table if not exists public.reminder_deliveries (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  local_date date not null,
  sent_at timestamptz not null default now(),
  provider_id text,
  unique (user_id, challenge_id, local_date)
);
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;
