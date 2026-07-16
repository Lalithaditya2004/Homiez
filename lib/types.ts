export type MemberStatus = 'active' | 'archived';
export type SplitMethod = 'equal' | 'custom';
export type ChoreStatus = 'active' | 'inactive' | 'completed';
export type ChoreFrequencyUnit = 'day' | 'week' | 'month';
export type ChoreCompletionType = 'completed' | 'skipped' | 'ad-hoc';
export type SettlementRequestStatus = 'in-review' | 'accepted' | 'rejected';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD';

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
  settledCents?: number;
};

export type Expense = {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  currency: CurrencyCode;
  settledAt?: string;
  createdAt: string;
};

export type ChoreTemplate = {
  id: string;
  name: string;
  householdId: string;
  frequencyInterval?: number;
  frequencyUnit?: ChoreFrequencyUnit;
  rotationEnabled: boolean;
  isAdHoc: boolean;
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
  completionType?: ChoreCompletionType;
  completedAt?: string;
  availableAt?: string;
  snoozedUntil?: string;
  recurrenceOfId?: string;
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

export type PeerBalance = {
  userLowId: string;
  userHighId: string;
  /** Positive means userLowId owes userHighId; negative means the inverse. */
  balanceCents: number;
};

export type SettlementRequest = {
  id: string;
  fromId: string;
  toId: string;
  amountCents: number;
  claimedAmountCents: number;
  originalDebtCents: number;
  status: SettlementRequestStatus;
  createdAt: string;
  resolvedAt?: string;
};

export type HouseholdData = {
  id: string;
  name: string;
  joinCode: string;
  currency?: CurrencyCode;
  currentUserId: string;
  members: HouseholdMember[];
  expenses: Expense[];
  choreTemplates: ChoreTemplate[];
  choreLogs: ChoreLog[];
  peerBalances: PeerBalance[];
  settlementRequests: SettlementRequest[];
  /** Kept only so pre-migration local caches can be read safely. */
  settlement?: Settlement;
};

export type ExpenseDraft = {
  description: string;
  amountCents: number;
  paidBy: string;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  currency: CurrencyCode;
};
