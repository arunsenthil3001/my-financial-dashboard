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
  // Multi-currency columns (may be null for legacy rows if migration not run)
  currency: string | null;
  original_amount: string | number | null;
  rate_used: string | number | null;
  home_amount: string | number | null;
  foreign_amount: string | number | null;
  remittance_id: string | null;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToEntry(row: ExpenseRow): ExpenseEntry {
  const amount = Number(row.amount);
  const homeAmount = row.home_amount !== null ? Number(row.home_amount) : amount;
  return {
    id: row.id,
    amount,
    category: row.category as ExpenseCategory,
    date: row.date,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    currency: row.currency ?? 'INR',
    originalAmount: row.original_amount !== null ? Number(row.original_amount) : amount,
    rateUsed: row.rate_used !== null ? Number(row.rate_used) : 1,
    homeAmount,
    foreignAmount: row.foreign_amount !== null ? Number(row.foreign_amount) : null,
    remittanceId: row.remittance_id ?? null,
  };
}

export type ExpenseInput = Omit<ExpenseEntry, 'id' | 'createdAt'>;

function inputToRow(input: ExpenseInput) {
  return {
    amount: input.homeAmount,  // keep legacy `amount` column in sync with homeAmount
    category: input.category,
    date: input.date,
    notes: input.notes,
    currency: input.currency,
    original_amount: input.originalAmount,
    rate_used: input.rateUsed,
    home_amount: input.homeAmount,
    foreign_amount: input.foreignAmount ?? null,
    remittance_id: input.remittanceId ?? null,
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

  useEffect(() => { load(); }, [load]);

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

  // ── Update ──
  const update = useCallback(
    async (id: string, input: ExpenseInput): Promise<boolean> => {
      const { data, error } = await supabase
        .from('expenses')
        .update(inputToRow(input))
        .eq('id', id)
        .select()
        .single();

      if (error) {
        toast(`Failed to update expense: ${error.message}`, 'error');
        return false;
      }
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? rowToEntry(data as ExpenseRow) : e)),
      );
      toast('Expense updated', 'success');
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
        case 'today': return expenses.filter((e) => isToday(e.date));
        case 'week':  return expenses.filter((e) => isThisWeek(e.date));
        case 'month': return expenses.filter((e) => isThisMonth(e.date));
        default:      return expenses;
      }
    },
    [expenses],
  );

  // ── Derived values (use homeAmount so totals are always in home currency) ──
  const monthlyTotal = useMemo(
    () => expenses.filter((e) => isThisMonth(e.date)).reduce((s, e) => s + e.homeAmount, 0),
    [expenses],
  );

  /** Last 6 months spend in home currency, for the BarChart */
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = monthKey(d.toISOString());
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const total = expenses
        .filter((e) => monthKey(e.date) === key)
        .reduce((s, e) => s + e.homeAmount, 0);
      return { month: label, total };
    });
  }, [expenses]);

  return { expenses, loading, add, update, remove, filter, monthlyTotal, monthlyTrend };
}
