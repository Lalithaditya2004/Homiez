-- Peer ledger, reviewed settlements, household currency, and 30-day expense history.

alter table public.households
  add column currency text check (currency is null or currency ~ '^[A-Z]{3}$');

alter table public.expenses
  add column currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  add column settled_at timestamptz;

alter table public.expense_splits
  add column settled_amount integer not null default 0 check (settled_amount >= 0 and settled_amount <= owed_amount),
  add column settled_at timestamptz;

update public.expense_splits as split
set settled_amount = split.owed_amount, settled_at = now()
from public.expenses as expense
where expense.id = split.expense_id and split.user_id = expense.paid_by;

update public.households as household
set currency = (
  select expense.currency
  from public.expenses as expense
  where expense.household_id = household.id
  order by expense.created_at
  limit 1
)
where exists (select 1 from public.expenses as expense where expense.household_id = household.id);

create table public.peer_balances (
  household_id uuid not null references public.households(id) on delete cascade,
  user_low_id uuid not null references public.users(id) on delete restrict,
  user_high_id uuid not null references public.users(id) on delete restrict,
  balance integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (household_id, user_low_id, user_high_id),
  check (user_low_id <> user_high_id),
  check (user_low_id::text < user_high_id::text)
);

-- Positive balance means user_low owes user_high; negative means user_high owes user_low.
insert into public.peer_balances (household_id, user_low_id, user_high_id, balance)
select expense.household_id,
       least(split.user_id::text, expense.paid_by::text)::uuid,
       greatest(split.user_id::text, expense.paid_by::text)::uuid,
       sum(case when split.user_id::text < expense.paid_by::text then split.owed_amount else -split.owed_amount end)::integer
from public.expenses as expense
join public.expense_splits as split on split.expense_id = expense.id
where split.user_id <> expense.paid_by
group by expense.household_id,
         least(split.user_id::text, expense.paid_by::text)::uuid,
         greatest(split.user_id::text, expense.paid_by::text)::uuid
having sum(case when split.user_id::text < expense.paid_by::text then split.owed_amount else -split.owed_amount end) <> 0;

create table public.settlement_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete restrict,
  to_user_id uuid not null references public.users(id) on delete restrict,
  amount integer not null check (amount > 0),
  claimed_amount integer not null check (claimed_amount > 0),
  original_debt_amount integer not null check (original_debt_amount > 0),
  status text not null default 'in-review' check (status in ('in-review', 'accepted', 'rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id),
  check (amount <= claimed_amount),
  check (
    (status = 'in-review' and resolved_at is null)
    or (status in ('accepted', 'rejected') and resolved_at is not null)
  )
);

create table public.household_notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('settlement-requested', 'settlement-accepted', 'settlement-rejected')),
  settlement_request_id uuid references public.settlement_requests(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index settlement_requests_household_status_idx on public.settlement_requests(household_id, status, created_at desc);
create index settlement_requests_from_idx on public.settlement_requests(from_user_id, status);
create index settlement_requests_to_idx on public.settlement_requests(to_user_id, status);
create index expenses_settled_at_idx on public.expenses(settled_at) where settled_at is not null;
create index household_notifications_recipient_idx on public.household_notifications(recipient_id, created_at desc);

create or replace function private.adjust_peer_balance(
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
  v_low uuid;
  v_high uuid;
  v_delta integer;
begin
  if p_debtor_id = p_creditor_id or p_amount = 0 then return; end if;
  v_low := least(p_debtor_id::text, p_creditor_id::text)::uuid;
  v_high := greatest(p_debtor_id::text, p_creditor_id::text)::uuid;
  v_delta := case when p_debtor_id = v_low then p_amount else -p_amount end;

  insert into public.peer_balances (household_id, user_low_id, user_high_id, balance)
  values (p_household_id, v_low, v_high, v_delta)
  on conflict (household_id, user_low_id, user_high_id)
  do update set balance = public.peer_balances.balance + excluded.balance, updated_at = now();

  delete from public.peer_balances
  where household_id = p_household_id and user_low_id = v_low and user_high_id = v_high and balance = 0;
end;
$$;

create or replace function private.current_peer_debt(
  p_household_id uuid,
  p_debtor_id uuid,
  p_creditor_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, coalesce((
    select balance * case when p_debtor_id::text < p_creditor_id::text then 1 else -1 end
    from public.peer_balances
    where household_id = p_household_id
      and user_low_id = least(p_debtor_id::text, p_creditor_id::text)::uuid
      and user_high_id = greatest(p_debtor_id::text, p_creditor_id::text)::uuid
  ), 0));
$$;

create or replace function private.net_opposing_expense_splits(
  p_household_id uuid,
  p_user_a uuid,
  p_user_b uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a_expense_id uuid;
  v_b_expense_id uuid;
  v_a_available integer;
  v_b_available integer;
  v_offset integer;
begin
  loop
    select expense.id, split.owed_amount - split.settled_amount
      into v_a_expense_id, v_a_available
      from public.expenses as expense
      join public.expense_splits as split on split.expense_id = expense.id
     where expense.household_id = p_household_id and expense.paid_by = p_user_b
       and split.user_id = p_user_a and split.owed_amount > split.settled_amount
     order by expense.created_at, expense.id limit 1;
    if not found then exit; end if;
    select expense.id, split.owed_amount - split.settled_amount
      into v_b_expense_id, v_b_available
      from public.expenses as expense
      join public.expense_splits as split on split.expense_id = expense.id
     where expense.household_id = p_household_id and expense.paid_by = p_user_a
       and split.user_id = p_user_b and split.owed_amount > split.settled_amount
     order by expense.created_at, expense.id limit 1;
    if not found then exit; end if;
    v_offset := least(v_a_available, v_b_available);
    update public.expense_splits set settled_amount = settled_amount + v_offset,
      settled_at = case when settled_amount + v_offset = owed_amount then now() else settled_at end
      where expense_id = v_a_expense_id and user_id = p_user_a;
    update public.expense_splits set settled_amount = settled_amount + v_offset,
      settled_at = case when settled_amount + v_offset = owed_amount then now() else settled_at end
      where expense_id = v_b_expense_id and user_id = p_user_b;
  end loop;
  update public.expenses as expense set settled_at = coalesce(expense.settled_at, now())
  where expense.household_id = p_household_id and expense.settled_at is null and not exists (
    select 1 from public.expense_splits as split where split.expense_id = expense.id and split.owed_amount > split.settled_amount
  );
end;
$$;

do $$
declare v_pair record;
begin
  for v_pair in select household_id, user_low_id, user_high_id from public.peer_balances
  loop
    perform private.net_opposing_expense_splits(v_pair.household_id, v_pair.user_low_id, v_pair.user_high_id);
  end loop;
end;
$$;

create or replace function private.purge_expired_ledger_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.household_notifications where created_at < now() - interval '30 days';
  delete from public.settlement_requests where resolved_at < now() - interval '30 days';
  delete from public.expenses where settled_at < now() - interval '30 days';
end;
$$;

create or replace function public.create_expense_v2(
  p_household_id uuid,
  p_paid_by uuid,
  p_amount integer,
  p_description text,
  p_currency text,
  p_splits jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_split jsonb;
  v_split_total integer := 0;
  v_user_id uuid;
  v_owed_amount integer;
begin
  perform private.purge_expired_ledger_history();
  if (select auth.uid()) is null or not private.is_active_household_member(p_household_id) then
    raise exception 'Only an active household member can add an expense';
  end if;
  if p_amount <= 0 or char_length(trim(p_description)) not between 1 and 160 or jsonb_array_length(p_splits) = 0 then
    raise exception 'An expense needs a description, a positive amount, and at least one split';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'Choose a valid three-letter currency'; end if;
  if not private.is_user_active_household_member(p_household_id, p_paid_by) then
    raise exception 'The payer must be an active household member';
  end if;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    v_user_id := (v_split ->> 'user_id')::uuid;
    v_owed_amount := (v_split ->> 'owed_amount')::integer;
    if v_owed_amount < 0 or not private.is_user_active_household_member(p_household_id, v_user_id) then
      raise exception 'Every split must belong to an active household member with a non-negative amount';
    end if;
    v_split_total := v_split_total + v_owed_amount;
  end loop;
  if v_split_total <> p_amount then raise exception 'Expense splits must add up exactly to the expense amount'; end if;

  update public.households set currency = coalesce(currency, upper(p_currency)) where id = p_household_id;
  insert into public.expenses (household_id, paid_by, amount, description, currency)
  values (p_household_id, p_paid_by, p_amount, trim(p_description), upper(p_currency))
  returning id into v_expense_id;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    v_user_id := (v_split ->> 'user_id')::uuid;
    v_owed_amount := (v_split ->> 'owed_amount')::integer;
    insert into public.expense_splits (expense_id, user_id, owed_amount, settled_amount, settled_at)
    values (v_expense_id, v_user_id, v_owed_amount,
      case when v_user_id = p_paid_by then v_owed_amount else 0 end,
      case when v_user_id = p_paid_by then now() else null end);
    if v_user_id <> p_paid_by and v_owed_amount > 0 then
      perform private.adjust_peer_balance(p_household_id, v_user_id, p_paid_by, v_owed_amount);
      perform private.net_opposing_expense_splits(p_household_id, v_user_id, p_paid_by);
    end if;
  end loop;
  return v_expense_id;
end;
$$;

create or replace function public.request_peer_settlement(
  p_household_id uuid,
  p_to_user_id uuid,
  p_amount integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_user_id uuid := (select auth.uid());
  v_debt integer;
  v_reserved integer;
  v_request_id uuid;
begin
  perform private.purge_expired_ledger_history();
  if v_from_user_id is null or not private.is_active_household_member(p_household_id) then
    raise exception 'Only active household members can settle balances';
  end if;
  if not private.is_user_active_household_member(p_household_id, p_to_user_id) then
    raise exception 'The receiver must be an active household member';
  end if;
  v_debt := private.current_peer_debt(p_household_id, v_from_user_id, p_to_user_id);
  select coalesce(sum(amount), 0) into v_reserved
  from public.settlement_requests
  where household_id = p_household_id and from_user_id = v_from_user_id and to_user_id = p_to_user_id and status = 'in-review';
  if p_amount <= 0 or p_amount > v_debt - v_reserved then raise exception 'Settlement exceeds the actionable peer balance'; end if;

  insert into public.settlement_requests (household_id, from_user_id, to_user_id, amount, claimed_amount, original_debt_amount)
  values (p_household_id, v_from_user_id, p_to_user_id, p_amount, p_amount, v_debt - v_reserved)
  returning id into v_request_id;
  insert into public.household_notifications (household_id, recipient_id, actor_id, type, settlement_request_id)
  values (p_household_id, p_to_user_id, v_from_user_id, 'settlement-requested', v_request_id);
  return v_request_id;
end;
$$;

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
  v_remaining integer;
  v_split record;
  v_applied integer;
begin
  perform private.purge_expired_ledger_history();
  select * into v_request from public.settlement_requests where id = p_request_id for update;
  if not found or v_request.status <> 'in-review' then raise exception 'This settlement is no longer awaiting review'; end if;
  if (select auth.uid()) <> v_request.to_user_id or not private.is_active_household_member(v_request.household_id) then
    raise exception 'Only the receiving roommate can review this settlement';
  end if;
  if p_action = 'reject' then
    update public.settlement_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
    insert into public.household_notifications (household_id, recipient_id, actor_id, type, settlement_request_id)
    values (v_request.household_id, v_request.from_user_id, v_request.to_user_id, 'settlement-rejected', p_request_id);
    return;
  end if;
  if p_action <> 'accept' then raise exception 'Action must be accept or reject'; end if;
  v_amount := coalesce(p_accepted_amount, v_request.claimed_amount);
  if v_amount <= 0 or v_amount > v_request.claimed_amount then raise exception 'Accepted amount must be within the claimed amount'; end if;

  update public.settlement_requests set amount = v_amount, status = 'accepted', resolved_at = now() where id = p_request_id;
  perform private.adjust_peer_balance(v_request.household_id, v_request.from_user_id, v_request.to_user_id, -v_amount);
  v_remaining := v_amount;
  for v_split in
    select expense.id as expense_id, split.owed_amount - split.settled_amount as available
    from public.expenses as expense
    join public.expense_splits as split on split.expense_id = expense.id
    where expense.household_id = v_request.household_id
      and expense.paid_by = v_request.to_user_id
      and split.user_id = v_request.from_user_id
      and split.owed_amount > split.settled_amount
    order by expense.created_at, expense.id
  loop
    exit when v_remaining <= 0;
    v_applied := least(v_remaining, v_split.available);
    update public.expense_splits set settled_amount = settled_amount + v_applied,
      settled_at = case when settled_amount + v_applied = owed_amount then now() else settled_at end
      where expense_id = v_split.expense_id and user_id = v_request.from_user_id;
    v_remaining := v_remaining - v_applied;
  end loop;
  update public.expenses as expense
     set settled_at = coalesce(expense.settled_at, now())
   where expense.household_id = v_request.household_id
     and expense.settled_at is null
     and not exists (
       select 1 from public.expense_splits as split
       where split.expense_id = expense.id
         and split.owed_amount > split.settled_amount
     );
  insert into public.household_notifications (household_id, recipient_id, actor_id, type, settlement_request_id)
  values (v_request.household_id, v_request.from_user_id, v_request.to_user_id, 'settlement-accepted', p_request_id);
end;
$$;

-- Skips carry actor attribution but never chore credit. Repeating skips keep one live instance and append one history record.
alter table public.chore_logs drop constraint chore_logs_lifecycle_check;
alter table public.chore_logs
  add constraint chore_logs_lifecycle_check check (
    (status in ('active', 'inactive') and completed_by is null and completed_at is null and completion_type is null)
    or (status = 'completed' and completed_at is not null and completion_type is not null
      and (completion_type = 'skipped' or completed_by is not null))
  );

create or replace function public.skip_chore(p_log_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_template record;
  v_log record;
  v_available_at timestamptz;
begin
  if not (select private.can_edit_chore_log(p_log_id)) then raise exception 'You cannot edit this chore.'; end if;
  select template.*, chore_log.assigned_to into v_template
  from public.chore_logs as chore_log join public.chore_templates as template on template.id = chore_log.chore_template_id
  where chore_log.id = p_log_id and chore_log.deleted_at is null and chore_log.status in ('active', 'inactive');
  if not found then raise exception 'This chore cannot be skipped.'; end if;

  if v_template.frequency_interval is null then
    update public.chore_logs set status = 'completed', completed_by = (select auth.uid()), completed_at = v_now,
      completion_type = 'skipped', available_at = null, snoozed_until = null where id = p_log_id;
  else
    v_available_at := private.chore_next_at(v_now, v_template.frequency_interval, v_template.frequency_unit);
    update public.chore_logs set status = 'inactive', due_date = null, available_at = v_available_at, snoozed_until = null where id = p_log_id;
    insert into public.chore_logs (chore_template_id, assigned_to, completed_by, status, completion_type, completed_at)
    values (v_template.id, v_template.assigned_to, (select auth.uid()), 'completed', 'skipped', v_now);
  end if;
end;
$$;

revoke all on function private.adjust_peer_balance(uuid, uuid, uuid, integer) from public;
revoke all on function private.current_peer_debt(uuid, uuid, uuid) from public;
revoke all on function private.net_opposing_expense_splits(uuid, uuid, uuid) from public;
revoke all on function private.purge_expired_ledger_history() from public;
revoke all on function public.create_expense_v2(uuid, uuid, integer, text, text, jsonb) from public;
revoke all on function public.request_peer_settlement(uuid, uuid, integer) from public;
revoke all on function public.resolve_peer_settlement(uuid, text, integer) from public;
grant execute on function public.create_expense_v2(uuid, uuid, integer, text, text, jsonb) to authenticated;
grant execute on function public.request_peer_settlement(uuid, uuid, integer) to authenticated;
grant execute on function public.resolve_peer_settlement(uuid, text, integer) to authenticated;

alter table public.peer_balances enable row level security;
alter table public.settlement_requests enable row level security;
alter table public.household_notifications enable row level security;
create policy "Members can read peer balances" on public.peer_balances for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy "Members can read settlement requests" on public.settlement_requests for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy "Recipients can read household notifications" on public.household_notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and (select private.is_household_member(household_id)));

grant select on public.peer_balances to authenticated;
grant select on public.settlement_requests to authenticated;
grant select on public.household_notifications to authenticated;
alter publication supabase_realtime add table public.peer_balances;
alter publication supabase_realtime add table public.settlement_requests;
alter publication supabase_realtime add table public.household_notifications;

-- Run daily when pg_cron is available. The same purge also runs transactionally on ledger mutations.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('homiez-ledger-history-purge', '17 3 * * *', 'select private.purge_expired_ledger_history()');
  end if;
exception when others then
  raise notice 'Daily purge schedule was not installed: %', sqlerrm;
end;
$$;
