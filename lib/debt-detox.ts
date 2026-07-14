import { formatMoney } from '@/lib/money';
import type { Expense, HouseholdMember } from '@/lib/types';

export type MemberBalance = {
  memberId: string;
  name: string;
  cents: number;
  paidCents: number;
  shareCents: number;
};

export type DebtTransaction = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountCents: number;
};

export type DebtDetoxPreview = {
  balances: MemberBalance[];
  transactions: DebtTransaction[];
  mathSteps: string[];
};

export function getMemberBalances(expenses: Expense[], members: HouseholdMember[]): MemberBalance[] {
  const balances = new Map(
    members.map((member) => [member.id, { memberId: member.id, name: member.name, cents: 0, paidCents: 0, shareCents: 0 }]),
  );

  for (const expense of expenses) {
    const payer = balances.get(expense.paidBy);
    if (payer) {
      payer.cents += expense.amountCents;
      payer.paidCents += expense.amountCents;
    }

    for (const split of expense.splits) {
      const member = balances.get(split.memberId);
      if (member) {
        member.cents -= split.owedCents;
        member.shareCents += split.owedCents;
      }
    }
  }

  return [...balances.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
}

export function createDebtDetoxPreview(expenses: Expense[], members: HouseholdMember[]): DebtDetoxPreview {
  const balances = getMemberBalances(expenses, members);
  const debtors = balances
    .filter((member) => member.cents < 0)
    .map((member) => ({ ...member, cents: Math.abs(member.cents) }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
  const creditors = balances
    .filter((member) => member.cents > 0)
    .map((member) => ({ ...member }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));

  const transactions: DebtTransaction[] = [];
  const mathSteps = balances.map((balance) => {
    const direction = balance.cents > 0 ? 'is owed' : balance.cents < 0 ? 'owes' : 'is square';
    return `${balance.name} paid ${formatMoney(balance.paidCents)} and used ${formatMoney(balance.shareCents)}. Net: ${direction} ${formatMoney(Math.abs(balance.cents))}.`;
  });

  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.cents, creditor.cents);

    transactions.push({
      fromId: debtor.memberId,
      fromName: debtor.name,
      toId: creditor.memberId,
      toName: creditor.name,
      amountCents,
    });
    mathSteps.push(
      `Match ${debtor.name}'s ${formatMoney(amountCents)} debt with ${creditor.name}'s credit. This replaces overlapping IOUs with one direct payment.`,
    );

    debtor.cents -= amountCents;
    creditor.cents -= amountCents;
    if (debtor.cents === 0) debtorIndex += 1;
    if (creditor.cents === 0) creditorIndex += 1;
  }

  if (transactions.length === 0) {
    mathSteps.push('Every roommate is already square. No settlement is needed.');
  } else {
    mathSteps.push(`Result: ${transactions.length} direct ${transactions.length === 1 ? 'payment' : 'payments'} settles every net balance.`);
  }

  return { balances, transactions, mathSteps };
}
