-- Run once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  pfp text,
  role text not null default 'user',
  created_at timestamptz default now()
);

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  watchlist jsonb not null default '[]',
  history jsonb not null default '[]',
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "own profile read" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "own data all" on public.user_data for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads data" on public.user_data for select using (public.is_admin());

-- users may change ONLY their picture, never their role
revoke update on public.profiles from authenticated, anon;
grant update (pfp) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.user_data (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- After you create your own account in the app, make it the owner:
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';

-- Global admin popup notifications visible to all users
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  tone text not null default 'info',
  badge text,
  image_url text,
  cta_label text,
  cta_url text,
  dismissible boolean not null default true,
  show_once boolean not null default true,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "anyone reads active notifications" on public.notifications;
create policy "anyone reads active notifications" on public.notifications
  for select using (
    (active = true and (expires_at is null or expires_at > now()))
    or public.is_admin()
  );

drop policy if exists "admin manages notifications" on public.notifications;
create policy "admin manages notifications" on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());
