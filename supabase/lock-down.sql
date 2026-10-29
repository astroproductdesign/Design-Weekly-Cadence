-- Design Cadence: lock the database to signed-in team members.
-- Run this LAST, after sign-in works on the live site (see the README, "Secure sign-in").
-- It replaces the "open access" policies, so nobody without a session can read or write anything.
--
-- Safety check: it refuses to run until at least one design lead or admin has signed in
-- once, so you can't lock everyone out.

do $$
begin
  if not exists (select 1 from people where auth_user_id is not null and active and role in ('admin', 'lead')) then
    raise exception 'Stop: no admin or design lead has signed in yet. Sign in on the live site first, then run this again.';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['people','projects','sprints','tasks','updates','important_dates','action_items','reactions','settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open access" on %I', t);
    execute format('drop policy if exists "team access" on %I', t);
  end loop;

  -- Everything except people: any signed-in team member can read and write.
  foreach t in array array['projects','sprints','tasks','updates','important_dates','action_items','reactions','settings'] loop
    execute format(
      'create policy "team access" on %I for all to authenticated using (public.current_person() is not null) with check (public.current_person() is not null)',
      t);
  end loop;
end $$;

-- People: everyone signed in can read. Only the design lead and admins add, remove or change roles.
-- Anyone can edit their own row (colour, photo).
drop policy if exists "team read" on people;
drop policy if exists "managers insert" on people;
drop policy if exists "managers or self update" on people;
drop policy if exists "managers delete" on people;
create policy "team read" on people for select to authenticated using (public.current_person() is not null);
create policy "managers insert" on people for insert to authenticated with check (public.current_role_name() in ('lead', 'admin'));
create policy "managers or self update" on people for update to authenticated
  using (public.current_role_name() in ('lead', 'admin') or id = public.current_person())
  with check (public.current_role_name() in ('lead', 'admin') or id = public.current_person());
create policy "managers delete" on people for delete to authenticated using (public.current_role_name() in ('lead', 'admin'));

-- Members can edit their own row, but not their role, email or access. Changing someone's email signs them out.
create or replace function public.people_guard() returns trigger
language plpgsql security invoker as $$
begin
  if auth.uid() is not null and coalesce(public.current_role_name(), '') not in ('lead', 'admin') then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.email is distinct from old.email
       or new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Only the design lead or an admin can change that.';
    end if;
  end if;
  -- A new email means a new sign-in: unlink the old account so any device still signed in is cut off.
  if new.email is distinct from old.email and auth.uid() is not null then
    new.auth_user_id := null;
  end if;
  return new;
end $$;
drop trigger if exists people_guard on people;
create trigger people_guard before update on people for each row execute function public.people_guard();

-- To undo this and go back to open access (not recommended once live):
--   do $$ declare t text; begin
--     foreach t in array array['people','projects','sprints','tasks','updates','important_dates','action_items','reactions','settings'] loop
--       execute format('create policy "open access" on %I for all using (true) with check (true)', t);
--     end loop; end $$;
