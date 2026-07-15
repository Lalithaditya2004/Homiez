import type { ExpenseDraft, HouseholdData } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type MembershipRow = {
  household_id: string;
  user_id: string;
  status: 'active' | 'archived';
  moved_out_by: string | null;
  moved_out_at: string | null;
};

type UserRow = { id: string; email: string; display_name: string };
type ExpenseRow = { id: string; household_id: string; paid_by: string; amount: number; description: string; created_at: string };
type SplitRow = { expense_id: string; user_id: string; owed_amount: number };
type TemplateRow = { id: string; household_id: string; name: string; is_deleted: boolean; deleted_at: string | null; created_at: string };
type ChoreLogRow = {
  id: string;
  chore_template_id: string;
  assigned_to: string | null;
  completed_by: string | null;
  due_date: string | null;
  status: 'pending' | 'completed';
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
};
type SettlementRow = { id: string; accepted_at: string };
type SettlementTransactionRow = {
  id: string;
  settlement_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  status: 'pending' | 'confirmed';
  confirmed_by: string | null;
  confirmed_at: string | null;
};

function clientOrThrow() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function loadCurrentCloudHousehold(): Promise<HouseholdData | null> {
  const client = clientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const currentUser = userData.user;
  if (!currentUser) return null;

  const { data: activeMembershipData, error: activeMembershipError } = await client
    .from('household_members')
    .select('household_id')
    .eq('user_id', currentUser.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  throwIfError(activeMembershipError);
  const activeMembership = activeMembershipData as { household_id: string } | null;
  if (!activeMembership) return null;

  return loadCloudHousehold(activeMembership.household_id, currentUser.id);
}

export async function loadCloudHousehold(householdId: string, currentUserId: string): Promise<HouseholdData> {
  const client = clientOrThrow();
  const [{ data: householdData, error: householdError }, { data: membershipsData, error: membershipsError }] = await Promise.all([
    client.from('households').select('id, name, join_code').eq('id', householdId).single(),
    client.from('household_members').select('household_id, user_id, status, moved_out_by, moved_out_at').eq('household_id', householdId),
  ]);
  throwIfError(householdError);
  throwIfError(membershipsError);

  const household = householdData as { id: string; name: string; join_code: string };
  const memberships = (membershipsData ?? []) as MembershipRow[];
  const memberIds = memberships.map((membership) => membership.user_id);
  const { data: profilesData, error: profilesError } = await client
    .from('users')
    .select('id, email, display_name')
    .in('id', memberIds);
  throwIfError(profilesError);
  const profiles = new Map(((profilesData ?? []) as UserRow[]).map((profile) => [profile.id, profile]));

  const { data: expensesData, error: expensesError } = await client
    .from('expenses')
    .select('id, household_id, paid_by, amount, description, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  throwIfError(expensesError);
  const expenses = (expensesData ?? []) as ExpenseRow[];
  const expenseIds = expenses.map((expense) => expense.id);
  const { data: splitsData, error: splitsError } = expenseIds.length
    ? await client.from('expense_splits').select('expense_id, user_id, owed_amount').in('expense_id', expenseIds)
    : { data: [], error: null };
  throwIfError(splitsError);
  const splits = (splitsData ?? []) as SplitRow[];

  const { data: templatesData, error: templatesError } = await client
    .from('chore_templates')
    .select('id, household_id, name, is_deleted, deleted_at, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  throwIfError(templatesError);
  const templates = (templatesData ?? []) as TemplateRow[];
  const templateIds = templates.map((template) => template.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: logsData, error: logsError } = templateIds.length
    ? await client
        .from('chore_logs')
        .select('id, chore_template_id, assigned_to, completed_by, due_date, status, completed_at, deleted_at, created_at')
        .in('chore_template_id', templateIds)
        .gte('created_at', thirtyDaysAgo)
    : { data: [], error: null };
  throwIfError(logsError);
  const logs = (logsData ?? []) as ChoreLogRow[];

  const { data: settlementData, error: settlementError } = await client
    .from('settlements')
    .select('id, accepted_at')
    .eq('household_id', householdId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(settlementError);
  const settlement = settlementData as SettlementRow | null;
  const { data: settlementTransactionsData, error: settlementTransactionsError } = settlement
    ? await client
        .from('settlement_transactions')
        .select('id, settlement_id, from_user_id, to_user_id, amount, status, confirmed_by, confirmed_at')
        .eq('settlement_id', settlement.id)
    : { data: [], error: null };
  throwIfError(settlementTransactionsError);
  const settlementTransactions = (settlementTransactionsData ?? []) as SettlementTransactionRow[];

  return {
    id: household.id,
    name: household.name,
    joinCode: household.join_code,
    currentUserId,
    members: memberships.map((membership) => {
      const profile = profiles.get(membership.user_id);
      return {
        id: membership.user_id,
        name: profile?.display_name ?? 'Roommate',
        email: profile?.email ?? '',
        status: membership.status,
        movedOutBy: membership.moved_out_by ?? undefined,
        movedOutAt: membership.moved_out_at ?? undefined,
      };
    }),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amountCents: expense.amount,
      paidBy: expense.paid_by,
      splitMethod: 'custom',
      splits: splits.filter((split) => split.expense_id === expense.id).map((split) => ({ memberId: split.user_id, owedCents: split.owed_amount })),
      createdAt: expense.created_at,
    })),
    choreTemplates: templates.map((template) => ({
      id: template.id,
      householdId: template.household_id,
      name: template.name,
      isDeleted: template.is_deleted,
      deletedAt: template.deleted_at ?? undefined,
      createdAt: template.created_at,
    })),
    choreLogs: logs.map((log) => ({
      id: log.id,
      choreTemplateId: log.chore_template_id,
      assignedTo: log.assigned_to ?? undefined,
      completedBy: log.completed_by ?? undefined,
      dueDate: log.due_date ?? undefined,
      status: log.status,
      completedAt: log.completed_at ?? undefined,
      deletedAt: log.deleted_at ?? undefined,
      createdAt: log.created_at,
    })),
    settlement: settlement
      ? {
          id: settlement.id,
          acceptedAt: settlement.accepted_at,
          transactions: settlementTransactions.map((transaction) => ({
            id: transaction.id,
            fromId: transaction.from_user_id,
            toId: transaction.to_user_id,
            amountCents: transaction.amount,
            status: transaction.status,
            confirmedBy: transaction.confirmed_by ?? undefined,
            confirmedAt: transaction.confirmed_at ?? undefined,
          })),
        }
      : undefined,
  };
}

export async function createCloudHousehold(name: string): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client.rpc('create_household', { p_name: name });
  throwIfError(error);
}

export async function joinCloudHousehold(joinCode: string): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client.rpc('join_household', { p_join_code: joinCode });
  throwIfError(error);
}

export async function createCloudExpense(householdId: string, draft: ExpenseDraft): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client.rpc('create_expense', {
    p_household_id: householdId,
    p_paid_by: draft.paidBy,
    p_amount: draft.amountCents,
    p_description: draft.description.trim(),
    p_splits: draft.splits.map((split) => ({ user_id: split.memberId, owed_amount: split.owedCents })),
  });
  throwIfError(error);
}

export async function createCloudChore(householdId: string, name: string, assigneeId?: string, dueDate?: string): Promise<void> {
  const client = clientOrThrow();
  const { data: templateData, error: templateError } = await client
    .from('chore_templates')
    .insert({ household_id: householdId, name: name.trim() })
    .select('id')
    .single();
  throwIfError(templateError);
  const template = templateData as { id: string };
  const { error: logError } = await client
    .from('chore_logs')
    .insert({ chore_template_id: template.id, assigned_to: assigneeId ?? null, due_date: dueDate ?? null });
  throwIfError(logError);
}

export async function scheduleCloudChore(templateId: string, assigneeId?: string, dueDate?: string): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client
    .from('chore_logs')
    .insert({ chore_template_id: templateId, assigned_to: assigneeId ?? null, due_date: dueDate ?? null });
  throwIfError(error);
}

export async function completeCloudChore(logId: string, userId: string): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client
    .from('chore_logs')
    .update({ status: 'completed', completed_by: userId, completed_at: new Date().toISOString() })
    .eq('id', logId);
  throwIfError(error);
}

export async function deleteCloudChoreTemplate(templateId: string): Promise<void> {
  const client = clientOrThrow();
  const deletedAt = new Date().toISOString();
  const { error: templateError } = await client
    .from('chore_templates')
    .update({ is_deleted: true, deleted_at: deletedAt })
    .eq('id', templateId);
  throwIfError(templateError);
  const { error: logError } = await client
    .from('chore_logs')
    .update({ deleted_at: deletedAt })
    .eq('chore_template_id', templateId);
  throwIfError(logError);
}

export async function moveOutCloudMember(householdId: string, memberId: string): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client.rpc('move_out_member', { p_household_id: householdId, p_user_id: memberId });
  throwIfError(error);
}

export async function acceptCloudSettlement(
  householdId: string,
  transactions: { fromId: string; toId: string; amountCents: number }[],
): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client.rpc('accept_settlement', {
    p_household_id: householdId,
    p_transactions: transactions.map((transaction) => ({
      from_user_id: transaction.fromId,
      to_user_id: transaction.toId,
      amount: transaction.amountCents,
    })),
  });
  throwIfError(error);
}

export async function confirmCloudSettlementPayment(transactionId: string): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client.rpc('confirm_settlement_transaction', { p_transaction_id: transactionId });
  throwIfError(error);
}

export async function reclaimCloudMember(householdId: string, memberId: string): Promise<void> {
  const client = clientOrThrow();
  const { error } = await client.rpc('reclaim_member', { p_household_id: householdId, p_user_id: memberId });
  throwIfError(error);
}
