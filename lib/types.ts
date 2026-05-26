// ─── Savings ──────────────────────────────────────────────────────────────────

export type SavingsType =
  | 'FD'
  | 'Mutual Funds'
  | 'Stocks'
  | 'Chit Funds'
  | 'PPF'
  | 'Gold'
  | 'Other';

export const SAVINGS_TYPES: SavingsType[] = [
  'FD',
  'Mutual Funds',
  'Stocks',
  'Chit Funds',
  'PPF',
  'Gold',
  'Other',
];

export const SAVINGS_TYPE_COLORS: Record<SavingsType, string> = {
  FD: '#3B82F6',
  'Mutual Funds': '#8B5CF6',
  Stocks: '#10B981',
  'Chit Funds': '#F59E0B',
  PPF: '#06B6D4',
  Gold: '#EAB308',
  Other: '#6B7280',
};

export interface SavingsEntry {
  id: string;
  name: string;
  type: SavingsType;
  amountInvested: number;
  currentValue: number;
  startDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  // Chit-fund specific (null for all other types)
  chitMembers: number | null;
  chitFaceValue: number | null;
  chitDurationMonths: number | null;
  chitBidFrequency: number | null;
  chitWonCycle: number | null;
  chitBidReceived: number | null;
  chitIsForeman: boolean | null;
}

// ─── Chit Cycles ──────────────────────────────────────────────────────────────

export interface ChitCycle {
  id: string;
  savingId: string;
  cycleNumber: number;
  amountPaid: number;
  commissionReceived: number | null;
  totalCommission: number | null;
  userWon: boolean;
  bidAmountReceived: number | null;
  cycleDate: string | null;
  createdAt: string;
}

export interface ChitCycleInput {
  cycleNumber: number;
  amountPaid: number;
  commissionReceived: number | null;
  totalCommission: number | null;
  userWon: boolean;
  bidAmountReceived: number | null;
  cycleDate: string | null;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'Food'
  | 'Transport'
  | 'Rent'
  | 'EMI'
  | 'Entertainment'
  | 'Health'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Rent',
  'EMI',
  'Entertainment',
  'Health',
  'Other',
];

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food: '#F97316',
  Transport: '#3B82F6',
  Rent: '#EF4444',
  EMI: '#8B5CF6',
  Entertainment: '#EC4899',
  Health: '#10B981',
  Other: '#6B7280',
};

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  Food: '🍽️',
  Transport: '🚗',
  Rent: '🏠',
  EMI: '💳',
  Entertainment: '🎬',
  Health: '🩺',
  Other: '📦',
};

export interface ExpenseEntry {
  id: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  notes: string;
  createdAt: string;
}
