'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toaster';
import type { SavingsEntry, SavingsType } from '@/lib/types';

// ── DB row shape (Postgres returns snake_case) ────────────────────────────────

interface SavingsRow {
  id: string;
  name: string;
  type: string;
  amount_invested: string | number;
  current_value: string | number;
  start_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToEntry(row: SavingsRow): SavingsEntry {
  return {
    id: row.id,
    name: row.name,
    type: row.type as SavingsType,
    amountInvested: Number(row.amount_invested),
    currentValue: Number(row.current_value),
    startDate: row.start_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type SavingsInput = Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>;

function inputToRow(input: SavingsInput) {
  return {
    name: input.name,
    type: input.type,
    amount_invested: input.amountInvested,
    current_value: input.currentValue,
    start_date: input.startDate,
    notes: input.notes,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSavings() {
  const [savings, setSavings] = useState<SavingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // ── Fetch all ──
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('savings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast(`Could not load savings: ${error.message}`, 'error');
    } else {
      setSavings((data as SavingsRow[]).map(rowToEntry));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Insert ──
  const add = useCallback(
    async (input: SavingsInput): Promise<boolean> => {
      const { data, error } = await supabase
        .from('savings')
        .insert(inputToRow(input))
        .select()
        .single();

      if (error) {
        toast(`Failed to add savings: ${error.message}`, 'error');
        return false;
      }
      setSavings((prev) => [rowToEntry(data as SavingsRow), ...prev]);
      toast('Savings entry added', 'success');
      return true;
    },
    [toast],
  );

  // ── Update ──
  const update = useCallback(
    async (id: string, input: SavingsInput): Promise<boolean> => {
      const { data, error } = await supabase
        .from('savings')
        .update(inputToRow(input))
        .eq('id', id)
        .select()
        .single();

      if (error) {
        toast(`Failed to update savings: ${error.message}`, 'error');
        return false;
      }
      setSavings((prev) =>
        prev.map((s) => (s.id === id ? rowToEntry(data as SavingsRow) : s)),
      );
      toast('Savings updated', 'success');
      return true;
    },
    [toast],
  );

  // ── Delete ──
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('savings').delete().eq('id', id);

      if (error) {
        toast(`Failed to delete: ${error.message}`, 'error');
        return false;
      }
      setSavings((prev) => prev.filter((s) => s.id !== id));
      toast('Savings entry deleted', 'success');
      return true;
    },
    [toast],
  );

  // ── Derived totals ──
  const totalInvested = savings.reduce((s, e) => s + e.amountInvested, 0);
  const totalCurrent = savings.reduce((s, e) => s + e.currentValue, 0);
  const totalGain = totalCurrent - totalInvested;
  const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return {
    savings,
    loading,
    add,
    update,
    remove,
    totalInvested,
    totalCurrent,
    totalGain,
    gainPct,
  };
}
