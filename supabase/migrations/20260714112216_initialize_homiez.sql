-- Homiez MVP: household-scoped ledger, chore calendar, and strict row-level access.
-- Amounts are stored as integer cents so every split and Debt Detox calculation is exact.

create schema if not exists private;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  join_code text not null unique check (join_code = upper(join_code)),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  moved_out_by uuid references public.users(id) on delete restrict,
  moved_out_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  check (
    (status = 'active' and moved_out_by is null and moved_out_at is null)
    or (status = 'archived' and moved_out_by is not null and moved_out_at is not null)
  )
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  paid_by uuid not null references public.users(id) on delete restrict,
  amount integer not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  owed_amount integer not null check (owed_amount >= 0),
  created_at timestamptz not null default now(),
  primary key (expense_id, user_id)
);

create table public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((is_deleted and deleted_at is not null) or (not is_deleted and deleted_at is null))
);

create table public.chore_logs (
  id uuid primary key default gen_random_uuid(),
  chore_template_id uuid not null references public.chore_templates(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  completed_by uuid references public.users(id) on delete set null,
  due_date timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and completed_by is null and completed_at is null)
    or (status = 'completed' and completed_by is not null and completed_at is not null)
  )
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.settlement_transactions (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete restrict,
  to_user_id uuid not null references public.users(id) on delete restrict,
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  confirmed_by uuid references public.users(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id),
  check (
    (status = 'pending' and confirmed_by is null and confirmed_at is null)
    or (status = 'confirmed' and confirmed_by is not null and confirmed_at is not null)
  )
);

create index household_members_user_household_idx on public.household_members(user_id, household_id);
create index household_members_active_idx on public.household_members(household_id, user_id) where status = 'active';
create index expenses_household_created_idx on public.expenses(household_id, created_at desc);
create index expense_splits_user_idx on public.expense_splits(user_id);
create index chore_templates_household_active_idx on public.chore_templates(household_id, created_at desc) where not is_deleted;
create index chore_logs_template_due_idx on public.chore_logs(chore_template_id, due_date);
create index chore_logs_completed_idx on public.chore_logs(completed_at desc) where status = 'completed';
create index settlements_household_accepted_idx on public.settlements(household_id, accepted_at desc);
create index settlement_transactions_settlement_idx on public.settlement_transactions(settlement_id);

-- Private helpers deliberately use SECURITY DEFINER to avoid recursive RLS checks.
-- They are schema-qualified, use an empty search path, and are not client-callable.
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
    where membership.household_id = p_household_id
      and membership.user_id = (select auth.uid())
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
    where membership.household_id = p_household_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
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
    where membership.household_id = p_household_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
  );
$$;

create or replace function private.shares_household(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid()) or exists (
    select 1
    from public.household_members as mine
    join public.household_members as theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

create or replace function private.can_read_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expenses as expense
    where expense.id = p_expense_id
      and private.is_household_member(expense.household_id)
  );
$$;

create or replace function private.can_edit_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expenses as expense
    where expense.id = p_expense_id
      and private.is_active_household_member(expense.household_id)
  );
$$;

create or replace function private.can_read_chore_log(p_chore_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chore_logs as chore_log
    join public.chore_templates as template on template.id = chore_log.chore_template_id
    where chore_log.id = p_chore_log_id
      and private.is_household_member(template.household_id)
  );
$$;

create or replace function private.can_edit_chore_log(p_chore_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chore_logs as chore_log
    join public.chore_templates as template on template.id = chore_log.chore_template_id
    where chore_log.id = p_chore_log_id
      and private.is_active_household_member(template.household_id)
  );
$$;

create or replace function private.can_read_settlement_transaction(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.settlement_transactions as transaction
    join public.settlements as settlement on settlement.id = transaction.settlement_id
    where transaction.id = p_transaction_id
      and private.is_household_member(settlement.household_id)
  );
$$;

revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_active_household_member(uuid) from public;
revoke all on function private.is_user_active_household_member(uuid, uuid) from public;
revoke all on function private.shares_household(uuid) from public;
revoke all on function private.can_read_expense(uuid) from public;
revoke all on function private.can_edit_expense(uuid) from public;
revoke all on function private.can_read_chore_log(uuid) from public;
revoke all on function private.can_edit_chore_log(uuid) from public;
revoke all on function private.can_read_settlement_transaction(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_active_household_member(uuid) to authenticated;
grant execute on function private.is_user_active_household_member(uuid, uuid) to authenticated;
grant execute on function private.shares_household(uuid) to authenticated;
grant execute on function private.can_read_expense(uuid) to authenticated;
grant execute on function private.can_edit_expense(uuid) to authenticated;
grant execute on function private.can_read_chore_log(uuid) to authenticated;
grant execute on function private.can_edit_chore_log(uuid) to authenticated;
grant execute on function private.can_read_settlement_transaction(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Roommate')
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- These three narrowly scoped RPCs make the most sensitive membership changes atomic.
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
    raise exception 'Authentication is required';
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
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  select id into v_household_id
  from public.households
  where join_code = upper(trim(p_join_code));

  if v_household_id is null then
    raise exception 'Join code not found';
  end if;

  select status into v_existing_status
  from public.household_members
  where household_id = v_household_id and user_id = (select auth.uid());

  if v_existing_status = 'archived' then
    raise exception 'Archived membership can only be reclaimed by the roommate who initiated the move-out';
  end if;

  insert into public.household_members (household_id, user_id)
  values (v_household_id, (select auth.uid()))
  on conflict (household_id, user_id) do nothing;

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
    raise exception 'Only an active household member can move someone out';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot move yourself out';
  end if;

  update public.household_members
  set status = 'archived', moved_out_by = (select auth.uid()), moved_out_at = now()
  where household_id = p_household_id and user_id = p_user_id and status = 'active';

  if not found then
    raise exception 'Active roommate not found';
  end if;
end;
$$;

-- Expense and splits are written together to preserve the accounting invariant:
-- each expense amount always equals the total of its splits.
create or replace function public.create_expense(
  p_household_id uuid,
  p_paid_by uuid,
  p_amount integer,
  p_description text,
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
  v_user_id uuid;
  v_owed_amount integer;
  v_split_total integer := 0;
begin
  if (select auth.uid()) is null or not private.is_active_household_member(p_household_id) then
    raise exception 'Only an active household member can add an expense';
  end if;
  if p_amount <= 0 or char_length(trim(p_description)) = 0 or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'An expense needs a description, a positive amount, and at least one split';
  end if;
  if not private.is_user_active_household_member(p_household_id, p_paid_by) then
    raise exception 'The payer must be an active member of this household';
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

  if v_split_total <> p_amount then
    raise exception 'Expense splits must add up exactly to the expense amount';
  end if;

  insert into public.expenses (household_id, paid_by, amount, description)
  values (p_household_id, p_paid_by, p_amount, trim(p_description))
  returning id into v_expense_id;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.expense_splits (expense_id, user_id, owed_amount)
    values (v_expense_id, (v_split ->> 'user_id')::uuid, (v_split ->> 'owed_amount')::integer);
  end loop;

  return v_expense_id;
end;
$$;

create or replace function public.accept_settlement(p_household_id uuid, p_transactions jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement_id uuid;
  v_transaction jsonb;
  v_from_user_id uuid;
  v_to_user_id uuid;
  v_amount integer;
begin
  if (select auth.uid()) is null or not private.is_active_household_member(p_household_id) then
    raise exception 'Only an active household member can accept a settlement plan';
  end if;
  if jsonb_typeof(p_transactions) <> 'array' then
    raise exception 'Settlement transactions must be an array';
  end if;

  insert into public.settlements (household_id, created_by)
  values (p_household_id, (select auth.uid()))
  returning id into v_settlement_id;

  for v_transaction in select value from jsonb_array_elements(p_transactions)
  loop
    v_from_user_id := (v_transaction ->> 'from_user_id')::uuid;
    v_to_user_id := (v_transaction ->> 'to_user_id')::uuid;
    v_amount := (v_transaction ->> 'amount')::integer;
    if v_amount <= 0
      or v_from_user_id = v_to_user_id
      or not private.is_user_active_household_member(p_household_id, v_from_user_id)
      or not private.is_user_active_household_member(p_household_id, v_to_user_id) then
      raise exception 'Each settlement payment must be between active household members with a positive amount';
    end if;
    insert into public.settlement_transactions (settlement_id, from_user_id, to_user_id, amount)
    values (v_settlement_id, v_from_user_id, v_to_user_id, v_amount);
  end loop;

  return v_settlement_id;
end;
$$;

create or replace function public.confirm_settlement_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  update public.settlement_transactions as transaction
  set status = 'confirmed', confirmed_by = (select auth.uid()), confirmed_at = now()
  from public.settlements as settlement
  where transaction.id = p_transaction_id
    and settlement.id = transaction.settlement_id
    and transaction.status = 'pending'
    and transaction.from_user_id = (select auth.uid())
    and private.is_active_household_member(settlement.household_id);

  if not found then
    raise exception 'Only the payer can confirm a pending settlement payment';
  end if;
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
    raise exception 'Authentication is required';
  end if;

  update public.household_members
  set status = 'active', moved_out_by = null, moved_out_at = null
  where household_id = p_household_id
    and user_id = p_user_id
    and status = 'archived'
    and moved_out_by = (select auth.uid());

  if not found then
    raise exception 'Only the roommate who initiated this move-out can undo it';
  end if;
end;
$$;

revoke execute on function public.create_household(text) from public;
revoke execute on function public.join_household(text) from public;
revoke execute on function public.move_out_member(uuid, uuid) from public;
revoke execute on function public.reclaim_member(uuid, uuid) from public;
revoke execute on function public.create_expense(uuid, uuid, integer, text, jsonb) from public;
revoke execute on function public.accept_settlement(uuid, jsonb) from public;
revoke execute on function public.confirm_settlement_transaction(uuid) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.move_out_member(uuid, uuid) to authenticated;
grant execute on function public.reclaim_member(uuid, uuid) to authenticated;
grant execute on function public.create_expense(uuid, uuid, integer, text, jsonb) to authenticated;
grant execute on function public.accept_settlement(uuid, jsonb) to authenticated;
grant execute on function public.confirm_settlement_transaction(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.chore_templates enable row level security;
alter table public.chore_logs enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_transactions enable row level security;

create policy "Profiles are visible only to co-members"
  on public.users for select to authenticated
  using ((select private.shares_household(id)));

create policy "Users can update their own profile"
  on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members can read their household"
  on public.households for select to authenticated
  using ((select private.is_household_member(id)));

create policy "Members can update their household"
  on public.households for update to authenticated
  using ((select private.is_active_household_member(id)))
  with check ((select private.is_active_household_member(id)));

create policy "Members can read household membership"
  on public.household_members for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy "Members can read household expenses"
  on public.expenses for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy "Members can read expense splits"
  on public.expense_splits for select to authenticated
  using ((select private.can_read_expense(expense_id)));

create policy "Members can read chore templates"
  on public.chore_templates for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy "Active members can add chore templates"
  on public.chore_templates for insert to authenticated
  with check ((select private.is_active_household_member(household_id)));

create policy "Active members can update chore templates"
  on public.chore_templates for update to authenticated
  using ((select private.is_active_household_member(household_id)))
  with check ((select private.is_active_household_member(household_id)));

create policy "Active members can delete chore templates"
  on public.chore_templates for delete to authenticated
  using ((select private.is_active_household_member(household_id)));

create policy "Members can read chore logs"
  on public.chore_logs for select to authenticated
  using ((select private.can_read_chore_log(id)));

create policy "Active members can add chore logs"
  on public.chore_logs for insert to authenticated
  with check (
    exists (
      select 1 from public.chore_templates as template
      where template.id = chore_template_id
        and (select private.is_active_household_member(template.household_id))
    )
  );

create policy "Active members can update chore logs"
  on public.chore_logs for update to authenticated
  using ((select private.can_edit_chore_log(id)))
  with check ((select private.can_edit_chore_log(id)));

create policy "Active members can delete chore logs"
  on public.chore_logs for delete to authenticated
  using ((select private.can_edit_chore_log(id)));

create policy "Members can read settlements"
  on public.settlements for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy "Members can read settlement transactions"
  on public.settlement_transactions for select to authenticated
  using ((select private.can_read_settlement_transaction(id)));

grant usage on schema public to authenticated;
grant select, update on public.users to authenticated;
grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select on public.expenses to authenticated;
grant select on public.expense_splits to authenticated;
grant select, insert, update, delete on public.chore_templates to authenticated;
grant select, insert, update, delete on public.chore_logs to authenticated;
grant select on public.settlements to authenticated;
grant select on public.settlement_transactions to authenticated;

-- Postgres Changes is enough for the small MVP household graph; move to Broadcast before high-volume scale.
alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.expense_splits;
alter publication supabase_realtime add table public.chore_templates;
alter publication supabase_realtime add table public.chore_logs;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.settlement_transactions;
