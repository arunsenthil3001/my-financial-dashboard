'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { isThisMonth } from '@/lib/utils';
import { formatAmount } from '@/lib/formatNumber';
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

function pctStr(num: number, denom: number): string {
  if (!denom || !isFinite(num / denom)) return '';
  return `${Math.round((num / denom) * 100)}%`;
}

interface RowProps {
  tree: string;
  label: string;
  amount: string;
  pct?: string;
  labelClass?: string;
  amtClass?: string;
}

function Row({ tree, label, amount, pct, labelClass = 'text-gray-600', amtClass = 'text-gray-700' }: RowProps) {
  return (
    <div className="flex items-baseline gap-1 py-0.5">
      <span className="font-mono text-gray-300 text-xs w-4 shrink-0 select-none">{tree}</span>
      <span className={`text-xs flex-1 ${labelClass}`}>{label}</span>
      <span className={`text-xs tabular-nums font-medium ${amtClass} text-right`}>{amount}</span>
      <span className="text-xs tabular-nums text-gray-400 w-9 text-right shrink-0">{pct ?? ''}</span>
    </div>
  );
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

    const abroadE = thisMonthExp
      .filter(e => e.currency === earningCurrency)
      .reduce((s, e) => s + (e.foreignAmount ?? e.originalAmount), 0);

    const remittedE = thisMonthRemittances.reduce((s, r) => s + r.fromAmount, 0);
    const remittedH = thisMonthRemittances.reduce((s, r) => s + r.toAmount, 0);

    const remittanceIds = new Set(thisMonthRemittances.map(r => r.id));

    const investedH = savings
      .filter(sv => sv.remittanceId !== null && remittanceIds.has(sv.remittanceId as string))
      .reduce((s, sv) => s + sv.amountInvested, 0);

    const homeExpH = thisMonthExp
      .filter(e => e.currency === homeCurrency || e.remittanceId !== null)
      .reduce((s, e) => s + e.homeAmount, 0);

    const unallocH = Math.max(0, remittedH - investedH - homeExpH);
    const salaryE  = salary?.netAmount ?? null;
    const keptE    = salaryE !== null ? salaryE - abroadE - remittedE : null;

    return { abroadE, remittedE, remittedH, investedH, homeExpH, unallocH, salaryE, keptE };
  }, [salary, expenses, remittances, savings, homeCurrency, earningCurrency]);

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
  const rate = (liveRate != null && liveRate > 0) ? liveRate : 1;

  // Convert earning-currency value to display (respecting toggle)
  const fmtE = (v: number) =>
    sameC || showEarning
      ? formatAmount(v, earningCurrency)
      : formatAmount(v * rate, homeCurrency);

  const fmtH = (v: number) => formatAmount(v, homeCurrency);

  // ─── State 2: No remittance this month ───────────────────────────────────────
  if (remittedH === 0) {
    const availableE = salaryE! - abroadE;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Monthly Scorecard</h2>
          <span className="text-xs text-gray-400">{monthLabel}</span>
        </div>
        <div className="flex items-baseline gap-1 py-0.5">
          <span className="font-mono text-gray-300 text-xs w-4 shrink-0 select-none"> </span>
          <span className="text-xs font-semibold flex-1 text-gray-800">Salary</span>
          <span className="text-xs tabular-nums font-bold text-gray-900 text-right">{fmtE(salaryE!)}</span>
          <span className="text-xs tabular-nums text-gray-400 w-9 text-right shrink-0">100%</span>
        </div>
        {abroadE > 0 && (
          <Row tree="├─" label="Abroad expenses" amount={`−${fmtE(abroadE)}`}
            pct={pctStr(abroadE, salaryE!)} amtClass="text-orange-600" />
        )}
        <Row tree="└─" label="Available to remit" amount={fmtE(availableE)}
          pct={pctStr(availableE, salaryE!)} labelClass="text-indigo-600 font-medium" amtClass="text-indigo-700 font-semibold" />
        <p className="text-xs text-gray-400 text-center pt-1">No transfers recorded yet this month.</p>
      </div>
    );
  }

  // ─── States 3 / 4 / 5 ────────────────────────────────────────────────────────
  const isOverRemitted  = keptE !== null && keptE < -0.01;
  const isFullyRemitted = keptE !== null && Math.abs(keptE) <= 0.01;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
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

      {/* Salary row */}
      <div className="flex items-baseline gap-1 py-0.5">
        <span className="font-mono text-gray-300 text-xs w-4 shrink-0 select-none"> </span>
        <span className="text-xs font-semibold flex-1 text-gray-800">Salary</span>
        <span className="text-xs tabular-nums font-bold text-gray-900 text-right">{fmtE(salaryE!)}</span>
        <span className="text-xs tabular-nums text-gray-400 w-9 text-right shrink-0">100%</span>
      </div>

      {/* Abroad expenses */}
      {abroadE > 0 && (
        <Row tree="├─" label="Abroad expenses" amount={`−${fmtE(abroadE)}`}
          pct={pctStr(abroadE, salaryE!)} amtClass="text-orange-600" />
      )}

      {/* Remitted home */}
      <Row
        tree={isOverRemitted || isFullyRemitted || keptE === null || (keptE <= 0.01 && !isOverRemitted) ? '├─' : '├─'}
        label="Remitted home"
        amount={`−${fmtE(remittedE)}`}
        pct={pctStr(remittedE, salaryE!)}
        labelClass="text-gray-700 font-medium"
        amtClass="text-emerald-700 font-semibold"
      />

      {/* Level-2: home currency breakdown */}
      <div className="ml-4 space-y-0">
        <Row tree="│ ├─" label="Invested" amount={fmtH(investedH)}
          pct={pctStr(investedH, remittedH)} labelClass="text-gray-500" amtClass="text-gray-600" />
        <Row tree="│ ├─" label="Home expenses" amount={fmtH(homeExpH)}
          pct={pctStr(homeExpH, remittedH)} labelClass="text-gray-500" amtClass="text-gray-600" />
        <Row
          tree="│ └─"
          label={unallocH > 0 ? 'Unallocated ⚠' : 'Unallocated'}
          amount={fmtH(unallocH)}
          pct={pctStr(unallocH, remittedH)}
          labelClass={unallocH > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}
          amtClass={unallocH > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'}
        />
      </div>

      {/* Kept / Over / Fully remitted */}
      {keptE !== null && (
        isFullyRemitted ? (
          <Row tree="└─" label="Fully remitted ✓" amount="—"
            labelClass="text-emerald-600 font-medium" amtClass="text-emerald-500" />
        ) : isOverRemitted ? (
          <>
            <Row tree="└─" label="Used from prev. savings" amount={`${fmtE(Math.abs(keptE))} over`}
              pct={pctStr(Math.abs(keptE), salaryE!)} labelClass="text-red-600 font-semibold" amtClass="text-red-600 font-semibold" />
          </>
        ) : (
          <Row tree="└─" label={`Kept in ${earningCurrency}`} amount={fmtE(keptE)}
            pct={pctStr(keptE, salaryE!)} labelClass="text-indigo-600 font-medium" amtClass="text-indigo-700 font-semibold" />
        )
      )}
    </div>
  );
}
