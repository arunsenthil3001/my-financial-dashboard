/**
 * chitFundCalc.ts
 * Pure utility functions for chit fund gain/status calculations.
 * Uses dedicated DB columns (not JSON notes) — no React, no side-effects.
 */

import { addMonths } from './utils';
import type { SavingsEntry, ChitCycle } from './types';

// ── How many bid cycles have elapsed since startDate ─────────────────────────

export function elapsedCycles(startDate: string, bidFrequency: number): number {
  if (!startDate || bidFrequency <= 0) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return Math.max(0, Math.floor(monthsDiff / bidFrequency));
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
      ? addMonths(saving.startDate, (cyclesCompleted + 1) * bidFrequency)
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
