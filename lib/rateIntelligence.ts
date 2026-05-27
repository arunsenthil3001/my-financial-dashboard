import { supabase } from '@/lib/supabase';
import type { RemittanceEntry } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateHistoryPoint {
  rate: number;
  fetchedAt: string; // ISO string
}

export interface BaselineResult {
  baseline: number;
  source: 'remittance_history' | 'rate_history';
}

export interface RateContext {
  todayRate: number | null;
  baseline: number | null;
  baselineSource: 'remittance_history' | 'rate_history' | null;
  differenceAbs: number | null;
  differencePct: number | null;
  shouldAlert: boolean;
  trend: 'up' | 'down' | 'flat';
  projectedGain: (foreignAmount: number) => number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** True when currentRate is at or above baseline by at least thresholdPct percent. */
export function shouldAlert(
  currentRate: number,
  baseline: number,
  thresholdPct: number,
): boolean {
  return currentRate >= baseline * (1 + thresholdPct / 100);
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

/** Arithmetic mean of rate_snapshots for the pair over the last 90 days. Returns null if no data. */
export async function get90DayAverage(
  earningCurrency: string,
  homeCurrency: string,
): Promise<number | null> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabase
    .from('rate_snapshots')
    .select('rate')
    .eq('from_currency', earningCurrency)
    .eq('to_currency', homeCurrency)
    .gte('fetched_at', since.toISOString());

  if (error || !data || data.length < 1) return null;
  const sum = data.reduce((s, r) => s + Number(r.rate), 0);
  return sum / data.length;
}

/**
 * Baseline from remittance history (avg rateUsed for the pair) or rate history (90-day average).
 * Returns null if neither source has data.
 */
export async function getBaseline(
  earningCurrency: string,
  homeCurrency: string,
  remittances: RemittanceEntry[],
): Promise<BaselineResult | null> {
  const pairRemittances = remittances.filter(
    (r) => r.fromCurrency === earningCurrency && r.toCurrency === homeCurrency,
  );

  if (pairRemittances.length > 0) {
    const avg = pairRemittances.reduce((s, r) => s + r.rateUsed, 0) / pairRemittances.length;
    return { baseline: avg, source: 'remittance_history' };
  }

  const avg = await get90DayAverage(earningCurrency, homeCurrency);
  if (avg === null) return null;
  return { baseline: avg, source: 'rate_history' };
}

/** Last 90 days of rate snapshots, ascending by time, for line chart rendering. */
export async function getRateHistory(
  earningCurrency: string,
  homeCurrency: string,
): Promise<RateHistoryPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabase
    .from('rate_snapshots')
    .select('rate, fetched_at')
    .eq('from_currency', earningCurrency)
    .eq('to_currency', homeCurrency)
    .gte('fetched_at', since.toISOString())
    .order('fetched_at', { ascending: true });

  if (error || !data) return [];
  return data.map((r) => ({ rate: Number(r.rate), fetchedAt: r.fetched_at as string }));
}

/**
 * Full rate intelligence context for the dashboard and remittances page.
 * Reads today's rate from the latest rate_snapshot (written by cron — never fetches externally).
 */
export async function getRateContext(
  earningCurrency: string,
  homeCurrency: string,
  remittances: RemittanceEntry[],
  thresholdPct: number = 1.0,
): Promise<RateContext> {
  // ── Latest rate from cron-written snapshots ──
  const { data: latestSnapshot } = await supabase
    .from('rate_snapshots')
    .select('rate, fetched_at')
    .eq('from_currency', earningCurrency)
    .eq('to_currency', homeCurrency)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const todayRate = latestSnapshot ? Number(latestSnapshot.rate) : null;

  // ── Baseline ──
  const baselineResult = await getBaseline(earningCurrency, homeCurrency, remittances);
  const baseline       = baselineResult?.baseline ?? null;
  const baselineSource = baselineResult?.source   ?? null;

  // ── Differences ──
  const differenceAbs =
    todayRate !== null && baseline !== null ? todayRate - baseline : null;
  const differencePct =
    differenceAbs !== null && baseline !== null && baseline > 0
      ? (differenceAbs / baseline) * 100
      : null;

  const alert =
    todayRate !== null && baseline !== null
      ? shouldAlert(todayRate, baseline, thresholdPct)
      : false;

  // ── Trend: compare last two snapshots ──
  const { data: recent } = await supabase
    .from('rate_snapshots')
    .select('rate')
    .eq('from_currency', earningCurrency)
    .eq('to_currency', homeCurrency)
    .order('fetched_at', { ascending: false })
    .limit(2);

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (recent && recent.length === 2) {
    const diff = Number(recent[0].rate) - Number(recent[1].rate);
    if (Math.abs(diff) > 0.00001) {
      trend = diff > 0 ? 'up' : 'down';
    }
  }

  const projectedGain = (foreignAmount: number): number => {
    if (todayRate === null || baseline === null) return 0;
    return (todayRate - baseline) * foreignAmount;
  };

  return {
    todayRate,
    baseline,
    baselineSource,
    differenceAbs,
    differencePct,
    shouldAlert: alert,
    trend,
    projectedGain,
  };
}
