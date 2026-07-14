import type { HouseholdData } from '@/lib/types';

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const demoHousehold: HouseholdData = {
  id: 'house-cedar',
  name: 'The Cedar Flat',
  joinCode: 'CEDAR-42',
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
      splits: [
        { memberId: 'aditya', owedCents: 480 },
        { memberId: 'maya', owedCents: 480 },
      ],
      createdAt: daysFromNow(-1),
    },
  ],
  choreTemplates: [
    { id: 'kitchen', householdId: 'house-cedar', name: 'Clean kitchen', isDeleted: false, createdAt: daysFromNow(-20) },
    { id: 'trash', householdId: 'house-cedar', name: 'Take out recycling', isDeleted: false, createdAt: daysFromNow(-14) },
    { id: 'hall', householdId: 'house-cedar', name: 'Mop hallway', isDeleted: true, deletedAt: daysFromNow(-3), createdAt: daysFromNow(-30) },
  ],
  choreLogs: [
    { id: 'kitchen-today', choreTemplateId: 'kitchen', assignedTo: 'maya', dueDate: daysFromNow(0), status: 'pending', createdAt: daysFromNow(-2) },
    { id: 'trash-tomorrow', choreTemplateId: 'trash', assignedTo: 'leo', dueDate: daysFromNow(1), status: 'pending', createdAt: daysFromNow(-1) },
    { id: 'kitchen-history-1', choreTemplateId: 'kitchen', assignedTo: 'aditya', completedBy: 'aditya', dueDate: daysFromNow(-7), status: 'completed', completedAt: daysFromNow(-7), createdAt: daysFromNow(-8) },
    { id: 'kitchen-history-2', choreTemplateId: 'kitchen', assignedTo: 'leo', completedBy: 'leo', dueDate: daysFromNow(-14), status: 'completed', completedAt: daysFromNow(-13), createdAt: daysFromNow(-15) },
    { id: 'hall-history', choreTemplateId: 'hall', assignedTo: 'maya', completedBy: 'maya', dueDate: daysFromNow(-9), status: 'completed', completedAt: daysFromNow(-9), deletedAt: daysFromNow(-3), createdAt: daysFromNow(-10) },
  ],
};
