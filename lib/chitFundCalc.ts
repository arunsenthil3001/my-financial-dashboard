/**
 * chitFundCalc.ts
 * Pure utility functions for chit fund gain/status calculations.
 * Uses dedicated DB columns (not JSON notes) — no React, no side-effects.
 */

import { addMonths } from './utils';
import type { SavingsEntry, ChitCycle } from './types';

// ── How many bid cycles have elapsed since startDate ─────────────────────────
//
// A cycle N is considered completed if its scheduled date is strictly before today:
//   Cycle 1 (foreman): scheduled at startDate            → completed if startDate < today
//   Cycle 2:           scheduled at startDate + 1×bf     → completed if that date < today
//   Cycle N:           scheduled at startDate + (N-1)×bf → completed if that date < today
//
// The old month-arithmetic approach (floor(monthsDiff / bf)) was off by one whenever
// the Nth cycle's actual date had passed but the raw month count hadn't yet crossed
// the next multiple (e.g. 17 months elapsed, bf=6 → floor=2, but cycle 3 date
// (startDate+12 months) had already passed).

export function elapsedCycles(startDate: string, bidFrequency: number): number {
  if (!startDate || bidFrequency <= 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  while (count < 1000) {
    // Cycle (count+1) is scheduled at startDate + count * bidFrequency months
    const cycleDate = new Date(addMonths(startDate, count * bidFrequency));
    cycleDate.setHours(0, 0, 0, 0);
    if (cycleDate >= today) break; // this cycle hasn't happened yet
    count++;
  }
  return count;
}

// ── Full gain calculation ─────────────────────────────────────────────────────

export interface ChitGainResult {
  totalPaid: number;
  projectedRemaining: number;
  totalCommitted: number;
  bidReceived: number;
  netGain: number | null;
  gainPct: number | null;
  nextBidDate: string | null;
  hasWon: boolean;
  remainingCycles: number;
  cyclesCompleted: number;
  totalCycles: number;
}

export function calcChitGain(
  saving: SavingsEntry,
  cycles: ChitCycle[],
): ChitGainResult {
  const faceValue      = saving.chitFaceValue      ?? 0;
  const durationMonths = saving.chitDurationMonths ?? 0;
  const bidFrequency   = saving.chitBidFrequency   ?? 1;
  const totalCycles    = bidFrequency > 0 ? Math.round(durationMonths / bidFrequency) : 0;
  const cyclesCompleted = cycles.length;
  const remainingCycles = Math.max(0, totalCycles - cyclesCompleted);

  const totalPaid  = cycles.reduce((s, c) => s + c.amountPaid, 0);
  const wonCycle   = cycles.find((c) => c.userWon);
  const bidReceived =
    wonCycle?.bidAmountReceived ?? saving.chitBidReceived ?? 0;
  const hasWon = !!wonCycle || (saving.chitIsForeman ?? false);

  const projectedRemaining = remainingCycles * faceValue;
  const totalCommitted     = totalPaid + projectedRemaining;
  const netGain  = bidReceived > 0 ? bidReceived - totalCommitted : null;
  const gainPct  = netGain !== null && totalCommitted > 0
    ? (netGain / totalCommitted) * 100 : null;

  const nextBidDate =
    saving.startDate && bidFrequency > 0
      ? addMonths(saving.startDate, cyclesCompleted * bidFrequency)
      : null;

  return {
    totalPaid,
    projectedRemaining,
    totalCommitted,
    bidReceived,
    netGain,
    gainPct,
    nextBidDate,
    hasWon,
    remainingCycles,
    cyclesCompleted,
    totalCycles,
  };
}

// ── Derive current value for savings row ─────────────────────────────────────
// amountInvested = totalPaid, currentValue = bidReceived (won) | totalPaid (ongoing)
// → gain = currentValue − amountInvested = net gain or 0

export function chitCurrentValueForRow(
  totalPaid: number,
  hasWon: boolean,
  bidReceived: number,
): number {
  return hasWon ? bidReceived : totalPaid;
}
