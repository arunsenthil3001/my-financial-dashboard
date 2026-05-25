'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toaster';
import type { ExpenseEntry, ExpenseCategory } from '@/lib/types';
import { isToday, isThisWeek, isThisMonth, monthKey } from '@/lib/utils';

export type FilterPeriod = 'today' | 'week' | 'month' | 'all';

// ── DB row shape ──────────────────────────────────────────────────────────────

interface ExpenseRow {
  id: string;
  amount: string | number;
  category: string;
  date: string;
  notes: string;
  created_at: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToEntry(row: ExpenseRow): ExpenseEntry {
  return {
    id: row.id,
    amount: Number(row.amount),
    category: row.category as ExpenseCategory,
    date: row.date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

type ExpenseInput = Omit<ExpenseEntry, 'id' | 'createdAt'>;

function inputToRow(input: ExpenseInput) {
  return {
    amount: input.amount,
    category: input.category,
    date: input.date,
    notes: input.notes,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExpenses() {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // ── Fetch all ──
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      toast(`Could not load expenses: ${error.message}`, 'error');
    } else {
      setExpenses((data as ExpenseRow[]).map(rowToEntry));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Insert ──
  const add = useCallback(
    async (input: ExpenseInput): Promise<boolean> => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(inputToRow(input))
        .select()
        .single();

      if (error) {
        toast(`Failed to add expense: ${error.message}`, 'error');
        return false;
      }
      setExpenses((prev) => [rowToEntry(data as ExpenseRow), ...prev]);
      toast('Expense added', 'success');
      return true;
    },
    [toast],
  );

  // ── Delete ──
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);

      if (error) {
        toast(`Failed to delete: ${error.message}`, 'error');
        return false;
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast('Expense deleted', 'success');
      return true;
    },
    [toast],
  );

  // ── Client-side filter (fast, no extra round-trips) ──
  const filter = useCallback(
    (period: FilterPeriod): ExpenseEntry[] => {
      switch (period) {
        case 'today':
          return expenses.filter((e) => isToday(e.date));
        case 'week':
          return expenses.filter((e) => isThisWeek(e.date));
        case 'month':
          return expenses.filter((e) => isThisMonth(e.date));
        default:
          return expenses;
      }
    },
    [expenses],
  );

  // ── Derived values ──
  const monthlyTotal = useMemo(
    () =>
      expenses
        .filter((e) => isThisMonth(e.date))
        .reduce((s, e) => s + e.amount, 0),
    [expenses],
  );

  /** Last 6 months spend, for the BarChart */
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = monthKey(d.toISOString());
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const total = expenses
        .filter((e) => monthKey(e.date) === key)
        .reduce((s, e) => s + e.amount, 0);
      return { month: label, total };
    });
  }, [expenses]);

  return {
    expenses,
    loading,
    add,
    remove,
    filter,
    monthlyTotal,
    monthlyTrend,
  };
}
