import type { HouseholdData } from '@/lib/types';

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

export const demoHousehold: HouseholdData = {
  id: 'house-cedar',
  name: 'The Cedar Flat',
  joinCode: 'CEDAR-42',
  currency: 'INR',
  currentUserId: 'aditya',
  members: [
    { id: 'aditya', name: 'Aditya', email: 'aditya@example.com', status: 'active' },
    { id: 'maya', name: 'Maya', email: 'maya@example.com', status: 'active' },
    { id: 'leo', name: 'Leo', email: 'leo@example.com', status: 'active' },
    {
      id: 'jamie',
      name: 'Jamie',
      email: 'jamie@example.com',
      status: 'archived',
      movedOutBy: 'aditya',
      movedOutAt: daysFromNow(-2),
    },
  ],
  expenses: [
    {
      id: 'internet-july',
      description: 'July internet',
      amountCents: 7200,
      paidBy: 'maya',
      splitMethod: 'equal',
      currency: 'INR',
      splits: [
        { memberId: 'aditya', owedCents: 2400 },
        { memberId: 'maya', owedCents: 2400 },
        { memberId: 'leo', owedCents: 2400 },
      ],
      createdAt: daysFromNow(-5),
    },
    {
      id: 'groceries-july',
      description: 'Sunday groceries',
      amountCents: 4860,
      paidBy: 'aditya',
      splitMethod: 'equal',
      currency: 'INR',
      splits: [
        { memberId: 'aditya', owedCents: 1620 },
        { memberId: 'maya', owedCents: 1620 },
        { memberId: 'leo', owedCents: 1620 },
      ],
      createdAt: daysFromNow(-2),
    },
    {
      id: 'cleaning-july',
      description: 'Cleaning supplies',
      amountCents: 2100,
      paidBy: 'leo',
      splitMethod: 'equal',
      currency: 'INR',
      splits: [
        { memberId: 'aditya', owedCents: 700 },
        { memberId: 'maya', owedCents: 700 },
        { memberId: 'leo', owedCents: 700 },
      ],
      createdAt: daysFromNow(-1),
    },
    {
      id: 'coffee-july',
      description: 'Working-from-home coffee',
      amountCents: 960,
      paidBy: 'aditya',
      splitMethod: 'custom',
      currency: 'INR',
      splits: [
        { memberId: 'aditya', owedCents: 480 },
        { memberId: 'maya', owedCents: 480 },
      ],
      createdAt: daysFromNow(-1),
    },
    {
      id: 'movie-night-settled',
      description: 'Movie night snacks',
      amountCents: 1200,
      paidBy: 'aditya',
      splitMethod: 'equal',
      currency: 'INR',
      splits: [
        { memberId: 'aditya', owedCents: 600 },
        { memberId: 'maya', owedCents: 600 },
      ],
      settledAt: daysFromNow(-4),
      createdAt: daysFromNow(-6),
    },
  ],
  choreTemplates: [
    { id: 'kitchen', householdId: 'house-cedar', name: 'Clean kitchen', frequencyInterval: 1, frequencyUnit: 'week', rotationEnabled: true, isAdHoc: false, isDeleted: false, createdAt: daysFromNow(-20) },
    { id: 'trash', householdId: 'house-cedar', name: 'Take out recycling', frequencyInterval: 2, frequencyUnit: 'day', rotationEnabled: true, isAdHoc: false, isDeleted: false, createdAt: daysFromNow(-14) },
    { id: 'bathroom', householdId: 'house-cedar', name: 'Replace bathroom bulb', rotationEnabled: false, isAdHoc: false, isDeleted: false, createdAt: daysFromNow(-3) },
    { id: 'fridge', householdId: 'house-cedar', name: 'Clean fridge', frequencyInterval: 1, frequencyUnit: 'month', rotationEnabled: false, isAdHoc: false, isDeleted: false, createdAt: daysFromNow(-28) },
    { id: 'oven-ad-hoc', householdId: 'house-cedar', name: 'Deep-cleaned the oven', rotationEnabled: false, isAdHoc: true, isDeleted: false, createdAt: hoursFromNow(-3) },
    { id: 'hall', householdId: 'house-cedar', name: 'Mop hallway', rotationEnabled: false, isAdHoc: false, isDeleted: true, deletedAt: daysFromNow(-3), createdAt: daysFromNow(-30) },
  ],
  choreLogs: [
    { id: 'kitchen-today', choreTemplateId: 'kitchen', assignedTo: 'maya', status: 'active', createdAt: daysFromNow(-2) },
    { id: 'trash-tomorrow', choreTemplateId: 'trash', assignedTo: 'leo', status: 'active', createdAt: daysFromNow(-1) },
    { id: 'bathroom-past-due', choreTemplateId: 'bathroom', dueDate: daysFromNow(-1), status: 'active', createdAt: daysFromNow(-3) },
    { id: 'fridge-snoozed', choreTemplateId: 'fridge', assignedTo: 'aditya', status: 'inactive', availableAt: daysFromNow(2), snoozedUntil: daysFromNow(2), createdAt: daysFromNow(-3) },
    { id: 'oven-ad-hoc-log', choreTemplateId: 'oven-ad-hoc', completedBy: 'aditya', status: 'completed', completionType: 'ad-hoc', completedAt: hoursFromNow(-3), createdAt: hoursFromNow(-3) },
    { id: 'kitchen-history-1', choreTemplateId: 'kitchen', assignedTo: 'aditya', completedBy: 'aditya', status: 'completed', completedAt: daysFromNow(-7), createdAt: daysFromNow(-8) },
    { id: 'kitchen-history-2', choreTemplateId: 'kitchen', assignedTo: 'leo', completedBy: 'leo', status: 'completed', completedAt: daysFromNow(-13), createdAt: daysFromNow(-15) },
    { id: 'trash-skipped-history', choreTemplateId: 'trash', assignedTo: 'maya', completedBy: 'maya', status: 'completed', completionType: 'skipped', completedAt: daysFromNow(-4), createdAt: daysFromNow(-4) },
    { id: 'hall-history', choreTemplateId: 'hall', assignedTo: 'maya', completedBy: 'maya', dueDate: daysFromNow(-9), status: 'completed', completedAt: daysFromNow(-9), deletedAt: daysFromNow(-3), createdAt: daysFromNow(-10) },
  ],
  peerBalances: [
    { userLowId: 'aditya', userHighId: 'maya', balanceCents: 300 },
    { userLowId: 'aditya', userHighId: 'leo', balanceCents: -920 },
    { userLowId: 'leo', userHighId: 'maya', balanceCents: 1700 },
  ],
  settlementRequests: [
    { id: 'request-outbound', fromId: 'aditya', toId: 'maya', amountCents: 200, claimedAmountCents: 200, originalDebtCents: 300, status: 'in-review', createdAt: hoursFromNow(-5) },
    { id: 'request-inbound', fromId: 'leo', toId: 'aditya', amountCents: 500, claimedAmountCents: 500, originalDebtCents: 920, status: 'in-review', createdAt: hoursFromNow(-2) },
    { id: 'request-complete', fromId: 'maya', toId: 'aditya', amountCents: 600, claimedAmountCents: 600, originalDebtCents: 600, status: 'accepted', createdAt: daysFromNow(-4), resolvedAt: daysFromNow(-4) },
  ],
};
