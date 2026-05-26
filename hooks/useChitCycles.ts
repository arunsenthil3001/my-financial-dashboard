'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toaster';
import type { ChitCycle, ChitCycleInput } from '@/lib/types';

interface ChitCycleRow {
  id: string;
  saving_id: string;
  cycle_number: number;
  amount_paid: string | number;
  commission_received: string | number | null;
  total_commission: string | number | null;
  user_won: boolean;
  bid_amount_received: string | number | null;
  cycle_date: string | null;
  created_at: string;
}

function rowToCycle(row: ChitCycleRow): ChitCycle {
  return {
    id: row.id,
    savingId: row.saving_id,
    cycleNumber: row.cycle_number,
    amountPaid: Number(row.amount_paid),
    commissionReceived:
      row.commission_received !== null ? Number(row.commission_received) : null,
    totalCommission:
      row.total_commission !== null ? Number(row.total_commission) : null,
    userWon: row.user_won,
    bidAmountReceived:
      row.bid_amount_received !== null ? Number(row.bid_amount_received) : null,
    cycleDate: row.cycle_date,
    createdAt: row.created_at,
  };
}

export function useChitCycles() {
  const { toast } = useToast();

  /** Fetch all cycles for a saving (called on demand, not as effect) */
  const fetchCycles = useCallback(
    async (savingId: string): Promise<ChitCycle[]> => {
      const { data, error } = await supabase
        .from('chit_cycles')
        .select('*')
        .eq('saving_id', savingId)
        .order('cycle_number', { ascending: true });

      if (error) {
        toast(`Could not load chit cycles: ${error.message}`, 'error');
        return [];
      }
      return (data as ChitCycleRow[]).map(rowToCycle);
    },
    [toast],
  );

  /** Insert new cycle rows for a saving */
  const addCycles = useCallback(
    async (savingId: string, inputs: ChitCycleInput[]): Promise<boolean> => {
      if (!inputs.length) return true;
      const rows = inputs.map((c) => ({
        saving_id: savingId,
        cycle_number: c.cycleNumber,
        amount_paid: c.amountPaid,
        commission_received: c.commissionReceived,
        total_commission: c.totalCommission,
        user_won: c.userWon,
        bid_amount_received: c.bidAmountReceived,
        cycle_date: c.cycleDate,
      }));
      const { error } = await supabase.from('chit_cycles').insert(rows);
      if (error) {
        toast(`Failed to save cycle history: ${error.message}`, 'error');
        return false;
      }
      return true;
    },
    [toast],
  );

  /** Delete all existing cycles then insert fresh ones (for edit) */
  const replaceCycles = useCallback(
    async (savingId: string, inputs: ChitCycleInput[]): Promise<boolean> => {
      const { error: delErr } = await supabase
        .from('chit_cycles')
        .delete()
        .eq('saving_id', savingId);
      if (delErr) {
        toast(`Failed to update cycles: ${delErr.message}`, 'error');
        return false;
      }
      return addCycles(savingId, inputs);
    },
    [addCycles, toast],
  );

  return { fetchCycles, addCycles, replaceCycles };
}
