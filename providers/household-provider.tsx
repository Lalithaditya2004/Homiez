import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { addChoreDuration } from '@/lib/chores';
import { demoHousehold } from '@/lib/demo-data';
import { applyPeerBalanceDelta, applySettlementToExpenseSplits, buildPeerBalances, getMemberBalanceSummary, getPeerBreakdown, householdDeletionBlockReason, memberHasOpenBalance, reconcileOpposingExpenseSplits } from '@/lib/ledger';
import {
  completeCloudChore,
  createCloudChore,
  createCloudExpense,
  createCloudHousehold,
  deleteCloudHousehold,
  deleteCloudChoreTemplate,
  joinCloudHousehold,
  leaveCloudHousehold,
  loadCurrentCloudHousehold,
  logCloudAdHocChore,
  moveOutCloudMember,
  reclaimCloudMember,
  requestCloudSettlement,
  resolveCloudSettlement,
  scheduleCloudChore,
  settleAllCloudReceivables,
  settleCloudReceivable,
  skipCloudChore,
  snoozeCloudChore,
  undoCloudChore,
  updateCloudChore,
} from '@/lib/household-repository';
import { subscribeToHouseholdChanges } from '@/lib/household-realtime';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import type { ChoreFrequencyUnit, ChoreLog, ExpenseDraft, HouseholdData } from '@/lib/types';

const STORAGE_KEY = 'homiez-household-v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type CreateChoreInput = {
  name: string;
  assigneeId?: string;
  dueDate?: string;
  frequencyInterval?: number;
  frequencyUnit?: ChoreFrequencyUnit;
  rotationEnabled: boolean;
};

type UpdateChoreInput = CreateChoreInput & { templateId: string; logId: string };

export type CloudState = 'demo' | 'loading' | 'signed-out' | 'needs-household' | 'synced' | 'error';

type HouseholdContextValue = {
  data: HouseholdData;
  isReady: boolean;
  cloudState: CloudState;
  cloudError?: string;
  isCloudBacked: boolean;
  activeMembers: HouseholdData['members'];
  archivedMembers: HouseholdData['members'];
  recentChoreLogs: ChoreLog[];
  addExpense: (expense: ExpenseDraft) => void;
  requestSettlement: (toId: string, amountCents: number) => boolean;
  resolveSettlement: (requestId: string, action: 'accept' | 'reject', acceptedAmountCents?: number) => boolean;
  settleReceivable: (debtorId: string, amountCents: number) => Promise<void>;
  settleAllReceivables: () => Promise<void>;
  createChore: (input: CreateChoreInput) => void;
  updateChore: (input: UpdateChoreInput) => void;
  scheduleChore: (templateId: string, assigneeId?: string, dueDate?: string) => void;
  completeChore: (logId: string) => void;
  skipChore: (logId: string) => void;
  snoozeChore: (logId: string, amount: number, unit: ChoreFrequencyUnit) => void;
  undoChore: (logId: string) => void;
  logAdHocChore: (name: string) => void;
  deleteChoreTemplate: (templateId: string) => void;
  moveOutMember: (memberId: string) => Promise<void>;
  leaveHousehold: (options?: { settleReceivables?: boolean }) => Promise<void>;
  deleteHousehold: () => Promise<void>;
  moveOutBlockReason: (memberId: string) => string | undefined;
  deleteHouseholdBlockReason?: string;
  reclaimMember: (memberId: string) => Promise<void>;
  createCloudHousehold: (name: string) => Promise<void>;
  joinCloudHousehold: (joinCode: string) => Promise<void>;
  refreshCloud: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function markFullySettledExpenses(expenses: HouseholdData['expenses'], settledAt: string): HouseholdData['expenses'] {
  return expenses.map((expense) => {
    if (expense.settledAt) return expense;
    const settled = expense.splits.every((split) => split.memberId === expense.paidBy || (split.settledCents ?? 0) >= split.owedCents);
    return settled ? { ...expense, settledAt } : expense;
  });
}

function normalizeHouseholdData(input: HouseholdData): HouseholdData {
  const now = Date.now();
  const currency = input.currency ?? input.expenses.find((expense) => expense.currency)?.currency;
  const settlementRequests = (input.settlementRequests ?? []).filter((request) =>
    request.status === 'in-review' || new Date(request.resolvedAt ?? request.createdAt).getTime() >= now - THIRTY_DAYS_MS,
  );
  const rawExpenses = input.expenses
    .filter((expense) => !expense.settledAt || new Date(expense.settledAt).getTime() >= now - THIRTY_DAYS_MS)
    .map((expense) => ({ ...expense, currency: expense.currency ?? currency ?? 'USD' as const }));
  const hasGranularSettlementState = rawExpenses.some((expense) => expense.splits.some((split) => split.settledCents !== undefined));
  let expenses = hasGranularSettlementState ? rawExpenses : reconcileOpposingExpenseSplits(rawExpenses);
  if (!hasGranularSettlementState) {
    for (const request of settlementRequests) {
      if (request.status === 'accepted') expenses = applySettlementToExpenseSplits(expenses, request.fromId, request.toId, request.amountCents);
    }
  }
  expenses = markFullySettledExpenses(expenses, new Date().toISOString());
  const peerBalances = Array.isArray(input.peerBalances)
    ? input.peerBalances
    : buildPeerBalances(expenses, settlementRequests);
  return {
    ...input,
    currency,
    expenses,
    peerBalances,
    settlementRequests,
    choreTemplates: input.choreTemplates.map((template) => {
      const hasOpenInstance = input.choreLogs.some((log) => log.choreTemplateId === template.id && !log.deletedAt && log.status !== 'completed');
      const latestCompletion = input.choreLogs
        .filter((log) => log.choreTemplateId === template.id && log.status === 'completed' && log.completedAt)
        .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0];
      const expiresAfterCompletion = !template.frequencyInterval && !hasOpenInstance && latestCompletion?.completedAt
        && now - new Date(latestCompletion.completedAt).getTime() >= ONE_DAY_MS;
      return {
        ...template,
        rotationEnabled: template.rotationEnabled ?? false,
        isAdHoc: template.isAdHoc ?? false,
        isDeleted: template.isDeleted || Boolean(expiresAfterCompletion),
        deletedAt: template.deletedAt ?? (expiresAfterCompletion
          ? new Date(new Date(latestCompletion.completedAt!).getTime() + ONE_DAY_MS).toISOString()
          : undefined),
      };
    }),
    choreLogs: input.choreLogs.map((log) => ({
      ...log,
      dueDate: input.choreTemplates.find((template) => template.id === log.choreTemplateId)?.frequencyInterval ? undefined : log.dueDate,
      status: (log.status as string) === 'pending'
        ? 'active'
        : log.status === 'inactive' && log.availableAt && new Date(log.availableAt).getTime() <= now
          ? 'active'
          : log.status,
      availableAt: log.status === 'inactive' && log.availableAt && new Date(log.availableAt).getTime() <= now ? undefined : log.availableAt,
      snoozedUntil: log.status === 'inactive' && log.availableAt && new Date(log.availableAt).getTime() <= now ? undefined : log.snoozedUntil,
    })),
  };
}

export function HouseholdProvider({ children }: React.PropsWithChildren) {
  const [data, setData] = useState<HouseholdData>(demoHousehold);
  const [isReady, setIsReady] = useState(false);
  const [cloudState, setCloudState] = useState<CloudState>(hasSupabaseConfig ? 'loading' : 'demo');
  const [cloudError, setCloudError] = useState<string>();

  useEffect(() => {
    async function restoreHousehold() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setData(normalizeHouseholdData(JSON.parse(saved) as HouseholdData));
      } catch {
        // A fresh, useful demo is safer than blocking the app on a local cache error.
      } finally {
        setIsReady(true);
      }
    }

    void restoreHousehold();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, isReady]);

  useEffect(() => {
    const promoteReadyChores = () => setData((current) => {
      const normalized = normalizeHouseholdData(current);
      const changed = normalized.choreLogs.some((log, index) => log.status !== current.choreLogs[index]?.status)
        || normalized.choreTemplates.some((template, index) => template.isDeleted !== current.choreTemplates[index]?.isDeleted);
      return changed ? normalized : current;
    });
    promoteReadyChores();
    const timer = setInterval(promoteReadyChores, 15_000);
    return () => clearInterval(timer);
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!supabase) {
      setCloudState('demo');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setCloudState('signed-out');
      return;
    }

    setCloudState('loading');
    setCloudError(undefined);
    try {
      const cloudHousehold = await loadCurrentCloudHousehold();
      if (!cloudHousehold) {
        setCloudState('needs-household');
        return;
      }
      setData(normalizeHouseholdData(cloudHousehold));
      setCloudState('synced');
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Could not load the shared household.');
      setCloudState('error');
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void refreshCloud();
      } else {
        setCloudState('signed-out');
      }
    });
    void refreshCloud();
    return () => subscription.subscription.unsubscribe();
  }, [refreshCloud]);

  useEffect(() => {
    if (cloudState !== 'synced') return;
    return subscribeToHouseholdChanges(data.id, () => void refreshCloud());
  }, [cloudState, data.id, refreshCloud]);

  const queueCloudMutation = useCallback((mutation: () => Promise<void>) => {
    if (cloudState !== 'synced') return;
    void mutation()
      .then(() => refreshCloud())
      .catch((error: unknown) => {
        setCloudError(error instanceof Error ? error.message : 'Could not sync this change.');
      });
  }, [cloudState, refreshCloud]);

  const createConfiguredHousehold = useCallback(async (name: string) => {
    setCloudState('loading');
    setCloudError(undefined);
    try {
      await createCloudHousehold(name);
      await refreshCloud();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create this household.';
      setCloudError(message);
      setCloudState('error');
      throw new Error(message);
    }
  }, [refreshCloud]);

  const joinConfiguredHousehold = useCallback(async (joinCode: string) => {
    setCloudState('loading');
    setCloudError(undefined);
    try {
      await joinCloudHousehold(joinCode);
      await refreshCloud();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not join this household.';
      setCloudError(message);
      setCloudState('error');
      throw new Error(message);
    }
  }, [refreshCloud]);

  const activeMembers = useMemo(() => data.members.filter((member) => member.status === 'active'), [data.members]);
  const archivedMembers = useMemo(() => data.members.filter((member) => member.status === 'archived'), [data.members]);
  const recentChoreLogs = useMemo(
    () => data.choreLogs.filter((log) => {
      if (log.status === 'active' || log.status === 'inactive') return !log.deletedAt;
      return new Date(log.completedAt ?? log.createdAt).getTime() >= Date.now() - THIRTY_DAYS_MS;
    }),
    [data.choreLogs],
  );

  const value = useMemo<HouseholdContextValue>(() => ({
    data,
    isReady,
    cloudState,
    cloudError,
    isCloudBacked: cloudState === 'synced',
    activeMembers,
    archivedMembers,
    recentChoreLogs,
    addExpense(expense) {
      if (expense.amountCents <= 0 || !expense.description.trim()) return;
      if (expense.splits.reduce((total, split) => total + split.owedCents, 0) !== expense.amountCents) return;
      setData((current) => {
        let peerBalances = current.peerBalances;
        for (const split of expense.splits) {
          if (split.memberId !== expense.paidBy) {
            peerBalances = applyPeerBalanceDelta(peerBalances, split.memberId, expense.paidBy, split.owedCents);
          }
        }
        return {
          ...current,
          currency: current.currency ?? expense.currency,
          peerBalances,
          expenses: markFullySettledExpenses(reconcileOpposingExpenseSplits([
          {
            ...expense,
            id: makeId('expense'),
            description: expense.description.trim(),
            createdAt: new Date().toISOString(),
          },
          ...current.expenses,
        ]), new Date().toISOString()),
        };
      });
      queueCloudMutation(() => createCloudExpense(data.id, expense));
    },
    requestSettlement(toId, amountCents) {
      const peer = getPeerBreakdown(data, 'actionable').find((item) => item.peerId === toId);
      if (!peer || peer.direction !== 'owing' || amountCents < 1 || amountCents > peer.amountCents) return false;
      const request = {
        id: makeId('settlement-request'),
        fromId: data.currentUserId,
        toId,
        amountCents,
        claimedAmountCents: amountCents,
        originalDebtCents: peer.amountCents,
        status: 'in-review' as const,
        createdAt: new Date().toISOString(),
      };
      setData((current) => ({
        ...current,
        settlementRequests: [request, ...current.settlementRequests],
      }));
      queueCloudMutation(() => requestCloudSettlement(data.id, toId, amountCents));
      return true;
    },
    resolveSettlement(requestId, action, acceptedAmountCents) {
      const request = data.settlementRequests.find((item) => item.id === requestId);
      if (!request || request.status !== 'in-review' || request.toId !== data.currentUserId) return false;
      const amount = action === 'accept' ? Math.min(request.claimedAmountCents, Math.max(1, acceptedAmountCents ?? request.claimedAmountCents)) : 0;
      const resolvedAt = new Date().toISOString();
      setData((current) => {
        const peerBalances = action === 'accept'
          ? applyPeerBalanceDelta(current.peerBalances, request.fromId, request.toId, -amount)
          : current.peerBalances;
        const expenses = action === 'accept'
          ? markFullySettledExpenses(applySettlementToExpenseSplits(current.expenses, request.fromId, request.toId, amount), resolvedAt)
          : current.expenses;
        return {
          ...current,
          peerBalances,
          expenses,
          settlementRequests: current.settlementRequests.map((item) => item.id === requestId
            ? { ...item, amountCents: amount, status: action === 'accept' ? 'accepted' : 'rejected', resolvedAt }
            : item),
        };
      });
      queueCloudMutation(() => resolveCloudSettlement(requestId, action, amount));
      return true;
    },
    async settleReceivable(debtorId, amountCents) {
      if (amountCents < 1) throw new Error('Enter a valid settlement amount.');
      await settleCloudReceivable(data.id, debtorId, amountCents);
      await refreshCloud();
    },
    async settleAllReceivables() {
      await settleAllCloudReceivables(data.id);
      await refreshCloud();
    },
    createChore({ name, assigneeId, dueDate, frequencyInterval, frequencyUnit, rotationEnabled }) {
      const cleanName = name.trim();
      if (!cleanName) return;
      const templateId = makeId('chore');
      const now = new Date().toISOString();
      setData((current) => ({
        ...current,
        choreTemplates: [
          {
            id: templateId,
            householdId: current.id,
            name: cleanName,
            frequencyInterval,
            frequencyUnit,
            rotationEnabled,
            isAdHoc: false,
            isDeleted: false,
            createdAt: now,
          },
          ...current.choreTemplates,
        ],
        choreLogs: [
          { id: makeId('log'), choreTemplateId: templateId, assignedTo: assigneeId, dueDate: frequencyInterval ? undefined : dueDate, status: 'active', createdAt: now },
          ...current.choreLogs,
        ],
      }));
      queueCloudMutation(() => createCloudChore(data.id, cleanName, assigneeId, dueDate, frequencyInterval, frequencyUnit, rotationEnabled));
    },
    updateChore({ templateId, logId, name, assigneeId, dueDate, frequencyInterval, frequencyUnit, rotationEnabled }) {
      const cleanName = name.trim();
      if (!cleanName) return;
      setData((current) => ({
        ...current,
        choreTemplates: current.choreTemplates.map((template) => template.id === templateId
          ? { ...template, name: cleanName, frequencyInterval, frequencyUnit, rotationEnabled }
          : template),
        choreLogs: current.choreLogs.map((log) => log.id === logId
          ? { ...log, assignedTo: assigneeId, dueDate: frequencyInterval ? undefined : dueDate }
          : log),
      }));
      queueCloudMutation(() => updateCloudChore(templateId, logId, {
        name: cleanName,
        assigneeId,
        dueDate,
        frequencyInterval,
        frequencyUnit,
        rotationEnabled,
      }));
    },
    scheduleChore(templateId, assigneeId, dueDate) {
      const isRepeating = Boolean(data.choreTemplates.find((template) => template.id === templateId)?.frequencyInterval);
      setData((current) => ({
        ...current,
        choreLogs: [
          { id: makeId('log'), choreTemplateId: templateId, assignedTo: assigneeId, dueDate: isRepeating ? undefined : dueDate, status: 'active', createdAt: new Date().toISOString() },
          ...current.choreLogs,
        ],
      }));
      queueCloudMutation(() => scheduleCloudChore(templateId, assigneeId, isRepeating ? undefined : dueDate));
    },
    completeChore(logId) {
      setData((current) => {
        const log = current.choreLogs.find((item) => item.id === logId);
        const template = current.choreTemplates.find((item) => item.id === log?.choreTemplateId);
        if (!log || !template || log.status !== 'active') return current;
        const now = new Date();
        const completedAt = now.toISOString();
        let choreLogs = current.choreLogs.map((item) => item.id === logId
          ? { ...item, status: 'completed' as const, completionType: 'completed' as const, completedBy: current.currentUserId, completedAt, availableAt: undefined, snoozedUntil: undefined }
          : item);

        if (template.frequencyInterval && template.frequencyUnit) {
          let nextAssignee = log.assignedTo;
          if (template.rotationEnabled && log.assignedTo) {
            const members = current.members.filter((member) => member.status === 'active');
            const currentIndex = members.findIndex((member) => member.id === log.assignedTo);
            if (currentIndex >= 0) nextAssignee = members[(currentIndex + 1) % members.length]?.id;
          }
          const availableAt = addChoreDuration(now, template.frequencyInterval, template.frequencyUnit).toISOString();
          choreLogs = [{
            id: makeId('log'),
            choreTemplateId: template.id,
            assignedTo: nextAssignee,
            status: 'inactive',
            availableAt,
            recurrenceOfId: logId,
            createdAt: completedAt,
          }, ...choreLogs];
        }
        return { ...current, choreLogs };
      });
      queueCloudMutation(() => completeCloudChore(logId, data.currentUserId));
    },
    skipChore(logId) {
      setData((current) => {
        const log = current.choreLogs.find((item) => item.id === logId);
        const template = current.choreTemplates.find((item) => item.id === log?.choreTemplateId);
        if (!log || !template || log.status !== 'active') return current;
        const now = new Date();
        if (template.frequencyInterval && template.frequencyUnit) {
          const availableAt = addChoreDuration(now, template.frequencyInterval, template.frequencyUnit).toISOString();
          return {
            ...current,
            choreLogs: [
              {
                id: makeId('log'),
                choreTemplateId: template.id,
                assignedTo: log.assignedTo,
                completedBy: current.currentUserId,
                status: 'completed',
                completionType: 'skipped',
                completedAt: now.toISOString(),
                createdAt: now.toISOString(),
              },
              ...current.choreLogs.map((item) => item.id === logId
                ? { ...item, status: 'inactive' as const, dueDate: undefined, availableAt, snoozedUntil: undefined }
                : item),
            ],
          };
        }
        const completedAt = now.toISOString();
        return {
          ...current,
          choreLogs: current.choreLogs.map((item) => item.id === logId
            ? { ...item, status: 'completed', completionType: 'skipped', completedAt, completedBy: current.currentUserId, availableAt: undefined, snoozedUntil: undefined }
            : item),
        };
      });
      queueCloudMutation(() => skipCloudChore(logId));
    },
    snoozeChore(logId, amount, unit) {
      if (amount < 1) return;
      const availableAt = addChoreDuration(new Date(), amount, unit).toISOString();
      setData((current) => {
        const currentLog = current.choreLogs.find((log) => log.id === logId);
        const template = current.choreTemplates.find((item) => item.id === currentLog?.choreTemplateId);
        return {
          ...current,
          choreLogs: current.choreLogs.map((log) => log.id === logId && log.status === 'active'
            ? { ...log, status: 'inactive', dueDate: template?.frequencyInterval ? undefined : availableAt, availableAt, snoozedUntil: availableAt }
            : log),
        };
      });
      queueCloudMutation(() => snoozeCloudChore(logId, availableAt));
    },
    undoChore(logId) {
      setData((current) => ({
        ...current,
        choreLogs: current.choreLogs
          .filter((log) => log.recurrenceOfId !== logId)
          .map((log) => log.id === logId && log.status === 'completed'
            ? { ...log, status: 'active', completedBy: undefined, completedAt: undefined, completionType: undefined, availableAt: undefined, snoozedUntil: undefined }
            : log),
      }));
      queueCloudMutation(() => undoCloudChore(logId));
    },
    logAdHocChore(name) {
      const cleanName = name.trim();
      if (!cleanName) return;
      const now = new Date().toISOString();
      const templateId = makeId('ad-hoc');
      setData((current) => ({
        ...current,
        choreTemplates: [{
          id: templateId,
          householdId: current.id,
          name: cleanName,
          rotationEnabled: false,
          isAdHoc: true,
          isDeleted: false,
          createdAt: now,
        }, ...current.choreTemplates],
        choreLogs: [{
          id: makeId('log'),
          choreTemplateId: templateId,
          completedBy: current.currentUserId,
          status: 'completed',
          completionType: 'ad-hoc',
          completedAt: now,
          createdAt: now,
        }, ...current.choreLogs],
      }));
      queueCloudMutation(() => logCloudAdHocChore(data.id, cleanName));
    },
    deleteChoreTemplate(templateId) {
      const deletedAt = new Date().toISOString();
      setData((current) => ({
        ...current,
        choreTemplates: current.choreTemplates.map((template) =>
          template.id === templateId ? { ...template, isDeleted: true, deletedAt } : template,
        ),
        choreLogs: current.choreLogs.map((log) =>
          log.choreTemplateId === templateId ? { ...log, deletedAt } : log,
        ),
      }));
      queueCloudMutation(() => deleteCloudChoreTemplate(templateId));
    },
    async moveOutMember(memberId) {
      if (memberId === data.currentUserId) throw new Error('Use Leave household to move yourself out.');
      if (memberHasOpenBalance(data.peerBalances, memberId)) {
        throw new Error('This roommate must settle everything they owe or are owed before moving out.');
      }
      await moveOutCloudMember(data.id, memberId);
      await refreshCloud();
    },
    async leaveHousehold(options) {
      if (activeMembers.length <= 1) throw new Error('You are the last active member. Delete the household instead.');
      const summary = getMemberBalanceSummary(data.peerBalances, data.currentUserId);
      if (summary.owingCents > 0) throw new Error('Settle everything you owe before leaving this household.');
      if (summary.owedCents > 0 && !options?.settleReceivables) {
        throw new Error('Settle or forgive everything owed to you before leaving this household.');
      }
      await leaveCloudHousehold(data.id, Boolean(options?.settleReceivables));
      await refreshCloud();
    },
    async deleteHousehold() {
      const reason = householdDeletionBlockReason(data);
      if (reason) throw new Error(reason);
      await deleteCloudHousehold(data.id);
      await refreshCloud();
    },
    moveOutBlockReason(memberId) {
      return memberHasOpenBalance(data.peerBalances, memberId)
        ? 'This roommate must settle everything they owe or are owed before moving out.'
        : undefined;
    },
    async reclaimMember(memberId) {
      const member = data.members.find((candidate) => candidate.id === memberId);
      if (!member || member.movedOutBy !== data.currentUserId) {
        throw new Error('Only the roommate who initiated this move-out can undo it.');
      }
      await reclaimCloudMember(data.id, memberId);
      await refreshCloud();
    },
    createCloudHousehold: createConfiguredHousehold,
    joinCloudHousehold: joinConfiguredHousehold,
    refreshCloud,
    deleteHouseholdBlockReason: householdDeletionBlockReason(data),
  }), [activeMembers, archivedMembers, cloudError, cloudState, createConfiguredHousehold, data, isReady, joinConfiguredHousehold, queueCloudMutation, recentChoreLogs, refreshCloud]);

  return <HouseholdContext value={value}>{children}</HouseholdContext>;
}

export function useHousehold(): HouseholdContextValue {
  const value = React.use(HouseholdContext);
  if (!value) throw new Error('useHousehold must be used within HouseholdProvider.');
  return value;
}
