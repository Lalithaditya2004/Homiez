-- Creditor-authorized settlements, safe self-exit, password/account lifecycle support.

alter table public.users
  add column if not exists deleted_at timestamptz;

-- Ledger history needs a stable pseudonymous participant after the Auth identity
-- is removed. Account deletion anonymizes this row instead of cascading it.
alter table public.users drop constraint if exists users_id_fkey;

create or replace function private.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as membership
    join public.users as account on account.id = membership.user_id
    where membership.household_id = p_household_id
      and membership.user_id = (select auth.uid())
      and account.deleted_at is null
  );
$$;

create or replace function private.is_active_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as membership
    join public.users as account on account.id = membership.user_id
    where membership.household_id = p_household_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and account.deleted_at is null
  );
$$;

create or replace function private.is_user_active_household_member(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as membership
    join public.users as account on account.id = membership.user_id
    where membership.household_id = p_household_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
      and account.deleted_at is null
  );
$$;

create or replace function private.member_has_outgoing_debt(p_household_id uuid, p_user_id uuid)
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
      and ((balance.balance > 0 and balance.user_low_id = p_user_id)
        or (balance.balance < 0 and balance.user_high_id = p_user_id))
  );
$$;

create or replace function private.member_has_receivables(p_household_id uuid, p_user_id uuid)
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
      and ((balance.balance > 0 and balance.user_high_id = p_user_id)
        or (balance.balance < 0 and balance.user_low_id = p_user_id))
  );
$$;

create or replace function private.apply_peer_settlement(
  p_household_id uuid,
  p_debtor_id uuid,
  p_creditor_id uuid,
  p_amount integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer := p_amount;
  v_split record;
  v_applied integer;
begin
  if p_amount <= 0 or p_amount > private.current_peer_debt(p_household_id, p_debtor_id, p_creditor_id) then
    raise exception 'Settlement exceeds the current peer balance.';
  end if;

  perform private.adjust_peer_balance(p_household_id, p_debtor_id, p_creditor_id, -p_amount);
  for v_split in
    select expense.id as expense_id, split.owed_amount - split.settled_amount as available
    from public.expenses as expense
    join public.expense_splits as split on split.expense_id = expense.id
    where expense.household_id = p_household_id
      and expense.paid_by = p_creditor_id
      and split.user_id = p_debtor_id
      and split.owed_amount > split.settled_amount
    order by expense.created_at, expense.id
  loop
    exit when v_remaining <= 0;
    v_applied := least(v_remaining, v_split.available);
    update public.expense_splits
       set settled_amount = settled_amount + v_applied,
           settled_at = case when settled_amount + v_applied = owed_amount then now() else settled_at end
     where expense_id = v_split.expense_id and user_id = p_debtor_id;
    v_remaining := v_remaining - v_applied;
  end loop;

  if v_remaining <> 0 then
    raise exception 'Ledger detail does not match the peer balance.';
  end if;

  update public.expenses as expense
     set settled_at = coalesce(expense.settled_at, now())
   where expense.household_id = p_household_id
     and expense.settled_at is null
     and not exists (
       select 1 from public.expense_splits as split
       where split.expense_id = expense.id and split.owed_amount > split.settled_amount
     );
end;
$$;

create or replace function public.settle_receivable(
  p_household_id uuid,
  p_debtor_id uuid,
  p_amount integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creditor_id uuid := (select auth.uid());
  v_debt integer;
  v_request_id uuid;
begin
  perform private.purge_expired_ledger_history();
  if v_creditor_id is null or not private.is_active_household_member(p_household_id) then
    raise exception 'Only an active household member can settle a receivable.';
  end if;
  if p_debtor_id = v_creditor_id or not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_debtor_id
  ) then
    raise exception 'Choose a valid household debtor.';
  end if;

  perform 1 from public.peer_balances
  where household_id = p_household_id
    and user_low_id = least(p_debtor_id::text, v_creditor_id::text)::uuid
    and user_high_id = greatest(p_debtor_id::text, v_creditor_id::text)::uuid
  for update;
  v_debt := private.current_peer_debt(p_household_id, p_debtor_id, v_creditor_id);
  if p_amount <= 0 or p_amount > v_debt then
    raise exception 'Settlement exceeds the amount owed to you.';
  end if;

  update public.settlement_requests
     set status = 'rejected', resolved_at = now()
   where household_id = p_household_id
     and from_user_id = p_debtor_id
     and to_user_id = v_creditor_id
     and status = 'in-review';

  insert into public.settlement_requests (
    household_id, from_user_id, to_user_id, amount, claimed_amount,
    original_debt_amount, status, resolved_at
  ) values (
    p_household_id, p_debtor_id, v_creditor_id, p_amount, p_amount,
    v_debt, 'accepted', now()
  ) returning id into v_request_id;

  perform private.apply_peer_settlement(p_household_id, p_debtor_id, v_creditor_id, p_amount);
  insert into public.household_notifications (household_id, recipient_id, actor_id, type, settlement_request_id)
  values (p_household_id, p_debtor_id, v_creditor_id, 'settlement-accepted', v_request_id);
  return v_request_id;
end;
$$;

create or replace function public.settle_all_my_receivables(p_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creditor_id uuid := (select auth.uid());
  v_balance record;
  v_debtor_id uuid;
  v_amount integer;
  v_total integer := 0;
  v_request_id uuid;
begin
  perform private.purge_expired_ledger_history();
  if v_creditor_id is null or not private.is_active_household_member(p_household_id) then
    raise exception 'Only an active household member can settle receivables.';
  end if;

  for v_balance in
    select * from public.peer_balances
    where household_id = p_household_id
      and ((balance > 0 and user_high_id = v_creditor_id)
        or (balance < 0 and user_low_id = v_creditor_id))
    order by user_low_id, user_high_id
    for update
  loop
    v_debtor_id := case when v_balance.balance > 0 then v_balance.user_low_id else v_balance.user_high_id end;
    v_amount := abs(v_balance.balance);

    update public.settlement_requests
       set status = 'rejected', resolved_at = now()
     where household_id = p_household_id
       and from_user_id = v_debtor_id
       and to_user_id = v_creditor_id
       and status = 'in-review';

    insert into public.settlement_requests (
      household_id, from_user_id, to_user_id, amount, claimed_amount,
      original_debt_amount, status, resolved_at
    ) values (
      p_household_id, v_debtor_id, v_creditor_id, v_amount, v_amount,
      v_amount, 'accepted', now()
    ) returning id into v_request_id;

    perform private.apply_peer_settlement(p_household_id, v_debtor_id, v_creditor_id, v_amount);
    insert into public.household_notifications (household_id, recipient_id, actor_id, type, settlement_request_id)
    values (p_household_id, v_debtor_id, v_creditor_id, 'settlement-accepted', v_request_id);
    v_total := v_total + v_amount;
  end loop;
  return v_total;
end;
$$;

-- Recheck the live debt while holding the peer row lock. This prevents a stale
-- settlement request from inverting a balance after a creditor settled it.
create or replace function public.resolve_peer_settlement(
  p_request_id uuid,
  p_action text,
  p_accepted_amount integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.settlement_requests%rowtype;
  v_amount integer;
  v_debt integer;
begin
  perform private.purge_expired_ledger_history();
  select * into v_request from public.settlement_requests where id = p_request_id for update;
  if not found or v_request.status <> 'in-review' then
    raise exception 'This settlement is no longer awaiting review.';
  end if;
  if (select auth.uid()) <> v_request.to_user_id or not private.is_active_household_member(v_request.household_id) then
    raise exception 'Only the receiving roommate can review this settlement.';
  end if;
  if p_action = 'reject' then
    update public.settlement_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
    insert into public.household_notifications (household_id, recipient_id, actor_id, type, settlement_request_id)
    values (v_request.household_id, v_request.from_user_id, v_request.to_user_id, 'settlement-rejected', p_request_id);
    return;
  end if;
  if p_action <> 'accept' then raise exception 'Action must be accept or reject.'; end if;

  perform 1 from public.peer_balances
  where household_id = v_request.household_id
    and user_low_id = least(v_request.from_user_id::text, v_request.to_user_id::text)::uuid
    and user_high_id = greatest(v_request.from_user_id::text, v_request.to_user_id::text)::uuid
  for update;
  v_debt := private.current_peer_debt(v_request.household_id, v_request.from_user_id, v_request.to_user_id);
  v_amount := coalesce(p_accepted_amount, v_request.claimed_amount);
  if v_amount <= 0 or v_amount > least(v_request.claimed_amount, v_debt) then
    raise exception 'Accepted amount exceeds the current debt.';
  end if;

  update public.settlement_requests
     set amount = v_amount, status = 'accepted', resolved_at = now()
   where id = p_request_id;
  perform private.apply_peer_settlement(v_request.household_id, v_request.from_user_id, v_request.to_user_id, v_amount);
  insert into public.household_notifications (household_id, recipient_id, actor_id, type, settlement_request_id)
  values (v_request.household_id, v_request.from_user_id, v_request.to_user_id, 'settlement-accepted', p_request_id);
end;
$$;

create or replace function public.leave_household_settling_receivables(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_active_household_member(p_household_id) then
    raise exception 'You are not an active member of this household.';
  end if;
  if private.member_has_outgoing_debt(p_household_id, (select auth.uid())) then
    raise exception 'Settle everything you owe before leaving this household.';
  end if;
  perform public.settle_all_my_receivables(p_household_id);
  perform public.leave_household(p_household_id);
end;
$$;

create or replace function private.ensure_live_household_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.users where id = new.created_by and deleted_at is null
  ) then
    raise exception 'This account has been deleted.';
  end if;
  return new;
end;
$$;

create or replace function private.ensure_live_household_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and not exists (
    select 1 from public.users where id = new.user_id and deleted_at is null
  ) then
    raise exception 'This account has been deleted.';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_live_household_creator on public.households;
create trigger ensure_live_household_creator
before insert or update of created_by on public.households
for each row execute function private.ensure_live_household_creator();

drop trigger if exists ensure_live_household_member on public.household_members;
create trigger ensure_live_household_member
before insert or update of user_id, status on public.household_members
for each row execute function private.ensure_live_household_member();

create or replace function private.protect_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is not null and (select auth.uid()) = old.id then
    raise exception 'This account has been deleted.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_deleted_profile on public.users;
create trigger protect_deleted_profile
before update on public.users
for each row execute function private.protect_deleted_profile();

create or replace function public.prepare_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_membership record;
  v_active_count integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  perform 1 from public.users where id = v_user_id and deleted_at is null for update;
  if not found then raise exception 'Account not found or already deleted.'; end if;

  if exists (
    select 1 from public.peer_balances
    where balance <> 0 and v_user_id in (user_low_id, user_high_id)
  ) then
    raise exception 'Your account cannot be deleted while you owe money or are owed money.';
  end if;
  if exists (
    select 1 from public.settlement_requests
    where status = 'in-review' and v_user_id in (from_user_id, to_user_id)
  ) then
    raise exception 'Resolve pending settlement requests before deleting your account.';
  end if;

  for v_membership in
    select household_id from public.household_members
    where user_id = v_user_id and status = 'active'
    order by household_id
  loop
    perform 1 from public.households where id = v_membership.household_id for update;
    select count(*) into v_active_count
    from public.household_members
    where household_id = v_membership.household_id and status = 'active';

    if v_active_count = 1 then
      delete from public.households where id = v_membership.household_id;
    else
      update public.household_members
         set status = 'archived', moved_out_by = v_user_id, moved_out_at = now()
       where household_id = v_membership.household_id and user_id = v_user_id and status = 'active';
      update public.chore_logs as chore_log
         set assigned_to = null
        from public.chore_templates as template
       where template.id = chore_log.chore_template_id
         and template.household_id = v_membership.household_id
         and chore_log.assigned_to = v_user_id
         and chore_log.status in ('active', 'inactive')
         and chore_log.deleted_at is null;
    end if;
  end loop;

  delete from public.household_notifications where recipient_id = v_user_id or actor_id = v_user_id;
  update public.users
     set email = 'deleted+' || replace(v_user_id::text, '-', '') || '@deleted.homiez.invalid',
         display_name = 'Deleted member',
         deleted_at = now()
   where id = v_user_id;
  return v_user_id;
end;
$$;

revoke all on function private.member_has_outgoing_debt(uuid, uuid) from public;
revoke all on function private.member_has_receivables(uuid, uuid) from public;
revoke all on function private.apply_peer_settlement(uuid, uuid, uuid, integer) from public;
revoke all on function private.ensure_live_household_creator() from public;
revoke all on function private.ensure_live_household_member() from public;
revoke all on function private.protect_deleted_profile() from public;

revoke all on function public.settle_receivable(uuid, uuid, integer) from public;
revoke all on function public.settle_all_my_receivables(uuid) from public;
revoke all on function public.leave_household_settling_receivables(uuid) from public;
revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.settle_receivable(uuid, uuid, integer) to authenticated;
grant execute on function public.settle_all_my_receivables(uuid) to authenticated;
grant execute on function public.leave_household_settling_receivables(uuid) to authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;

revoke execute on function public.settle_receivable(uuid, uuid, integer) from anon;
revoke execute on function public.settle_all_my_receivables(uuid) from anon;
revoke execute on function public.leave_household_settling_receivables(uuid) from anon;
revoke execute on function public.prepare_account_deletion() from anon;
