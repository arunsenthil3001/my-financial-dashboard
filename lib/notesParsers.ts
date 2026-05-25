/**
 * notesParsers.ts
 * Pure functions to parse the JSON stored in savings.notes and compute
 * derived values for FD, Chit Fund, and Mutual Fund entries.
 * No React, no side-effects — safe to import anywhere.
 */

import { addMonths } from './utils';

// ── FD ────────────────────────────────────────────────────────────────────────

export type CompoundFrequency = 'quarterly' | 'monthly' | 'annually';

export interface FDMeta {
  interest_rate: number;       // % p.a.
  tenure_months: number;
  compound_frequency: CompoundFrequency;
}

export function parseFDMeta(notes: string): FDMeta | null {
  try {
    const o = JSON.parse(notes);
    if (typeof o?.interest_rate === 'number' && typeof o?.tenure_months === 'number') {
      return o as FDMeta;
    }
    return null;
  } catch { return null; }
}

/** A = P × (1 + r/n)^(n·t) */
export function calcFDValue(principal: number, meta: FDMeta): number {
  if (!principal || !meta.interest_rate || !meta.tenure_months) return 0;
  const r = meta.interest_rate / 100;
  const n = meta.compound_frequency === 'monthly' ? 12
          : meta.compound_frequency === 'quarterly' ? 4 : 1;
  const t = meta.tenure_months / 12;
  return principal * Math.pow(1 + r / n, n * t);
}

export function fdMaturityDate(startDate: string, tenureMonths: number): string {
  if (!startDate || !tenureMonths) return '';
  return addMonths(startDate, tenureMonths);
}

// ── Chit Fund ─────────────────────────────────────────────────────────────────

export interface ChitMeta {
  total_members: number;
  monthly_contribution: number;
  total_duration_months: number;
  bid_interval: number;           // total_duration_months / total_members
  foreman_commission_pct: number;
  is_foreman: boolean;
  bids_completed: number;
  amount_paid_so_far: number;
  user_has_taken_bid: boolean;
  accumulated_dividend: number;
  which_bid_number: number | null;
  amount_received: number | null;
}

export function parseChitMeta(notes: string): ChitMeta | null {
  try {
    const o = JSON.parse(notes);
    if (typeof o?.total_members === 'number' && typeof o?.monthly_contribution === 'number') {
      return o as ChitMeta;
    }
    return null;
  } catch { return null; }
}

export function chitPoolPerBid(meta: ChitMeta): number {
  return meta.total_members * meta.monthly_contribution * meta.bid_interval;
}

/** ISO date of the next bid */
export function chitNextBidDate(startDate: string, meta: ChitMeta): string {
  if (!startDate) return '';
  return addMonths(startDate, meta.bids_completed * meta.bid_interval);
}

/** ISO date when the chit closes */
export function chitEndDate(startDate: string, meta: ChitMeta): string {
  if (!startDate) return '';
  return addMonths(startDate, meta.total_duration_months);
}

/**
 * Net current value:
 *   foreman / bid-taken → amount_received − amount_paid_so_far
 *   not taken           → amount_paid_so_far   (break-even proxy)
 */
export function calcChitCurrentValue(meta: ChitMeta): number {
  if (meta.is_foreman) {
    const pool = chitPoolPerBid(meta);
    return pool - meta.amount_paid_so_far;
  }
  if (meta.user_has_taken_bid && meta.amount_received !== null) {
    return meta.amount_received - meta.amount_paid_so_far;
  }
  return meta.amount_paid_so_far;
}

/**
 * Effective monthly payment:
 *   bid taken (non-foreman) → full monthly_contribution
 *   not taken               → monthly_contribution − accumulated_dividend / bid_interval
 */
export function calcChitMonthlyPayment(meta: ChitMeta): number {
  if (meta.is_foreman || meta.user_has_taken_bid) return meta.monthly_contribution;
  const reduction = meta.bid_interval > 0 ? meta.accumulated_dividend / meta.bid_interval : 0;
  return Math.max(0, meta.monthly_contribution - reduction);
}

export function chitMonthsRemaining(meta: ChitMeta): number {
  return meta.total_duration_months - meta.bids_completed * meta.bid_interval;
}

export interface ChitBidRow {
  discount: number;
  youReceive: number;
  dividendPerMember: number;
}

export function chitBidTable(meta: ChitMeta): ChitBidRow[] {
  const pool = chitPoolPerBid(meta);
  const commission = (pool * meta.foreman_commission_pct) / 100;
  const usable = pool - commission;
  return [10, 20, 30, 40].map((discount) => ({
    discount,
    youReceive: usable * (1 - discount / 100),
    dividendPerMember: (usable * (discount / 100)) / meta.total_members,
  }));
}

// ── Mutual Funds ──────────────────────────────────────────────────────────────

export interface MFMeta {
  folio: string;
  scheme_name: string;
  units: number;
  nav_at_purchase: number;
  current_nav: number;
  scheme_code: number | null;
  nav_updated_date: string;
}

export function parseMFMeta(notes: string): MFMeta | null {
  try {
    const o = JSON.parse(notes);
    if (typeof o?.scheme_name === 'string' && typeof o?.units === 'number') {
      return o as MFMeta;
    }
    return null;
  } catch { return null; }
}
