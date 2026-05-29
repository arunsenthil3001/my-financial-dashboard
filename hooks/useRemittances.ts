'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { useToast } from '@/components/ui/Toaster';
import type { RemittanceEntry } from '@/lib/types';

// ── DB shape ──────────────────────────────────────────────────────────────────

interface RemittanceRow {
  id: string;
  transfer_date: string;
  from_currency: string;
  to_currency: string;
  from_amount: string | number;
  to_amount: string | number;
  rate_used: string | number;
  channel: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: RemittanceRow): RemittanceEntry {
  return {
    id: row.id,
    transferDate: row.transfer_date,
    fromCurrency: row.from_currency,
    toCurrency: row.to_currency,
    fromAmount: Number(row.from_amount),
    toAmount: Number(row.to_amount),
    rateUsed: Number(row.rate_used),
    channel: row.channel,
    reference: row.reference,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type RemittanceInput = Omit<RemittanceEntry, 'id' | 'createdAt' | 'updatedAt'>;

function inputToRow(input: RemittanceInput) {
  return {
    transfer_date: input.transferDate,
    from_currency: input.fromCurrency,
    to_currency: input.toCurrency,
    from_amount: input.fromAmount,
    to_amount: input.toAmount,
    rate_used: input.rateUsed,
    channel: input.channel ?? null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRemittances() {
  const [remittances, setRemittances] = useState<RemittanceEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('remittances')
      .select('*')
      .order('transfer_date', { ascending: false });

    if (error) {
      console.warn('useRemittances load:', error.message);
    } else {
      setRemittances((data as RemittanceRow[]).map(rowToEntry));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(
    async (input: RemittanceInput): Promise<RemittanceEntry | null> => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('remittances')
        .insert({ ...inputToRow(input), user_id: userId })
        .select()
        .single();

      if (error) {
        toast(`Failed to add transfer: ${error.message}`, 'error');
        return null;
      }
      const entry = rowToEntry(data as RemittanceRow);
      setRemittances((prev) => [entry, ...prev]);
      toast('Transfer recorded', 'success');
      return entry;
    },
    [toast],
  );

  const update = useCallback(
    async (id: string, input: RemittanceInput): Promise<boolean> => {
      const { data, error } = await supabase
        .from('remittances')
        .update(inputToRow(input))
        .eq('id', id)
        .select()
        .single();

      if (error) {
        toast(`Failed to update transfer: ${error.message}`, 'error');
        return false;
      }
      setRemittances((prev) =>
        prev.map((r) => (r.id === id ? rowToEntry(data as RemittanceRow) : r)),
      );
      toast('Transfer updated', 'success');
      return true;
    },
    [toast],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('remittances').delete().eq('id', id);
      if (error) {
        toast(`Failed to delete transfer: ${error.message}`, 'error');
        return false;
      }
      setRemittances((prev) => prev.filter((r) => r.id !== id));
      toast('Transfer deleted', 'success');
      return true;
    },
    [toast],
  );

  // ── Derived totals ──
  const totalSent     = remittances.reduce((s, r) => s + r.fromAmount, 0);
  const totalReceived = remittances.reduce((s, r) => s + r.toAmount,   0);

  return {
    remittances,
    loading,
    add,
    update,
    remove,
    reload: load,
    totalSent,
    totalReceived,
  };
}
