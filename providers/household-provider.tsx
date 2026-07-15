import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { createDebtDetoxPreview, getMemberBalances } from '@/lib/debt-detox';
import { demoHousehold } from '@/lib/demo-data';
import {
  acceptCloudSettlement,
  completeCloudChore,
  confirmCloudSettlementPayment,
  createCloudChore,
  createCloudExpense,
  createCloudHousehold,
  deleteCloudChoreTemplate,
  joinCloudHousehold,
  loadCurrentCloudHousehold,
  moveOutCloudMember,
  reclaimCloudMember,
  scheduleCloudChore,
} from '@/lib/household-repository';
import { subscribeToHouseholdChanges } from '@/lib/household-realtime';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import type { ChoreLog, ExpenseDraft, HouseholdData } from '@/lib/types';

const STORAGE_KEY = 'homiez-household-v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type CreateChoreInput = {
  name: string;
  assigneeId?: string;
  dueDate?: string;
};

export type CloudState = 'demo' | 'loading' | 'signed-out' | 'needs-household' | 'synced' | 'error';

type HouseholdContextValue = {
  data: HouseholdData;
  isReady: boolean;
  cloudState: CloudState;
  cloudError?: string;
  isCloudBacked: boolean;
  activeMembers: HouseholdData['members'];
  archivedMembers: HouseholdData['members'];
  balances: ReturnType<typeof getMemberBalances>;
  debtPreview: ReturnType<typeof createDebtDetoxPreview>;
  recentChoreLogs: ChoreLog[];
  deletedChoreLogs: ChoreLog[];
  addExpense: (expense: ExpenseDraft) => void;
  acceptDebtPlan: () => void;
  confirmSettlementPayment: (transactionId: string) => void;
  createChore: (input: CreateChoreInput) => void;
  scheduleChore: (templateId: string, assigneeId?: string, dueDate?: string) => void;
  completeChore: (logId: string) => void;
  deleteChoreTemplate: (templateId: string) => void;
  moveOutMember: (memberId: string) => void;
  reclaimMember: (memberId: string) => boolean;
  createCloudHousehold: (name: string) => Promise<void>;
  joinCloudHousehold: (joinCode: string) => Promise<void>;
  refreshCloud: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
        if (saved) setData(JSON.parse(saved) as HouseholdData);
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
      setData(cloudHousehold);
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
  const balances = useMemo(() => getMemberBalances(data.expenses, data.members), [data.expenses, data.members]);
  const debtPreview = useMemo(() => createDebtDetoxPreview(data.expenses, data.members), [data.expenses, data.members]);
  const recentChoreLogs = useMemo(
    () => data.choreLogs.filter((log) => !log.deletedAt && new Date(log.createdAt).getTime() >= Date.now() - THIRTY_DAYS_MS),
    [data.choreLogs],
  );
  const deletedChoreLogs = useMemo(
    () => data.choreLogs.filter((log) => log.deletedAt && new Date(log.deletedAt).getTime() >= Date.now() - THIRTY_DAYS_MS),
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
    balances,
    debtPreview,
    recentChoreLogs,
    deletedChoreLogs,
    addExpense(expense) {
      if (expense.amountCents <= 0 || !expense.description.trim()) return;
      if (expense.splits.reduce((total, split) => total + split.owedCents, 0) !== expense.amountCents) return;
      setData((current) => ({
        ...current,
        expenses: [
          {
            ...expense,
            id: makeId('expense'),
            description: expense.description.trim(),
            createdAt: new Date().toISOString(),
          },
          ...current.expenses,
        ],
        settlement: undefined,
      }));
      queueCloudMutation(() => createCloudExpense(data.id, expense));
    },
    acceptDebtPlan() {
      const latestPreview = createDebtDetoxPreview(data.expenses, data.members);
      setData((current) => ({
        ...current,
        settlement: {
          id: makeId('settlement'),
          acceptedAt: new Date().toISOString(),
          transactions: latestPreview.transactions.map((transaction) => ({
            id: makeId('settlement-transaction'),
            fromId: transaction.fromId,
            toId: transaction.toId,
            amountCents: transaction.amountCents,
            status: 'pending',
          })),
        },
      }));
      queueCloudMutation(() => acceptCloudSettlement(data.id, latestPreview.transactions));
    },
    confirmSettlementPayment(transactionId) {
      setData((current) => ({
        ...current,
        settlement: current.settlement
          ? {
              ...current.settlement,
              transactions: current.settlement.transactions.map((transaction) =>
                transaction.id === transactionId
                  ? { ...transaction, status: 'confirmed', confirmedBy: current.currentUserId, confirmedAt: new Date().toISOString() }
                  : transaction,
              ),
            }
          : undefined,
      }));
      queueCloudMutation(() => confirmCloudSettlementPayment(transactionId));
    },
    createChore({ name, assigneeId, dueDate }) {
      const cleanName = name.trim();
      if (!cleanName) return;
      const templateId = makeId('chore');
      const now = new Date().toISOString();
      setData((current) => ({
        ...current,
        choreTemplates: [
          { id: templateId, householdId: current.id, name: cleanName, isDeleted: false, createdAt: now },
          ...current.choreTemplates,
        ],
        choreLogs: [
          { id: makeId('log'), choreTemplateId: templateId, assignedTo: assigneeId, dueDate, status: 'pending', createdAt: now },
          ...current.choreLogs,
        ],
      }));
      queueCloudMutation(() => createCloudChore(data.id, cleanName, assigneeId, dueDate));
    },
    scheduleChore(templateId, assigneeId, dueDate) {
      setData((current) => ({
        ...current,
        choreLogs: [
          { id: makeId('log'), choreTemplateId: templateId, assignedTo: assigneeId, dueDate, status: 'pending', createdAt: new Date().toISOString() },
          ...current.choreLogs,
        ],
      }));
      queueCloudMutation(() => scheduleCloudChore(templateId, assigneeId, dueDate));
    },
    completeChore(logId) {
      setData((current) => ({
        ...current,
        choreLogs: current.choreLogs.map((log) =>
          log.id === logId
            ? { ...log, status: 'completed', completedBy: current.currentUserId, completedAt: new Date().toISOString() }
            : log,
        ),
      }));
      queueCloudMutation(() => completeCloudChore(logId, data.currentUserId));
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
    moveOutMember(memberId) {
      if (memberId === data.currentUserId) return;
      setData((current) => ({
        ...current,
        members: current.members.map((member) =>
          member.id === memberId && member.status === 'active'
            ? { ...member, status: 'archived', movedOutBy: current.currentUserId, movedOutAt: new Date().toISOString() }
            : member,
        ),
      }));
      queueCloudMutation(() => moveOutCloudMember(data.id, memberId));
    },
    reclaimMember(memberId) {
      const member = data.members.find((candidate) => candidate.id === memberId);
      if (!member || member.movedOutBy !== data.currentUserId) return false;
      setData((current) => ({
        ...current,
        members: current.members.map((candidate) =>
          candidate.id === memberId ? { ...candidate, status: 'active', movedOutBy: undefined, movedOutAt: undefined } : candidate,
        ),
      }));
      queueCloudMutation(() => reclaimCloudMember(data.id, memberId));
      return true;
    },
    createCloudHousehold: createConfiguredHousehold,
    joinCloudHousehold: joinConfiguredHousehold,
    refreshCloud,
  }), [activeMembers, archivedMembers, balances, cloudError, cloudState, createConfiguredHousehold, data, debtPreview, deletedChoreLogs, isReady, joinConfiguredHousehold, queueCloudMutation, recentChoreLogs, refreshCloud]);

  return <HouseholdContext value={value}>{children}</HouseholdContext>;
}

export function useHousehold(): HouseholdContextValue {
  const value = React.use(HouseholdContext);
  if (!value) throw new Error('useHousehold must be used within HouseholdProvider.');
  return value;
}
