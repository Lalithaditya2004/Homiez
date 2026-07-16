alter table public.chore_templates
  add column frequency_interval integer,
  add column frequency_unit text,
  add column rotation_enabled boolean not null default false,
  add column is_ad_hoc boolean not null default false;

alter table public.chore_templates
  add constraint chore_templates_frequency_check check (
    (frequency_interval is null and frequency_unit is null)
    or (frequency_interval > 0 and frequency_unit in ('day', 'week', 'month'))
  ),
  add constraint chore_templates_rotation_check check (
    not rotation_enabled or frequency_interval is not null
  );

alter table public.chore_logs drop constraint chore_logs_status_check;
alter table public.chore_logs drop constraint chore_logs_check;

alter table public.chore_logs
  add column completion_type text,
  add column available_at timestamptz,
  add column snoozed_until timestamptz,
  add column recurrence_of_id uuid references public.chore_logs(id) on delete cascade;

update public.chore_logs
set status = case when status = 'pending' then 'active' else status end,
    completion_type = case when status = 'completed' then 'completed' else null end;

update public.chore_logs as chore_log
set due_date = null
where exists (
  select 1
  from public.chore_templates as template
  where template.id = chore_log.chore_template_id
    and template.frequency_interval is not null
);

alter table public.chore_logs alter column status set default 'active';

alter table public.chore_logs
  add constraint chore_logs_status_check check (status in ('active', 'inactive', 'completed')),
  add constraint chore_logs_completion_type_check check (completion_type in ('completed', 'skipped', 'ad-hoc')),
  add constraint chore_logs_lifecycle_check check (
    (
      status in ('active', 'inactive')
      and completed_by is null
      and completed_at is null
      and completion_type is null
    )
    or (
      status = 'completed'
      and completed_at is not null
      and completion_type is not null
      and (
        (completion_type in ('completed', 'ad-hoc') and completed_by is not null)
        or (completion_type = 'skipped' and completed_by is null)
      )
    )
  ),
  add constraint chore_logs_inactive_availability_check check (
    status <> 'inactive' or available_at is not null
  );

create index chore_logs_inactive_available_idx
  on public.chore_logs(available_at)
  where status = 'inactive' and deleted_at is null;

create index chore_logs_recurrence_idx
  on public.chore_logs(recurrence_of_id)
  where recurrence_of_id is not null;

create or replace function private.chore_next_at(
  p_from timestamptz,
  p_interval integer,
  p_unit text
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_unit
    when 'day' then p_from + make_interval(days => p_interval)
    when 'week' then p_from + make_interval(days => p_interval * 7)
    when 'month' then p_from + make_interval(months => p_interval)
  end;
$$;

create or replace function public.complete_chore(p_log_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_template record;
  v_assigned_to uuid;
  v_next_assignee uuid;
  v_available_at timestamptz;
begin
  if not (select private.can_edit_chore_log(p_log_id)) then
    raise exception 'You cannot edit this chore.';
  end if;

  select template.*, chore_log.assigned_to
    into v_template
    from public.chore_logs as chore_log
    join public.chore_templates as template on template.id = chore_log.chore_template_id
   where chore_log.id = p_log_id
     and chore_log.deleted_at is null
     and (
       chore_log.status = 'active'
       or (chore_log.status = 'inactive' and chore_log.available_at <= v_now)
     );

  if not found then raise exception 'This chore is not active.'; end if;
  v_assigned_to := v_template.assigned_to;

  update public.chore_logs
     set status = 'completed',
         completed_by = (select auth.uid()),
         completed_at = v_now,
         completion_type = 'completed',
         available_at = null,
         snoozed_until = null
   where id = p_log_id;

  if v_template.frequency_interval is not null then
    v_available_at := private.chore_next_at(v_now, v_template.frequency_interval, v_template.frequency_unit);
    v_next_assignee := v_assigned_to;

    if v_template.rotation_enabled and v_assigned_to is not null then
      select coalesce(member_order.next_user_id, member_order.first_user_id)
        into v_next_assignee
        from (
          select household_member.user_id,
                 lead(household_member.user_id) over (order by household_member.created_at, household_member.user_id) as next_user_id,
                 first_value(household_member.user_id) over (order by household_member.created_at, household_member.user_id) as first_user_id
            from public.household_members as household_member
           where household_member.household_id = v_template.household_id
             and household_member.status = 'active'
        ) as member_order
       where member_order.user_id = v_assigned_to;
    end if;

    insert into public.chore_logs (
      chore_template_id, assigned_to, status, available_at, recurrence_of_id
    ) values (
      v_template.id, v_next_assignee, 'inactive', v_available_at, p_log_id
    );
  end if;
end;
$$;

create or replace function public.skip_chore(p_log_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_template record;
  v_available_at timestamptz;
begin
  if not (select private.can_edit_chore_log(p_log_id)) then
    raise exception 'You cannot edit this chore.';
  end if;

  select template.*
    into v_template
    from public.chore_logs as chore_log
    join public.chore_templates as template on template.id = chore_log.chore_template_id
   where chore_log.id = p_log_id
     and chore_log.deleted_at is null
     and chore_log.status in ('active', 'inactive');

  if not found then raise exception 'This chore cannot be skipped.'; end if;

  if v_template.frequency_interval is null then
    update public.chore_logs
       set status = 'completed',
           completed_by = null,
           completed_at = v_now,
           completion_type = 'skipped',
           available_at = null,
           snoozed_until = null
     where id = p_log_id;
  else
    v_available_at := private.chore_next_at(v_now, v_template.frequency_interval, v_template.frequency_unit);
    update public.chore_logs
       set status = 'inactive',
           due_date = null,
           available_at = v_available_at,
           snoozed_until = null
     where id = p_log_id;
  end if;
end;
$$;

create or replace function public.snooze_chore(p_log_id uuid, p_available_at timestamptz)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_available_at <= now() then raise exception 'Snooze must end in the future.'; end if;
  if not (select private.can_edit_chore_log(p_log_id)) then raise exception 'You cannot edit this chore.'; end if;

  update public.chore_logs as chore_log
     set status = 'inactive',
         due_date = case when exists (
           select 1
           from public.chore_templates as template
           where template.id = chore_log.chore_template_id
             and template.frequency_interval is not null
         ) then null else p_available_at end,
         available_at = p_available_at,
         snoozed_until = p_available_at
   where chore_log.id = p_log_id
     and chore_log.status in ('active', 'inactive')
     and chore_log.deleted_at is null;

  if not found then raise exception 'This chore cannot be snoozed.'; end if;
end;
$$;

create or replace function public.undo_chore(p_log_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.can_edit_chore_log(p_log_id)) then raise exception 'You cannot edit this chore.'; end if;

  delete from public.chore_logs where recurrence_of_id = p_log_id;
  update public.chore_logs
     set status = 'active',
         completed_by = null,
         completed_at = null,
         completion_type = null,
         available_at = null,
         snoozed_until = null
   where id = p_log_id
     and status = 'completed'
     and completed_at >= now() - interval '24 hours'
     and deleted_at is null;

  if not found then raise exception 'This completion can no longer be undone.'; end if;
end;
$$;

create or replace function public.log_ad_hoc_chore(p_household_id uuid, p_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template_id uuid;
begin
  if not (select private.is_active_household_member(p_household_id)) then
    raise exception 'You cannot add chores to this household.';
  end if;
  if char_length(trim(p_name)) not between 1 and 120 then raise exception 'Give this chore a clear name.'; end if;

  insert into public.chore_templates (household_id, name, is_ad_hoc)
  values (p_household_id, trim(p_name), true)
  returning id into v_template_id;

  insert into public.chore_logs (chore_template_id, completed_by, status, completion_type, completed_at)
  values (v_template_id, (select auth.uid()), 'completed', 'ad-hoc', now());
end;
$$;

revoke all on function private.chore_next_at(timestamptz, integer, text) from public;
revoke all on function public.complete_chore(uuid) from public;
revoke all on function public.skip_chore(uuid) from public;
revoke all on function public.snooze_chore(uuid, timestamptz) from public;
revoke all on function public.undo_chore(uuid) from public;
revoke all on function public.log_ad_hoc_chore(uuid, text) from public;

grant execute on function private.chore_next_at(timestamptz, integer, text) to authenticated;
grant execute on function public.complete_chore(uuid) to authenticated;
grant execute on function public.skip_chore(uuid) to authenticated;
grant execute on function public.snooze_chore(uuid, timestamptz) to authenticated;
grant execute on function public.undo_chore(uuid) to authenticated;
grant execute on function public.log_ad_hoc_chore(uuid, text) to authenticated;
