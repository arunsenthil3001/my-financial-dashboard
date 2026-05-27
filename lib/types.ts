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
  // Multi-currency: link to a remittance transfer (optional)
  remittanceId: string | null;
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
  /** Legacy / display amount — equals homeAmount for home-currency expenses */
  amount: number;
  category: ExpenseCategory;
  date: string;
  notes: string;
  createdAt: string;
  // Multi-currency fields (all required after migration; backfilled for legacy rows)
  currency: string;           // ISO code of the transaction currency
  originalAmount: number;     // amount in the transaction currency
  rateUsed: number;           // 1 foreign = rateUsed home units at save time
  homeAmount: number;         // always in home currency
  foreignAmount: number | null; // same as originalAmount when currency ≠ home
  remittanceId: string | null;  // link to a remittances row
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface UserSettings {
  id: string;
  homeCurrency: string;
  earningCurrency: string;
  // Rate cache (written by cron)
  cachedRate: number | null;
  rateFetchedAt: string | null;
  // Rate alert preferences
  rateAlertEnabled: boolean;
  rateAlertThresholdPct: number;
  rateAlertDismissedAt: string | null;
  rateAlertDismissedRate: number | null;
}

// ─── Rate Snapshots ───────────────────────────────────────────────────────────

export interface RateSnapshot {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fetchedAt: string;
}

// ─── Salary ───────────────────────────────────────────────────────────────────

export interface SalaryEntry {
  id: string;
  netAmount: number;
  currency: string;
  effectiveFrom: string;   // ISO date
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── Remittances ──────────────────────────────────────────────────────────────

export interface RemittanceEntry {
  id: string;
  transferDate: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rateUsed: number;
  channel: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
