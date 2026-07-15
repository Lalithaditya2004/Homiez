export type MemberStatus = 'active' | 'archived';
export type SplitMethod = 'equal' | 'custom';
export type ChoreStatus = 'pending' | 'completed';

export type HouseholdMember = {
  id: string;
  name: string;
  email: string;
  status: MemberStatus;
  movedOutBy?: string;
  movedOutAt?: string;
};

export type ExpenseSplit = {
  memberId: string;
  owedCents: number;
};

export type Expense = {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  createdAt: string;
};

export type ChoreTemplate = {
  id: string;
  name: string;
  householdId: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
};

export type ChoreLog = {
  id: string;
  choreTemplateId: string;
  assignedTo?: string;
  completedBy?: string;
  dueDate?: string;
  status: ChoreStatus;
  completedAt?: string;
  deletedAt?: string;
  createdAt: string;
};

export type SettlementTransaction = {
  id: string;
  fromId: string;
  toId: string;
  amountCents: number;
  status: 'pending' | 'confirmed';
  confirmedBy?: string;
  confirmedAt?: string;
};

export type Settlement = {
  id: string;
  transactions: SettlementTransaction[];
  acceptedAt: string;
};

export type HouseholdData = {
  id: string;
  name: string;
  joinCode: string;
  currentUserId: string;
  members: HouseholdMember[];
  expenses: Expense[];
  choreTemplates: ChoreTemplate[];
  choreLogs: ChoreLog[];
  settlement?: Settlement;
};

export type ExpenseDraft = {
  description: string;
  amountCents: number;
  paidBy: string;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
};
