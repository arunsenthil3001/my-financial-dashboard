'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
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
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Chit-specific columns (null for non-chit)
  chit_members: number | null;
  chit_face_value: string | number | null;
  chit_duration_months: number | null;
  chit_bid_frequency: number | null;
  chit_won_cycle: number | null;
  chit_bid_received: string | number | null;
  chit_is_foreman: boolean | null;
  // Multi-currency
  remittance_id: string | null;
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
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chitMembers:        row.chit_members        !== null ? Number(row.chit_members)        : null,
    chitFaceValue:      row.chit_face_value      !== null ? Number(row.chit_face_value)      : null,
    chitDurationMonths: row.chit_duration_months !== null ? Number(row.chit_duration_months) : null,
    chitBidFrequency:   row.chit_bid_frequency   !== null ? Number(row.chit_bid_frequency)   : null,
    chitWonCycle:       row.chit_won_cycle        !== null ? Number(row.chit_won_cycle)        : null,
    chitBidReceived:    row.chit_bid_received     !== null ? Number(row.chit_bid_received)     : null,
    chitIsForeman:      row.chit_is_foreman       ?? null,
    remittanceId:       row.remittance_id          ?? null,
  };
}

type SavingsInput = Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>;

function inputToRow(input: SavingsInput) {
  // NOTE: remittance_id is intentionally excluded here.
  // It is patched separately via linkToRemittance() once the
  // DB migration (add_remittance_links.sql) has been run.
  return {
    name: input.name,
    type: input.type,
    amount_invested: input.amountInvested,
    current_value: input.currentValue,
    start_date: input.startDate,
    notes: input.notes,
    chit_members:         input.chitMembers         ?? null,
    chit_face_value:      input.chitFaceValue        ?? null,
    chit_duration_months: input.chitDurationMonths   ?? null,
    chit_bid_frequency:   input.chitBidFrequency     ?? null,
    chit_won_cycle:       input.chitWonCycle          ?? null,
    chit_bid_received:    input.chitBidReceived        ?? null,
    chit_is_foreman:      input.chitIsForeman          ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSavings() {
  const [savings, setSavings] = useState<SavingsEntry[]>([]);
  const [loading, setLoading]  = useState(true);
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

  useEffect(() => { load(); }, [load]);

  // ── Insert — returns the new entry (truthy) or null (error) ──
  const add = useCallback(
    async (input: SavingsInput): Promise<SavingsEntry | null> => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('savings')
        .insert({ ...inputToRow(input), user_id: userId })
        .select()
        .single();

      if (error) {
        toast(`Failed to add savings: ${error.message}`, 'error');
        return null;
      }
      const entry = rowToEntry(data as SavingsRow);
      setSavings((prev) => [entry, ...prev]);
      toast('Savings entry added', 'success');
      return entry;
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

  // ── Link to remittance (patches only remittance_id — requires migration) ──
  const linkToRemittance = useCallback(
    async (id: string, remittanceId: string | null): Promise<boolean> => {
      const { error } = await supabase
        .from('savings')
        .update({ remittance_id: remittanceId })
        .eq('id', id);
      if (error) {
        toast(`Failed to link savings: ${error.message}`, 'error');
        return false;
      }
      setSavings((prev) =>
        prev.map((s) => (s.id === id ? { ...s, remittanceId } : s)),
      );
      return true;
    },
    [toast],
  );

  // ── Derived totals ──
  const totalInvested = savings.reduce((s, e) => s + e.amountInvested, 0);
  const totalCurrent  = savings.reduce((s, e) => s + e.currentValue,   0);
  const totalGain     = totalCurrent - totalInvested;
  const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return { savings, loading, add, update, remove, linkToRemittance, totalInvested, totalCurrent, totalGain, gainPct };
}
