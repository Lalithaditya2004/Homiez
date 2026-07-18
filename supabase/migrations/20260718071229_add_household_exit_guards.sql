-- Safe household exits and cleanup.
-- A user can have only one active household, debtors cannot leave, and an
-- abandoned household can only be deleted when one debt-free active member remains.

do $$
begin
  if exists (
    select 1
    from public.household_members
    where status = 'active'
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Resolve users with multiple active households before applying this migration.';
  end if;
end;
$$;

create unique index household_members_one_active_household_idx
  on public.household_members(user_id)
  where status = 'active';

create or replace function private.member_owes_anyone(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.peer_balances as balance
    where balance.household_id = p_household_id
      and (
        (balance.user_low_id = p_user_id and balance.balance > 0)
        or (balance.user_high_id = p_user_id and balance.balance < 0)
      )
  );
$$;

revoke all on function private.member_owes_anyone(uuid, uuid) from public;

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_join_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;
  if exists (
    select 1 from public.household_members
    where user_id = (select auth.uid()) and status = 'active'
  ) then
    raise exception 'Leave or delete your current household before creating another one.';
  end if;

  v_join_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.households (name, join_code, created_by)
  values (trim(p_name), v_join_code, (select auth.uid()))
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id)
  values (v_household_id, (select auth.uid()));

  return v_household_id;
end;
$$;

create or replace function public.join_household(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_existing_status text;
  v_moved_out_by uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  select id into v_household_id
  from public.households
  where join_code = upper(trim(p_join_code));

  if v_household_id is null then
    raise exception 'Join code not found.';
  end if;

  select status, moved_out_by into v_existing_status, v_moved_out_by
  from public.household_members
  where household_id = v_household_id and user_id = (select auth.uid());

  if v_existing_status = 'active' then
    return v_household_id;
  end if;

  if exists (
    select 1 from public.household_members
    where user_id = (select auth.uid()) and status = 'active'
  ) then
    raise exception 'Leave or delete your current household before joining another one.';
  end if;

  if v_existing_status = 'archived' then
    if v_moved_out_by <> (select auth.uid()) then
      raise exception 'Only the roommate who moved you out can restore this membership.';
    end if;
    update public.household_members
    set status = 'active', moved_out_by = null, moved_out_at = null
    where household_id = v_household_id and user_id = (select auth.uid());
    return v_household_id;
  end if;

  insert into public.household_members (household_id, user_id)
  values (v_household_id, (select auth.uid()));

  return v_household_id;
end;
$$;

create or replace function public.move_out_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_active_household_member(p_household_id) then
    raise exception 'Only an active household member can move someone out.';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Use Leave household to move yourself out.';
  end if;
  if private.member_owes_anyone(p_household_id, p_user_id) then
    raise exception 'This roommate must settle everything they owe before moving out.';
  end if;

  update public.household_members
  set status = 'archived', moved_out_by = (select auth.uid()), moved_out_at = now()
  where household_id = p_household_id and user_id = p_user_id and status = 'active';

  if not found then
    raise exception 'Active roommate not found.';
  end if;
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_count integer;
begin
  if (select auth.uid()) is null or not private.is_active_household_member(p_household_id) then
    raise exception 'You are not an active member of this household.';
  end if;

  perform 1 from public.households where id = p_household_id for update;
  if not found then raise exception 'Household not found.'; end if;

  select count(*) into v_active_count
  from public.household_members
  where household_id = p_household_id and status = 'active';

  if v_active_count <= 1 then
    raise exception 'You are the last active member. Delete the household instead.';
  end if;
  if private.member_owes_anyone(p_household_id, (select auth.uid())) then
    raise exception 'Settle everything you owe before leaving this household.';
  end if;

  update public.household_members
  set status = 'archived', moved_out_by = (select auth.uid()), moved_out_at = now()
  where household_id = p_household_id and user_id = (select auth.uid()) and status = 'active';
end;
$$;

create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_count integer;
begin
  if (select auth.uid()) is null or not private.is_active_household_member(p_household_id) then
    raise exception 'You are not an active member of this household.';
  end if;

  perform 1 from public.households where id = p_household_id for update;
  if not found then raise exception 'Household not found.'; end if;

  select count(*) into v_active_count
  from public.household_members
  where household_id = p_household_id and status = 'active';

  if v_active_count <> 1 then
    raise exception 'A household can be deleted only when you are its sole active member.';
  end if;
  if exists (
    select 1 from public.peer_balances
    where household_id = p_household_id and balance <> 0
  ) then
    raise exception 'Resolve every household balance before deleting this household.';
  end if;
  if exists (
    select 1 from public.settlement_requests
    where household_id = p_household_id and status = 'in-review'
  ) then
    raise exception 'Resolve pending settlement requests before deleting this household.';
  end if;

  delete from public.households where id = p_household_id;
end;
$$;

create or replace function public.reclaim_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;
  if exists (
    select 1 from public.household_members
    where user_id = p_user_id and status = 'active'
  ) then
    raise exception 'This roommate already belongs to an active household.';
  end if;

  update public.household_members
  set status = 'active', moved_out_by = null, moved_out_at = null
  where household_id = p_household_id
    and user_id = p_user_id
    and status = 'archived'
    and moved_out_by = (select auth.uid());

  if not found then
    raise exception 'Only the roommate who initiated this move-out can undo it.';
  end if;
end;
$$;

revoke all on function public.leave_household(uuid) from public;
revoke all on function public.delete_household(uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.delete_household(uuid) to authenticated;

-- The app uses create_expense_v2, which is the only expense RPC that maintains
-- peer_balances. Keep legacy clients from creating ledger drift.
revoke execute on function public.create_expense(uuid, uuid, integer, text, jsonb) from authenticated;

-- The initial schema was applied through the Dashboard in UAT, which assigned
-- explicit anon EXECUTE grants. Remove them independently of PUBLIC grants.
revoke execute on function public.accept_settlement(uuid, jsonb) from anon;
revoke execute on function public.confirm_settlement_transaction(uuid) from anon;
revoke execute on function public.create_expense(uuid, uuid, integer, text, jsonb) from anon;
revoke execute on function public.create_expense_v2(uuid, uuid, integer, text, text, jsonb) from anon;
revoke execute on function public.create_household(text) from anon;
revoke execute on function public.join_household(text) from anon;
revoke execute on function public.move_out_member(uuid, uuid) from anon;
revoke execute on function public.reclaim_member(uuid, uuid) from anon;
revoke execute on function public.request_peer_settlement(uuid, uuid, integer) from anon;
revoke execute on function public.resolve_peer_settlement(uuid, text, integer) from anon;
revoke execute on function public.leave_household(uuid) from anon;
revoke execute on function public.delete_household(uuid) from anon;
