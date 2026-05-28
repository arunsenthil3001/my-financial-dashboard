/**
 * Shared formula for computing unallocated remittance funds.
 * Used by both the Dashboard widget and the Transfers page.
 */

import type { ExpenseEntry, RemittanceEntry, SavingsEntry } from './types';

/** Unallocated amount for a single remittance */
export function calcRemittanceUnallocated(
  remittance: RemittanceEntry,
  expenses: ExpenseEntry[],
  savings: SavingsEntry[],
): number {
  const linkedExp = expenses
    .filter((e) => e.remittanceId === remittance.id)
    .reduce((s, e) => s + e.homeAmount, 0);
  const linkedSav = savings
    .filter((sv) => sv.remittanceId === remittance.id)
    .reduce((s, sv) => s + sv.amountInvested, 0);
  return Math.max(0, remittance.toAmount - linkedExp - linkedSav);
}

/** Total unallocated across all home-currency remittances */
export function calcTotalUnallocated(
  remittances: RemittanceEntry[],
  expenses: ExpenseEntry[],
  savings: SavingsEntry[],
  homeCurrency: string,
): number {
  return remittances
    .filter((r) => r.toCurrency === homeCurrency)
    .reduce((sum, r) => sum + calcRemittanceUnallocated(r, expenses, savings), 0);
}
