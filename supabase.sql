-- Ejecutar en Supabase SQL Editor. Activar Auth > Email para los 2 usuarios.
create extension if not exists pgcrypto;
create table if not exists public.households(id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id), created_at timestamptz default now());
create table if not exists public.memberships(household_id uuid not null references public.households(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, primary key(household_id,user_id));
create table if not exists public.lots(id uuid primary key, household_id uuid not null references public.households(id) on delete cascade, name text not null, qty numeric not null check(qty>=0), unit text not null, location text not null check(location in ('Nevera','Congelador','Despensa')), expires date, date_type text, created_at timestamptz default now(), frozen_at date, thawed_at date);
create table if not exists public.movements(id bigint generated always as identity primary key,household_id uuid not null references public.households(id) on delete cascade,actor uuid default auth.uid(),kind text,detail text,created_at timestamptz default now());
alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.lots enable row level security;
alter table public.movements enable row level security;
create policy "members can read own membership" on public.memberships for select to authenticated using(user_id=auth.uid());
create policy "members can read lots" on public.lots for select to authenticated using(exists(select 1 from public.memberships m where m.household_id=lots.household_id and m.user_id=auth.uid()));
create policy "members can add lots" on public.lots for insert to authenticated with check(exists(select 1 from public.memberships m where m.household_id=lots.household_id and m.user_id=auth.uid()));
create policy "members can update lots" on public.lots for update to authenticated using(exists(select 1 from public.memberships m where m.household_id=lots.household_id and m.user_id=auth.uid())) with check(exists(select 1 from public.memberships m where m.household_id=lots.household_id and m.user_id=auth.uid()));
create policy "members can read movements" on public.movements for select to authenticated using(exists(select 1 from public.memberships m where m.household_id=movements.household_id and m.user_id=auth.uid()));
create policy "members can add movements" on public.movements for insert to authenticated with check(actor=auth.uid() and exists(select 1 from public.memberships m where m.household_id=movements.household_id and m.user_id=auth.uid()));
create or replace function public.create_household() returns uuid language plpgsql security definer set search_path = '' as $$ declare hid uuid; begin if auth.uid() is null then raise exception 'Authentication required'; end if; insert into public.households(created_by) values (auth.uid()) returning id into hid; insert into public.memberships(household_id,user_id) values(hid,auth.uid()); return hid; end $$;
create or replace function public.join_household(join_id uuid) returns void language plpgsql security definer set search_path = '' as $$ begin if auth.uid() is null then raise exception 'Authentication required'; end if; if not exists(select 1 from public.households where id=join_id) then raise exception 'Código no válido'; end if; insert into public.memberships(household_id,user_id) values(join_id,auth.uid()) on conflict do nothing; end $$;
revoke all on function public.create_household() from public,anon;
revoke all on function public.join_household(uuid) from public,anon;
grant execute on function public.create_household() to authenticated;
grant execute on function public.join_household(uuid) to authenticated;
grant select on public.memberships to authenticated;
grant select,insert,update on public.lots to authenticated;
grant select,insert on public.movements to authenticated;
-- En Database > Publications, incluir public.lots en supabase_realtime para cambios push.
