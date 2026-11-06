-- Run in Supabase SQL Editor. Enable Anonymous Sign-ins in Authentication > Providers.
create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  status text not null default 'todo' check (status in ('todo','in_progress','in_review','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_date date,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);

-- Also upgrades projects initialized before task categories were added.
alter table public.tasks add column if not exists category text not null default 'general'
  check (category in ('general','feature','bug','design','research'));

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint comments_task_owner_fk foreign key (task_id,user_id)
    references public.tasks(id,user_id) on delete cascade
);

create index if not exists tasks_user_status_position_idx on public.tasks(user_id,status,position);
create index if not exists comments_task_created_idx on public.comments(task_id,created_at);

-- Standard PostgreSQL trigger function. Run in Supabase SQL Editor (New query).
CREATE OR REPLACE FUNCTION public.touch_task_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.touch_task_updated_at();

alter table public.tasks enable row level security;
alter table public.comments enable row level security;

-- Policies are idempotent for repeated setup.
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_select_own" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_update_own" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks_delete_own" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "comments_select_own" on public.comments;
drop policy if exists "comments_insert_own" on public.comments;
drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_select_own" on public.comments for select to authenticated using ((select auth.uid()) = user_id);
create policy "comments_insert_own" on public.comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "comments_delete_own" on public.comments for delete to authenticated using ((select auth.uid()) = user_id);

-- Never put a service_role key in a browser environment variable.

-- Apply the decision and its feedback in a single transaction.
create or replace function public.review_task(task_id uuid, feedback text)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  reviewed public.tasks;
  next_status text := case when feedback is null then 'done' else 'in_progress' end;
begin
  update public.tasks
  set status = next_status, position = extract(epoch from now()) * 1000
  where id = task_id and user_id = auth.uid() and status = 'in_review'
  returning * into reviewed;

  if not found then
    raise exception 'This task is no longer available for review.';
  end if;

  if feedback is not null then
    insert into public.comments (task_id, user_id, body)
    values (reviewed.id, reviewed.user_id, btrim(feedback));
  end if;

  return reviewed;
end;
$function$;

revoke execute on function public.review_task(uuid, text) from public, anon;
grant execute on function public.review_task(uuid, text) to authenticated;
