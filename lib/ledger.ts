import type { Expense, HouseholdData, PeerBalance, SettlementRequest } from '@/lib/types';

export type PeerBreakdown = {
  peerId: string;
  peerName: string;
  direction: 'owing' | 'owed' | 'square';
  amountCents: number;
};

export type ExpenseParticipantAudit = {
  memberId: string;
  name: string;
  amountCents: number;
  status: 'paid' | 'pending';
};

export type ExpenseAudit = {
  expense: Expense;
  participants: ExpenseParticipantAudit[];
  completed: boolean;
  completedAt?: string;
};

function orderedPair(firstId: string, secondId: string) {
  return firstId < secondId
    ? { userLowId: firstId, userHighId: secondId, direction: 1 }
    : { userLowId: secondId, userHighId: firstId, direction: -1 };
}

export function applyPeerBalanceDelta(records: PeerBalance[], debtorId: string, creditorId: string, amountCents: number): PeerBalance[] {
  if (debtorId === creditorId || amountCents === 0) return records;
  const pair = orderedPair(debtorId, creditorId);
  const delta = amountCents * pair.direction;
  const found = records.find((record) => record.userLowId === pair.userLowId && record.userHighId === pair.userHighId);
  if (!found) return [...records, { userLowId: pair.userLowId, userHighId: pair.userHighId, balanceCents: delta }];
  return records.map((record) => record === found ? { ...record, balanceCents: record.balanceCents + delta } : record);
}

export function buildPeerBalances(expenses: Expense[], acceptedRequests: SettlementRequest[] = []): PeerBalance[] {
  let records: PeerBalance[] = [];
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.memberId !== expense.paidBy && split.owedCents > 0) {
        records = applyPeerBalanceDelta(records, split.memberId, expense.paidBy, split.owedCents);
      }
    }
  }
  for (const request of acceptedRequests) {
    if (request.status === 'accepted') records = applyPeerBalanceDelta(records, request.fromId, request.toId, -request.amountCents);
  }
  return records.filter((record) => record.balanceCents !== 0);
}

export function reconcileOpposingExpenseSplits(expenses: Expense[]): Expense[] {
  const next = expenses.map((expense) => ({ ...expense, splits: expense.splits.map((split) => ({ ...split, settledCents: split.settledCents ?? 0 })) }));
  const pairs = new Map<string, { lowToHigh: { split: Expense['splits'][number]; createdAt: string }[]; highToLow: { split: Expense['splits'][number]; createdAt: string }[] }>();
  for (const expense of next) {
    for (const split of expense.splits) {
      if (split.memberId === expense.paidBy) continue;
      const pair = orderedPair(split.memberId, expense.paidBy);
      const key = `${pair.userLowId}|${pair.userHighId}`;
      const bucket = pairs.get(key) ?? { lowToHigh: [], highToLow: [] };
      const obligation = { split, createdAt: expense.createdAt };
      if (split.memberId === pair.userLowId) bucket.lowToHigh.push(obligation);
      else bucket.highToLow.push(obligation);
      pairs.set(key, bucket);
    }
  }
  for (const bucket of pairs.values()) {
    bucket.lowToHigh.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    bucket.highToLow.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let lowIndex = 0;
    let highIndex = 0;
    while (lowIndex < bucket.lowToHigh.length && highIndex < bucket.highToLow.length) {
      const low = bucket.lowToHigh[lowIndex].split;
      const high = bucket.highToLow[highIndex].split;
      const lowRemaining = low.owedCents - (low.settledCents ?? 0);
      const highRemaining = high.owedCents - (high.settledCents ?? 0);
      const offset = Math.min(lowRemaining, highRemaining);
      low.settledCents = (low.settledCents ?? 0) + offset;
      high.settledCents = (high.settledCents ?? 0) + offset;
      if (low.settledCents >= low.owedCents) lowIndex += 1;
      if (high.settledCents >= high.owedCents) highIndex += 1;
    }
  }
  return next;
}

export function applySettlementToExpenseSplits(expenses: Expense[], fromId: string, toId: string, amountCents: number): Expense[] {
  let remaining = amountCents;
  return [...expenses]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((expense) => ({
      ...expense,
      splits: expense.splits.map((split) => {
        if (remaining <= 0 || expense.paidBy !== toId || split.memberId !== fromId) return split;
        const available = Math.max(0, split.owedCents - (split.settledCents ?? 0));
        const applied = Math.min(available, remaining);
        remaining -= applied;
        return { ...split, settledCents: (split.settledCents ?? 0) + applied };
      }),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function debtBetween(records: PeerBalance[], debtorId: string, creditorId: string): number {
  if (debtorId === creditorId) return 0;
  const pair = orderedPair(debtorId, creditorId);
  const record = records.find((item) => item.userLowId === pair.userLowId && item.userHighId === pair.userHighId);
  if (!record) return 0;
  return Math.max(0, record.balanceCents * pair.direction);
}

export function memberHasOpenBalance(records: PeerBalance[], memberId: string): boolean {
  return records.some((record) =>
    record.balanceCents !== 0
    && (record.userLowId === memberId || record.userHighId === memberId),
  );
}

export function getMemberBalanceSummary(records: PeerBalance[], memberId: string) {
  return records.reduce(
    (summary, record) => {
      if (record.balanceCents === 0 || (record.userLowId !== memberId && record.userHighId !== memberId)) return summary;
      const memberIsLow = record.userLowId === memberId;
      const memberOwes = memberIsLow ? record.balanceCents > 0 : record.balanceCents < 0;
      if (memberOwes) summary.owingCents += Math.abs(record.balanceCents);
      else summary.owedCents += Math.abs(record.balanceCents);
      return summary;
    },
    { owingCents: 0, owedCents: 0 },
  );
}

export function householdDeletionBlockReason(data: HouseholdData): string | undefined {
  const activeCount = data.members.filter((member) => member.status === 'active').length;
  if (activeCount !== 1) return 'Every other roommate must move out before this household can be deleted.';
  if (data.peerBalances.some((record) => record.balanceCents !== 0)) {
    return 'Resolve every balance before deleting this household.';
  }
  if (data.settlementRequests.some((request) => request.status === 'in-review')) {
    return 'Resolve pending settlement requests before deleting this household.';
  }
  return undefined;
}

function pendingAdjustment(request: SettlementRequest, mode: 'dashboard' | 'actionable') {
  if (request.status !== 'in-review') return 0;
  if (mode === 'actionable') return request.amountCents;
  return request.amountCents < request.originalDebtCents ? request.amountCents : 0;
}

export function getPeerBreakdownForMember(data: HouseholdData, memberId: string, mode: 'dashboard' | 'actionable' = 'dashboard'): PeerBreakdown[] {
  let records = data.peerBalances.length
    ? data.peerBalances
    : buildPeerBalances(data.expenses, data.settlementRequests);

  for (const request of data.settlementRequests) {
    const adjustment = pendingAdjustment(request, mode);
    if (adjustment) records = applyPeerBalanceDelta(records, request.fromId, request.toId, -adjustment);
  }

  return data.members
    .filter((member) => member.status === 'active' && member.id !== memberId)
    .map((member) => {
      const owing = debtBetween(records, memberId, member.id);
      const owed = debtBetween(records, member.id, memberId);
      return {
        peerId: member.id,
        peerName: member.name,
        direction: owing > 0 ? 'owing' as const : owed > 0 ? 'owed' as const : 'square' as const,
        amountCents: Math.max(owing, owed),
      };
    });
}

export function getPeerBreakdown(data: HouseholdData, mode: 'dashboard' | 'actionable' = 'dashboard'): PeerBreakdown[] {
  return getPeerBreakdownForMember(data, data.currentUserId, mode);
}

export function getGlobalNets(data: HouseholdData) {
  return getPeerBreakdown(data).reduce(
    (totals, peer) => ({
      totalIOweCents: totals.totalIOweCents + (peer.direction === 'owing' ? peer.amountCents : 0),
      totalIAmOwedCents: totals.totalIAmOwedCents + (peer.direction === 'owed' ? peer.amountCents : 0),
    }),
    { totalIOweCents: 0, totalIAmOwedCents: 0 },
  );
}

export function getExpenseAudits(data: HouseholdData): ExpenseAudit[] {
  return [...data.expenses]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((expense) => {
      const participants = expense.splits.map((split) => {
        const member = data.members.find((candidate) => candidate.id === split.memberId);
        const paid = split.memberId === expense.paidBy || (split.settledCents !== undefined
          ? split.settledCents >= split.owedCents
          : debtBetween(data.peerBalances, split.memberId, expense.paidBy) === 0);
        return {
          memberId: split.memberId,
          name: member?.name ?? 'Roommate',
          amountCents: split.owedCents,
          status: paid ? 'paid' as const : 'pending' as const,
        };
      });
      const completed = Boolean(expense.settledAt) || participants.every((participant) => participant.status === 'paid');
      const relatedAccepted = data.settlementRequests
        .filter((request) => request.status === 'accepted'
          && ((request.fromId === expense.paidBy && expense.splits.some((split) => split.memberId === request.toId))
            || (request.toId === expense.paidBy && expense.splits.some((split) => split.memberId === request.fromId))))
        .sort((a, b) => new Date(b.resolvedAt ?? b.createdAt).getTime() - new Date(a.resolvedAt ?? a.createdAt).getTime())[0];
      return { expense, participants, completed, completedAt: expense.settledAt ?? relatedAccepted?.resolvedAt };
    });
}
