import { supabase } from '@/lib/supabase';

/**
 * Subscribe once per open household. Refetch the household snapshot in `onChange`;
 * Postgres Changes is intentionally client-side for this MVP so Debt Detox remains local.
 */
export function subscribeToHouseholdChanges(householdId: string, onChange: () => void) {
  const client = supabase;
  if (!client) return () => undefined;

  const channel = client
    .channel(`homiez-household-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_templates', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_logs' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settlement_transactions' }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
