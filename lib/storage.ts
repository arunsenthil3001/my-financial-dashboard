import type { SavingsEntry, ExpenseEntry } from './types';

const SAVINGS_KEY = 'mfd_savings';
const EXPENSES_KEY = 'mfd_expenses';

function safeRead<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function safeWrite<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export const storage = {
  getSavings: (): SavingsEntry[] => safeRead<SavingsEntry>(SAVINGS_KEY),
  setSavings: (entries: SavingsEntry[]): void => safeWrite(SAVINGS_KEY, entries),

  getExpenses: (): ExpenseEntry[] => safeRead<ExpenseEntry>(EXPENSES_KEY),
  setExpenses: (entries: ExpenseEntry[]): void => safeWrite(EXPENSES_KEY, entries),
};
