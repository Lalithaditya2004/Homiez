import { describe, expect, test } from 'bun:test';

import { createDebtDetoxPreview } from '@/lib/debt-detox';
import type { Expense, HouseholdMember } from '@/lib/types';

describe('Debt Detox', () => {
  test('collapses A → B → C into one direct A → C settlement', () => {
    const members = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ] as HouseholdMember[];
    const expenses = [
      { id: 'one', paidBy: 'b', amountCents: 1_000, splits: [{ memberId: 'a', owedCents: 1_000 }] },
      { id: 'two', paidBy: 'c', amountCents: 1_000, splits: [{ memberId: 'b', owedCents: 1_000 }] },
    ] as Expense[];

    const result = createDebtDetoxPreview(expenses, members);

    expect(result.transactions).toEqual([
      { fromId: 'a', fromName: 'A', toId: 'c', toName: 'C', amountCents: 1_000 },
    ]);
    expect(result.balances.reduce((sum, balance) => sum + balance.cents, 0)).toBe(0);
    expect(result.mathSteps.at(-1)).toContain('1 direct payment');
  });
});
