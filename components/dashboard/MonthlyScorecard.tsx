'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { isThisMonth } from '@/lib/utils';
import { formatAmount } from '@/lib/currencies';
import type { ExpenseEntry, RemittanceEntry, SalaryEntry, SavingsEntry } from '@/lib/types';

interface Props {
  salary: SalaryEntry | null;
  expenses: ExpenseEntry[];
  remittances: RemittanceEntry[];
  savings: SavingsEntry[];
  homeCurrency: string;
  earningCurrency: string;
  liveRate: number | null;
}

export default function MonthlyScorecard({
  salary, expenses, remittances, savings,
  homeCurrency, earningCurrency, liveRate,
}: Props) {
  const [showEarning, setShowEarning] = useState(true);
  const sameC = earningCurrency === homeCurrency;
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const sc = useMemo(() => {
    const thisMonthRemittances = remittances.filter(
      r => isThisMonth(r.transferDate) &&
           r.fromCurrency === earningCurrency &&
           r.toCurrency === homeCurrency,
    );
    const thisMonthExp = expenses.filter(e => isThisMonth(e.date));

    // Abroad = spent in earning currency this month
    const abroadE = thisMonthExp
      .filter(e => e.currency === earningCurrency)
      .reduce((s, e) => s + (e.foreignAmount ?? e.originalAmount), 0);

    const remittedE = thisMonthRemittances.reduce((s, r) => s + r.fromAmount, 0);
    const remittedH = thisMonthRemittances.reduce((s, r) => s + r.toAmount, 0);

    const remittanceIds = new Set(thisMonthRemittances.map(r => r.id));

    // Savings linked to this month's remittances
    const investedH = savings
      .filter(sv => sv.remittanceId !== null && remittanceIds.has(sv.remittanceId as string))
      .reduce((s, sv) => s + sv.amountInvested, 0);

    // Home expenses this month: home-currency transactions OR linked to any remittance
    const homeExpH = thisMonthExp
      .filter(e => e.currency === homeCurrency || e.remittanceId !== null)
      .reduce((s, e) => s + e.homeAmount, 0);

    const unallocH = Math.max(0, remittedH - investedH - homeExpH);
    const salaryE = salary?.netAmount ?? null;
    const keptE = salaryE !== null ? salaryE - abroadE - remittedE : null;

    return { abroadE, remittedE, remittedH, investedH, homeExpH, unallocH, salaryE, keptE };
  }, [salary, expenses, remittances, savings, homeCurrency, earningCurrency]);

  // Top-level rows: earning or home currency depending on toggle
  const fmtTop = (v: number): string =>
    sameC || showEarning
      ? formatAmount(v, earningCurrency)
      : formatAmount(v * (liveRate ?? 1), homeCurrency);

  const fmtH = (v: number): string => formatAmount(v, homeCurrency);

  // ─── State 1: No salary ──────────────────────────────────────────────────────
  if (!salary) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Monthly Scorecard</h2>
        <p className="text-xs text-gray-400">
          Add your salary in{' '}
          <Link href="/settings" className="text-indigo-600 hover:underline">Settings</Link>
          {' '}to see where your money goes each month.
        </p>
      </div>
    );
  }

  const { abroadE, remittedE, remittedH, investedH, homeExpH, unallocH, salaryE, keptE } = sc;

  // ─── State 2: No remittance this month ───────────────────────────────────────
  if (remittedH === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Monthly Scorecard</h2>
          <span className="text-xs text-gray-400">{monthLabel}</span>
        </div>
        <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-3 py-2.5">
          <span className="text-xs text-indigo-600 font-medium">Salary</span>
          <span className="text-sm font-bold text-indigo-900">{formatAmount(salaryE!, earningCurrency)}</span>
        </div>
        <p className="text-xs text-gray-400 text-center py-1">No transfers recorded yet this month.</p>
      </div>
    );
  }

  // ─── States 3 / 4 / 5: Full waterfall ────────────────────────────────────────
  const isOverRemitted  = keptE !== null && keptE < -0.01;
  const isFullyRemitted = keptE !== null && Math.abs(keptE) <= 0.01;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Monthly Scorecard</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{monthLabel}</span>
          {!sameC && (
            <button
              onClick={() => setShowEarning(v => !v)}
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              {showEarning ? earningCurrency : homeCurrency}
            </button>
          )}
        </div>
      </div>

      {/* Waterfall */}
      <div className="space-y-0.5">
        {/* Salary */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm font-semibold text-gray-800">Salary</span>
          <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtTop(salaryE!)}</span>
        </div>

        {/* Level-1 children */}
        <div className="ml-2 pl-3 border-l-2 border-gray-100 space-y-0.5">
          {/* Abroad expenses */}
          {abroadE > 0 && (
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-gray-500">Abroad expenses</span>
              <span className="text-xs font-medium text-orange-600 tabular-nums">−{fmtTop(abroadE)}</span>
            </div>
          )}

          {/* Remitted home */}
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-medium text-gray-700">Remitted home</span>
            <span className="text-xs font-semibold text-emerald-700 tabular-nums">−{fmtTop(remittedE)}</span>
          </div>

          {/* Level-2: always home currency */}
          <div className="ml-2 pl-3 border-l-2 border-emerald-100 space-y-0.5 pb-1">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-xs text-gray-400">Invested</span>
              <span className="text-xs text-gray-600 tabular-nums">{fmtH(investedH)}</span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-xs text-gray-400">Home expenses</span>
              <span className="text-xs text-gray-600 tabular-nums">{fmtH(homeExpH)}</span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className={`text-xs ${unallocH > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                Unallocated{unallocH > 0 ? ' ⚠' : ''}
              </span>
              <span className={`text-xs tabular-nums ${unallocH > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                {fmtH(unallocH)}
              </span>
            </div>
          </div>

          {/* Kept / Over / Fully remitted */}
          {keptE !== null && (
            <div className="flex items-center justify-between py-1 mt-0.5 border-t border-dashed border-gray-100">
              {isFullyRemitted ? (
                <>
                  <span className="text-xs font-medium text-emerald-600">Fully remitted ✓</span>
                  <span className="text-xs text-emerald-500 tabular-nums">—</span>
                </>
              ) : isOverRemitted ? (
                <>
                  <span className="text-xs font-semibold text-red-600">Over-remitted ⚠</span>
                  <span className="text-xs font-semibold text-red-600 tabular-nums">{fmtTop(Math.abs(keptE))} over</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium text-indigo-600">Kept in {earningCurrency}</span>
                  <span className="text-xs font-semibold text-indigo-700 tabular-nums">{fmtTop(keptE)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
