-- A member who is still owed money must remain active so the debtor can send a
-- settlement request and the receiver can review it. Exit therefore requires
-- a square balance in both directions, not only zero outgoing debt.

create or replace function private.member_has_open_balance(p_household_id uuid, p_user_id uuid)
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
      and balance.balance <> 0
      and p_user_id in (balance.user_low_id, balance.user_high_id)
  );
$$;

revoke all on function private.member_has_open_balance(uuid, uuid) from public;

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
  if private.member_has_open_balance(p_household_id, p_user_id) then
    raise exception 'This roommate must settle everything they owe or are owed before moving out.';
  end if;

  update public.household_members
  set status = 'archived', moved_out_by = (select auth.uid()), moved_out_at = now()
  where household_id = p_household_id and user_id = p_user_id and status = 'active';

  if not found then
    raise exception 'Active roommate not found.';
  end if;

  update public.chore_logs as chore_log
  set assigned_to = null
  from public.chore_templates as template
  where template.id = chore_log.chore_template_id
    and template.household_id = p_household_id
    and chore_log.assigned_to = p_user_id
    and chore_log.status in ('active', 'inactive')
    and chore_log.deleted_at is null;
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
  if private.member_has_open_balance(p_household_id, (select auth.uid())) then
    raise exception 'Settle everything you owe or are owed before leaving this household.';
  end if;

  update public.household_members
  set status = 'archived', moved_out_by = (select auth.uid()), moved_out_at = now()
  where household_id = p_household_id and user_id = (select auth.uid()) and status = 'active';

  update public.chore_logs as chore_log
  set assigned_to = null
  from public.chore_templates as template
  where template.id = chore_log.chore_template_id
    and template.household_id = p_household_id
    and chore_log.assigned_to = (select auth.uid())
    and chore_log.status in ('active', 'inactive')
    and chore_log.deleted_at is null;
end;
$$;

drop function private.member_owes_anyone(uuid, uuid);

revoke execute on function public.move_out_member(uuid, uuid) from anon;
revoke execute on function public.leave_household(uuid) from anon;
