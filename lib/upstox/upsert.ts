/**
 * Server-side only — writes Upstox holdings into the savings table.
 * Never import this in client components.
 */

import { createClient } from '@supabase/supabase-js';
import type { StockHolding, MFHolding } from './sync';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface UpsertResult {
  synced: number;
  errors: string[];
}

// ── Private helper ─────────────────────────────────────────────────────────────

async function upsertHolding(
  type: 'Stocks' | 'Mutual Funds',
  name: string,
  amountInvested: number,
  currentValue: number,
  notes: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('savings')
    .select('id')
    .eq('name', name)
    .eq('type', type)
    .is('user_id', null)
    .maybeSingle();

  const row = existing as { id: string } | null;

  const payload = {
    name,
    type,
    amount_invested: amountInvested,
    current_value:   currentValue,
    notes,
    start_date:      new Date().toISOString().split('T')[0],
  };

  if (row) {
    await supabase.from('savings').update(payload).eq('id', row.id);
  } else {
    await supabase.from('savings').insert({ ...payload, user_id: null });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function upsertStockHoldings(holdings: StockHolding[]): Promise<UpsertResult> {
  const errors: string[] = [];
  let synced = 0;

  for (const h of holdings) {
    try {
      await upsertHolding(
        'Stocks',
        h.name,
        h.amountInvested,
        h.currentValue,
        `Synced from Upstox · ${h.quantity} shares @ ₹${h.averagePrice.toFixed(2)}`,
      );
      synced++;
    } catch (err) {
      errors.push(`Stock ${h.name}: ${String(err)}`);
    }
  }

  return { synced, errors };
}

export async function upsertMFHoldings(holdings: MFHolding[]): Promise<UpsertResult> {
  const errors: string[] = [];
  let synced = 0;

  for (const h of holdings) {
    try {
      await upsertHolding(
        'Mutual Funds',
        h.name,
        h.amountInvested,
        h.currentValue,
        `Synced from Upstox · ${h.units} units @ ₹${h.averageNav.toFixed(4)}`,
      );
      synced++;
    } catch (err) {
      errors.push(`MF ${h.name}: ${String(err)}`);
    }
  }

  return { synced, errors };
}
