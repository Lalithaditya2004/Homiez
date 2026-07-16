import { describe, expect, test } from 'bun:test';

import { applyPeerBalanceDelta, applySettlementToExpenseSplits, debtBetween, getPeerBreakdown, getPeerBreakdownForMember, reconcileOpposingExpenseSplits } from '@/lib/ledger';
import type { HouseholdData } from '@/lib/types';

const baseData = {
  id: 'house', name: 'House', joinCode: 'HOUSE', currency: 'INR', currentUserId: 'a',
  members: [
    { id: 'a', name: 'A', email: 'a@x.test', status: 'active' },
    { id: 'b', name: 'B', email: 'b@x.test', status: 'active' },
    { id: 'c', name: 'C', email: 'c@x.test', status: 'active' },
  ],
  expenses: [], choreTemplates: [], choreLogs: [], peerBalances: [], settlementRequests: [],
} as HouseholdData;

describe('peer ledger', () => {
  test('aggregates a running tab into one peer balance', () => {
    let balances = applyPeerBalanceDelta([], 'b', 'a', 30000);
    balances = applyPeerBalanceDelta(balances, 'b', 'a', 20000);
    expect(debtBetween(balances, 'b', 'a')).toBe(50000);
  });

  test('isolates one-on-one balances without other roommates', () => {
    let peerBalances = applyPeerBalanceDelta([], 'a', 'b', 25000);
    peerBalances = applyPeerBalanceDelta(peerBalances, 'c', 'a', 90000);
    const peers = getPeerBreakdown({ ...baseData, peerBalances });
    expect(peers.find((peer) => peer.peerId === 'b')).toMatchObject({ direction: 'owing', amountCents: 25000 });
    expect(peers.find((peer) => peer.peerId === 'c')).toMatchObject({ direction: 'owed', amountCents: 90000 });
  });

  test('switches the full owing and owed viewpoint to a selected roommate', () => {
    let peerBalances = applyPeerBalanceDelta([], 'a', 'b', 25000);
    peerBalances = applyPeerBalanceDelta(peerBalances, 'c', 'b', 90000);
    const mayaPerspective = getPeerBreakdownForMember({ ...baseData, peerBalances }, 'b');
    expect(mayaPerspective.filter((peer) => peer.direction === 'owing')).toHaveLength(0);
    expect(mayaPerspective.filter((peer) => peer.direction === 'owed').map((peer) => peer.peerId).sort()).toEqual(['a', 'c']);
  });

  test('reserves partial requests on dashboards while full requests remain locked', () => {
    const peerBalances = applyPeerBalanceDelta([], 'a', 'b', 100000);
    const partial = getPeerBreakdown({ ...baseData, peerBalances, settlementRequests: [{ id: 'p', fromId: 'a', toId: 'b', amountCents: 60000, claimedAmountCents: 60000, originalDebtCents: 100000, status: 'in-review', createdAt: new Date().toISOString() }] });
    expect(partial.find((peer) => peer.peerId === 'b')?.amountCents).toBe(40000);
    const full = getPeerBreakdown({ ...baseData, peerBalances, settlementRequests: [{ id: 'f', fromId: 'a', toId: 'b', amountCents: 100000, claimedAmountCents: 100000, originalDebtCents: 100000, status: 'in-review', createdAt: new Date().toISOString() }] });
    expect(full.find((peer) => peer.peerId === 'b')?.amountCents).toBe(100000);
  });

  test('allocates accepted payments to granular expense shares in FIFO order', () => {
    const expenses = [
      { id: 'old', description: 'Old', amountCents: 30000, currency: 'INR', paidBy: 'b', splitMethod: 'custom', splits: [{ memberId: 'a', owedCents: 30000 }], createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'new', description: 'New', amountCents: 20000, currency: 'INR', paidBy: 'b', splitMethod: 'custom', splits: [{ memberId: 'a', owedCents: 20000 }], createdAt: '2026-01-02T00:00:00.000Z' },
    ] as HouseholdData['expenses'];
    const allocated = applySettlementToExpenseSplits(expenses, 'a', 'b', 40000);
    expect(allocated.find((expense) => expense.id === 'old')?.splits[0].settledCents).toBe(30000);
    expect(allocated.find((expense) => expense.id === 'new')?.splits[0].settledCents).toBe(10000);
  });

  test('nets opposing expense shares before asking either roommate to pay', () => {
    const expenses = [
      { id: 'a-owes', description: 'A owes', amountCents: 30000, currency: 'INR', paidBy: 'b', splitMethod: 'custom', splits: [{ memberId: 'a', owedCents: 30000 }], createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b-owes', description: 'B owes', amountCents: 20000, currency: 'INR', paidBy: 'a', splitMethod: 'custom', splits: [{ memberId: 'b', owedCents: 20000 }], createdAt: '2026-01-02T00:00:00.000Z' },
    ] as HouseholdData['expenses'];
    const reconciled = reconcileOpposingExpenseSplits(expenses);
    expect(reconciled.find((expense) => expense.id === 'a-owes')?.splits[0].settledCents).toBe(20000);
    expect(reconciled.find((expense) => expense.id === 'b-owes')?.splits[0].settledCents).toBe(20000);
  });
});
