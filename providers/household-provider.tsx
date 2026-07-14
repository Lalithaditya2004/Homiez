import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useMemo, useState } from 'react';

import { createDebtDetoxPreview, getMemberBalances } from '@/lib/debt-detox';
import { demoHousehold } from '@/lib/demo-data';
import type { ChoreLog, ExpenseDraft, HouseholdData } from '@/lib/types';

const STORAGE_KEY = 'homiez-household-v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type CreateChoreInput = {
  name: string;
  assigneeId?: string;
  dueDate?: string;
};

type HouseholdContextValue = {
  data: HouseholdData;
  isReady: boolean;
  activeMembers: HouseholdData['members'];
  archivedMembers: HouseholdData['members'];
  balances: ReturnType<typeof getMemberBalances>;
  debtPreview: ReturnType<typeof createDebtDetoxPreview>;
  recentChoreLogs: ChoreLog[];
  deletedChoreLogs: ChoreLog[];
  addExpense: (expense: ExpenseDraft) => void;
  acceptDebtPlan: () => void;
  createChore: (input: CreateChoreInput) => void;
  scheduleChore: (templateId: string, assigneeId?: string, dueDate?: string) => void;
  completeChore: (logId: string) => void;
  deleteChoreTemplate: (templateId: string) => void;
  moveOutMember: (memberId: string) => void;
  reclaimMember: (memberId: string) => boolean;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function HouseholdProvider({ children }: React.PropsWithChildren) {
  const [data, setData] = useState<HouseholdData>(demoHousehold);
  const [isReady, setIsReady] = useState(false);

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
    },
    acceptDebtPlan() {
      const latestPreview = createDebtDetoxPreview(data.expenses, data.members);
      setData((current) => ({
        ...current,
        settlement: {
          id: makeId('settlement'),
          acceptedAt: new Date().toISOString(),
          transactions: latestPreview.transactions.map((transaction) => ({
            fromId: transaction.fromId,
            toId: transaction.toId,
            amountCents: transaction.amountCents,
          })),
        },
      }));
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
    },
    scheduleChore(templateId, assigneeId, dueDate) {
      setData((current) => ({
        ...current,
        choreLogs: [
          { id: makeId('log'), choreTemplateId: templateId, assignedTo: assigneeId, dueDate, status: 'pending', createdAt: new Date().toISOString() },
          ...current.choreLogs,
        ],
      }));
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
      return true;
    },
  }), [activeMembers, archivedMembers, balances, data, debtPreview, deletedChoreLogs, isReady, recentChoreLogs]);

  return <HouseholdContext value={value}>{children}</HouseholdContext>;
}

export function useHousehold(): HouseholdContextValue {
  const value = React.use(HouseholdContext);
  if (!value) throw new Error('useHousehold must be used within HouseholdProvider.');
  return value;
}
