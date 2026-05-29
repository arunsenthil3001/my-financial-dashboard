'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { useToast } from '@/components/ui/Toaster';
import type { SalaryEntry } from '@/lib/types';
import { todayISO } from '@/lib/utils';

interface SalaryRow {
  id: string;
  net_amount: string | number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
}

function rowToEntry(row: SalaryRow): SalaryEntry {
  return {
    id: row.id,
    netAmount: Number(row.net_amount),
    currency: row.currency,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export type SalaryInput = Omit<SalaryEntry, 'id' | 'createdAt'>;

export function useSalary() {
  const [salary, setSalary] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('salary_history')
      .select('*')
      .order('effective_from', { ascending: false });

    if (error) {
      console.warn('useSalary load:', error.message);
    } else {
      setSalary((data as SalaryRow[]).map(rowToEntry));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Current (most recent, effective_to IS NULL) salary row */
  const current = salary.find((s) => s.effectiveTo === null) ?? null;

  /** Close current salary and start a new one */
  const closeCurrentAndAdd = useCallback(
    async (input: SalaryInput): Promise<boolean> => {
      // Close existing current
      const existing = salary.find((s) => s.effectiveTo === null);
      if (existing) {
        const { error: closeErr } = await supabase
          .from('salary_history')
          .update({ effective_to: input.effectiveFrom })
          .eq('id', existing.id);
        if (closeErr) {
          toast(`Failed to close current salary: ${closeErr.message}`, 'error');
          return false;
        }
      }

      // Insert new
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('salary_history')
        .insert({
          net_amount: input.netAmount,
          currency: input.currency,
          effective_from: input.effectiveFrom,
          effective_to: null,
          notes: input.notes,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        toast(`Failed to add salary: ${error.message}`, 'error');
        return false;
      }
      await load();
      toast('Salary updated', 'success');
      return true;
    },
    [salary, load, toast],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('salary_history').delete().eq('id', id);
      if (error) {
        toast(`Failed to delete salary record: ${error.message}`, 'error');
        return false;
      }
      setSalary((prev) => prev.filter((s) => s.id !== id));
      toast('Salary record deleted', 'success');
      return true;
    },
    [toast],
  );

  return { salary, current, loading, closeCurrentAndAdd, remove, reload: load };
}
