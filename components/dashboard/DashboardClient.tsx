'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSavings } from '@/hooks/useSavings';
import { useExpenses } from '@/hooks/useExpenses';
import { formatCurrency, formatDate, formatShortDate, daysUntil, addMonths } from '@/lib/utils';
import { SAVINGS_TYPE_COLORS } from '@/lib/types';
import { EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_ICONS } from '@/lib/types';
import {
  parseFDMeta, fdMaturityDate,
  parseMFMeta,
} from '@/lib/notesParsers';
import { elapsedCycles } from '@/lib/chitFundCalc';
import Modal from '@/components/ui/Modal';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import type { ExpenseEntry } from '@/lib/types';

export default function DashboardClient() {
  const { savings, loading: savingsLoading, totalCurrent, totalInvested, totalGain, gainPct } = useSavings();
  const { expenses, loading: expensesLoading, add, monthlyTotal, monthlyTrend } = useExpenses();
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // ── useMemo MUST come before any early return (Rules of Hooks) ──
  const savingsHighlights = useMemo(() => savings.map((s) => {
    if (s.type === 'FD') {
      const meta = parseFDMeta(s.notes);
      if (!meta) return null;
      const maturity = fdMaturityDate(s.startDate, meta.tenure_months);
      const days = maturity ? daysUntil(maturity) : null;
      const gainPct = s.amountInvested > 0
        ? ((s.currentValue - s.amountInvested) / s.amountInvested) * 100 : 0;
      return { id: s.id, name: s.name, type: 'FD' as const, meta, maturity, days, gainPct };
    }
    if (s.type === 'Chit Funds') {
      // New-schema chit (dedicated columns)
      if (s.chitMembers && s.chitBidFrequency) {
        const elapsed     = elapsedCycles(s.startDate, s.chitBidFrequency);
        const nextBid     = addMonths(s.startDate, (elapsed + 1) * s.chitBidFrequency);
        const days        = daysUntil(nextBid);
        const hasWon      = (s.chitIsForeman ?? false) || s.chitWonCycle !== null;
        const bidReceived = s.chitBidReceived ?? 0;
        const totalCommitted = s.amountInvested + (Math.max(0, Math.round((s.chitDurationMonths ?? 0) / s.chitBidFrequency) - elapsed) * (s.chitFaceValue ?? 0));
        const gainPct = hasWon && totalCommitted > 0
          ? ((bidReceived - totalCommitted) / totalCommitted) * 100 : null;
        return { id: s.id, name: s.name, type: 'Chit Funds' as const, nextBid, days, hasWon, gainPct };
      }
      // Legacy JSON-notes chit — skip highlight
      return null;
    }
    if (s.type === 'Mutual Funds') {
      const meta = parseMFMeta(s.notes);
      if (!meta) return null;
      const invested = meta.units * meta.nav_at_purchase;
      const gainPct = invested > 0 ? ((s.currentValue - invested) / invested) * 100 : 0;
      return { id: s.id, name: s.name, type: 'Mutual Funds' as const, meta, gainPct };
    }
    return null;
  }).filter(Boolean), [savings]);

  const handleQuickAdd = async (data: Omit<ExpenseEntry, 'id' | 'createdAt'>) => {
    setQuickSubmitting(true);
    const ok = await add(data);
    setQuickSubmitting(false);
    if (ok) setQuickAdd(false);
  };

  // ── Loading state (after all hooks) ──
  if (savingsLoading || expensesLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Derived values (plain JS — not hooks, safe after early return) ──
  const isPositive = totalGain >= 0;
  const recentExpenses = expenses.slice(0, 5);
  type TypeBucket = { type: string; value: number; color: string };
  const buckets = savings.reduce<TypeBucket[]>((acc, s) => {
    const existing = acc.find((b) => b.type === s.type);
    if (existing) {
      existing.value += s.currentValue;
    } else {
      acc.push({ type: s.type, value: s.currentValue, color: SAVINGS_TYPE_COLORS[s.type] ?? '#94a3b8' });
    }
    return acc;
  }, []);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  // This month in trend
  const lastMonthData = monthlyTrend[monthlyTrend.length - 2];
  const spendChange = lastMonthData?.total > 0
    ? ((monthlyTotal - lastMonthData.total) / lastMonthData.total) * 100
    : null;

  return (
    <div className="space-y-5">
      {/* ── Greeting ── */}
      <div>
        <p className="text-xl font-bold text-gray-900">{greeting}! 👋</p>
        <p className="text-sm text-gray-400">{todayLabel}</p>
      </div>

      {/* ── Primary cards ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total savings */}
        <Link
          href="/savings"
          className="col-span-1 bg-indigo-600 rounded-2xl p-5 shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <p className="text-indigo-200 text-xs font-medium mb-1">Total Savings</p>
          <p className="text-white text-xl font-bold leading-tight">{formatCurrency(totalCurrent)}</p>
          <p className={`text-xs mt-1.5 font-medium ${isPositive ? 'text-indigo-200' : 'text-red-300'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}% overall returns
          </p>
        </Link>

        {/* Monthly expenses */}
        <Link
          href="/expenses"
          className="col-span-1 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <p className="text-gray-400 text-xs font-medium mb-1">This Month</p>
          <p className="text-gray-900 text-xl font-bold leading-tight">{formatCurrency(monthlyTotal)}</p>
          {spendChange !== null && (
            <p className={`text-xs mt-1.5 font-medium ${spendChange > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {spendChange > 0 ? '▲' : '▼'} {Math.abs(spendChange).toFixed(0)}% vs last month
            </p>
          )}
        </Link>
      </div>

      {/* ── Net position card ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Invested Capital</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">Total Gain / Loss</p>
          <p className={`text-lg font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{formatCurrency(totalGain)}
          </p>
        </div>
      </div>

      {/* ── Savings breakdown ── */}
      {buckets.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Savings Breakdown</h2>
            <Link href="/savings" className="text-xs text-indigo-600 font-medium hover:underline">
              View all →
            </Link>
          </div>
          {/* Stacked bar */}
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3">
            {buckets.map((b) => (
              <div
                key={b.type}
                style={{
                  flex: b.value / totalCurrent,
                  backgroundColor: b.color,
                }}
                title={`${b.type}: ${formatCurrency(b.value)}`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {buckets.map((b) => (
              <div key={b.type} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                <span className="text-xs text-gray-500">
                  {b.type} · <span className="font-medium text-gray-700">{formatCurrency(b.value)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Savings highlights (FD / Chit / MF smart cards) ── */}
      {savingsHighlights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Portfolio Highlights</h2>
            <Link href="/savings" className="text-xs text-indigo-600 font-medium hover:underline">
              Manage →
            </Link>
          </div>
          {savingsHighlights.map((h) => {
            if (!h) return null;

            if (h.type === 'FD') {
              const urgent = h.days !== null && h.days >= 0 && h.days <= 30;
              return (
                <div key={h.id} className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center justify-between gap-3 ${urgent ? 'border-red-200' : 'border-gray-100'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏦</span>
                      <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
                    </div>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {h.meta.interest_rate}% p.a. · Matures {h.maturity ? formatDate(h.maturity) : '—'}
                      {urgent && <span className="text-red-600 font-semibold ml-1">({h.days}d left)</span>}
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${h.gainPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {h.gainPct >= 0 ? '+' : ''}{h.gainPct.toFixed(2)}%
                  </span>
                </div>
              );
            }

            if (h.type === 'Chit Funds') {
              const urgent = h.days !== null && h.days >= 0 && h.days <= 30;
              return (
                <div key={h.id} className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center justify-between gap-3 ${urgent ? 'border-red-200' : 'border-gray-100'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🫙</span>
                      <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
                    </div>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {h.hasWon ? 'Bid won ✓' : 'Eligible to bid'}
                      {h.nextBid && <span className="ml-2 text-gray-500">· Next bid: {formatDate(h.nextBid)}</span>}
                      {urgent && h.days !== null && <span className="text-red-600 font-semibold ml-1">({h.days}d left)</span>}
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${h.gainPct !== null ? (h.gainPct >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-400'}`}>
                    {h.gainPct !== null
                      ? `${h.gainPct >= 0 ? '+' : ''}${h.gainPct.toFixed(1)}%`
                      : 'Ongoing'}
                  </span>
                </div>
              );
            }

            if (h.type === 'Mutual Funds') {
              return (
                <div key={h.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📈</span>
                      <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
                    </div>
                    <p className="text-xs text-purple-600 mt-0.5 truncate">
                      {h.meta.scheme_name} · {h.meta.units} units · NAV ₹{h.meta.current_nav}
                      {h.meta.nav_updated_date && <span className="text-gray-400 ml-1">({h.meta.nav_updated_date})</span>}
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${h.gainPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {h.gainPct >= 0 ? '▲' : '▼'} {Math.abs(h.gainPct).toFixed(2)}%
                  </span>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* ── Recent expenses ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Recent Expenses</h2>
          <Link href="/expenses" className="text-xs text-indigo-600 font-medium hover:underline">
            View all →
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No expenses recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[e.category] + '1A' }}
                >
                  {EXPENSE_CATEGORY_ICONS[e.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{e.category}</p>
                  {e.notes && <p className="text-xs text-gray-400 truncate">{e.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(e.amount)}</p>
                  <p className="text-xs text-gray-400">{formatShortDate(e.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick add FAB ── */}
      <button
        onClick={() => setQuickAdd(true)}
        className="fixed bottom-20 right-5 sm:bottom-6 sm:right-6 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:bg-indigo-800 transition-all flex items-center justify-center z-30"
        aria-label="Quick add expense"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* ── Quick add modal ── */}
      <Modal open={quickAdd} onClose={() => setQuickAdd(false)} title="Quick Add Expense">
        <ExpenseForm
          onSubmit={handleQuickAdd}
          onCancel={() => setQuickAdd(false)}
          submitting={quickSubmitting}
        />
      </Modal>
    </div>
  );
}
