'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSavings } from '@/hooks/useSavings';
import { useExpenses } from '@/hooks/useExpenses';
import { useRemittances } from '@/hooks/useRemittances';
import { useSalary } from '@/hooks/useSalary';
import { useCurrency } from '@/lib/currencyContext';
import { useSettings } from '@/hooks/useSettings';
import { useRateIntelligence } from '@/hooks/useRateIntelligence';
import { useChitCycles } from '@/hooks/useChitCycles';
import { formatDate, formatShortDate, daysUntil, addMonths, isThisMonth } from '@/lib/utils';
import { EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_ICONS } from '@/lib/types';
import {
  parseFDMeta, fdMaturityDate, calcFDValue,
} from '@/lib/notesParsers';
import { elapsedCycles } from '@/lib/chitFundCalc';
import Modal from '@/components/ui/Modal';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import SavingsForm from '@/components/savings/SavingsForm';
import RateAlertBanner from '@/components/dashboard/RateAlertBanner';
import type { SavingsEntry, ChitCycle, ChitCycleInput, ExpenseEntry, RemittanceEntry } from '@/lib/types';
import type { ExpenseInput } from '@/hooks/useExpenses';

// ── Needs-attention item types ────────────────────────────────────────────────

type NeedsAttentionChit = {
  kind: 'chit';
  saving: SavingsEntry;
  nextBidDate: string;
  daysLeft: number;
};

type NeedsAttentionFD = {
  kind: 'fd';
  saving: SavingsEntry;
  maturityDate: string;
  daysLeft: number;
  invested: number;
  maturityValue: number;
};

type NeedsAttentionIdle = {
  kind: 'idle';
  remittance: RemittanceEntry;
  unallocated: number;
  daysSince: number;
};

type NeedsAttentionItem = NeedsAttentionChit | NeedsAttentionFD | NeedsAttentionIdle;

export default function DashboardClient() {
  const { savings, loading: savingsLoading, totalCurrent, totalInvested, totalGain, gainPct, update: updateSaving, linkToRemittance: linkSavingToRemittance } = useSavings();
  const { expenses, loading: expensesLoading, add, monthlyTotal, monthlyTrend, linkToRemittance: linkExpenseToRemittance } = useExpenses();
  const { remittances, loading: remittancesLoading } = useRemittances();
  const { current: currentSalary } = useSalary();
  const { toDisplay, homeCurrency, earningCurrency, liveRate } = useCurrency();
  const { settings, update: updateSettings } = useSettings();
  const { rateContext } = useRateIntelligence();
  const { fetchCycles, replaceCycles } = useChitCycles();

  const [quickAdd, setQuickAdd]               = useState(false);
  const [quickSubmitting, setQuickSubmitting]  = useState(false);
  const [editOpen, setEditOpen]               = useState(false);
  const [editEntry, setEditEntry]             = useState<SavingsEntry | null>(null);
  const [editCycles, setEditCycles]           = useState<ChitCycle[]>([]);
  const [editSubmitting, setEditSubmitting]   = useState(false);

  // ── At Maturity (est.) ────────────────────────────────────────────────────
  const atMaturity = useMemo(() => {
    return savings.reduce((sum, s) => {
      if (s.type === 'FD') {
        const meta = parseFDMeta(s.notes);
        if (meta) return sum + calcFDValue(s.amountInvested, meta);
        return sum + s.currentValue;
      }
      if (s.type === 'Mutual Funds') {
        return sum + s.currentValue;
      }
      if (s.type === 'Chit Funds') {
        const hasWon = (s.chitIsForeman ?? false) || s.chitWonCycle !== null;
        if (hasWon) return sum + (s.chitBidReceived ?? s.currentValue);
        const projected = (s.chitFaceValue ?? 0) * (s.chitMembers ?? 0) * 0.85;
        return sum + (projected > 0 ? projected : s.currentValue);
      }
      return sum + s.currentValue;
    }, 0);
  }, [savings]);

  // ── Monthly scorecard ─────────────────────────────────────────────────────
  const monthlyScorecard = useMemo(() => {
    const salary = currentSalary
      ? (earningCurrency === homeCurrency ? currentSalary.netAmount
        : currentSalary.netAmount * (liveRate ?? 1))
      : null;

    const thisMonthExpenses = expenses.filter((e) => isThisMonth(e.date));
    const homeExpenses   = thisMonthExpenses.filter((e) => e.currency === homeCurrency)
      .reduce((s, e) => s + e.homeAmount, 0);
    const abroadExpenses = thisMonthExpenses.filter((e) => e.currency !== homeCurrency)
      .reduce((s, e) => s + e.homeAmount, 0);

    const thisMonthRemitted = remittances
      .filter((r) => isThisMonth(r.transferDate) && r.toCurrency === homeCurrency)
      .reduce((s, r) => s + r.toAmount, 0);

    const savingsRate = salary && salary > 0
      ? ((thisMonthRemitted / salary) * 100) : null;

    return { salary, homeExpenses, abroadExpenses, thisMonthRemitted, savingsRate };
  }, [currentSalary, expenses, remittances, homeCurrency, earningCurrency, liveRate]);

  // ── Unallocated pool (per-remittance breakdown) ───────────────────────────
  const unallocatedPool = useMemo(() => {
    const totalRemittedHome = remittances
      .filter((r) => r.toCurrency === homeCurrency)
      .reduce((s, r) => s + r.toAmount, 0);
    const linkedExpenses = expenses
      .filter((e) => e.remittanceId !== null)
      .reduce((s, e) => s + e.homeAmount, 0);
    const linkedSavings = savings
      .filter((sv) => sv.remittanceId !== null)
      .reduce((s, sv) => s + sv.amountInvested, 0);
    return Math.max(0, totalRemittedHome - linkedExpenses - linkedSavings);
  }, [remittances, expenses, savings, homeCurrency]);

  // ── Needs Attention items ─────────────────────────────────────────────────
  const needsAttentionItems = useMemo((): NeedsAttentionItem[] => {
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 60);

    const items: NeedsAttentionItem[] = [];

    // 1. Chit bids (show if not already won and nextBidDate ≤ today+60)
    savings
      .filter((s) => s.type === 'Chit Funds' && s.chitBidFrequency &&
        !s.chitWonCycle && !s.chitIsForeman)
      .forEach((s) => {
        const elapsed    = elapsedCycles(s.startDate, s.chitBidFrequency!);
        const nextBidStr = addMonths(s.startDate, elapsed * s.chitBidFrequency!);
        const nextBidD   = new Date(nextBidStr);
        nextBidD.setHours(0, 0, 0, 0);
        if (nextBidD <= cutoff) {
          items.push({ kind: 'chit', saving: s, nextBidDate: nextBidStr, daysLeft: daysUntil(nextBidStr) });
        }
      });

    // 2. Maturing FDs (maturityDate ≤ today+60)
    savings
      .filter((s) => s.type === 'FD')
      .forEach((s) => {
        const meta = parseFDMeta(s.notes);
        if (!meta) return;
        const matStr = fdMaturityDate(s.startDate, meta.tenure_months);
        if (!matStr) return;
        const matD = new Date(matStr);
        matD.setHours(0, 0, 0, 0);
        if (matD <= cutoff) {
          items.push({
            kind: 'fd', saving: s,
            maturityDate: matStr,
            daysLeft: daysUntil(matStr),
            invested: s.amountInvested,
            maturityValue: calcFDValue(s.amountInvested, meta),
          });
        }
      });

    // 3. Idle unallocated remittances
    remittances
      .filter((r) => r.toCurrency === homeCurrency)
      .forEach((r) => {
        const linkedExp = expenses
          .filter((e) => e.remittanceId === r.id)
          .reduce((s, e) => s + e.homeAmount, 0);
        const linkedSav = savings
          .filter((sv) => sv.remittanceId === r.id)
          .reduce((s, sv) => s + sv.amountInvested, 0);
        const unalloc = r.toAmount - linkedExp - linkedSav;
        if (unalloc > 1) {
          const daysSince = Math.abs(daysUntil(r.transferDate));
          items.push({ kind: 'idle', remittance: r, unallocated: unalloc, daysSince });
        }
      });

    return items;
  }, [savings, remittances, expenses, homeCurrency]);

  // ── Quick add expense ──
  const handleQuickAdd = async (data: Omit<ExpenseEntry, 'id' | 'createdAt'>) => {
    setQuickSubmitting(true);
    const ok = await add(data as ExpenseInput);
    setQuickSubmitting(false);
    if (ok) setQuickAdd(false);
  };

  // ── Edit savings (from Needs Attention) ──
  const openEditSaving = async (s: SavingsEntry) => {
    setEditEntry(s);
    if (s.type === 'Chit Funds') {
      const cycles = await fetchCycles(s.id);
      setEditCycles(cycles);
    } else {
      setEditCycles([]);
    }
    setEditOpen(true);
  };

  const handleSavingEdit = async (data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editEntry) return;
    setEditSubmitting(true);
    await updateSaving(editEntry.id, data);
    setEditSubmitting(false);
    setEditOpen(false);
    setEditEntry(null);
  };

  const handleChitEdit = async (
    data: Omit<SavingsEntry, 'id' | 'createdAt' | 'updatedAt'>,
    cycles: ChitCycleInput[],
  ) => {
    if (!editEntry) return;
    setEditSubmitting(true);
    const ok = await updateSaving(editEntry.id, data);
    if (ok) await replaceCycles(editEntry.id, cycles);
    setEditSubmitting(false);
    setEditOpen(false);
    setEditEntry(null);
  };

  // ── Rate alert logic ──
  const todayRate       = rateContext?.todayRate ?? null;
  const dismissedRate   = settings?.rateAlertDismissedRate ?? null;
  const isDismissed     =
    settings?.rateAlertDismissedAt !== null &&
    settings?.rateAlertDismissedAt !== undefined &&
    dismissedRate !== null && todayRate !== null &&
    Math.abs(todayRate - dismissedRate) / dismissedRate < 0.005;

  const showBanner =
    !!(rateContext?.shouldAlert) && !isDismissed &&
    !!(settings?.rateAlertEnabled) && earningCurrency !== homeCurrency;

  const handleDismiss = async () => {
    if (!todayRate) return;
    await updateSettings({ rateAlertDismissedAt: new Date().toISOString(), rateAlertDismissedRate: todayRate }, true);
  };

  const typicalTransfer = useMemo(() => {
    const pair = remittances.filter(
      (r) => r.fromCurrency === earningCurrency && r.toCurrency === homeCurrency,
    );
    if (pair.length === 0) return 1000;
    return pair.reduce((s, r) => s + r.fromAmount, 0) / pair.length;
  }, [remittances, earningCurrency, homeCurrency]);

  // ── Loading state ──
  if (savingsLoading || expensesLoading || remittancesLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const isPositive     = totalGain >= 0;
  const recentExpenses = expenses.slice(0, 5);

  const hour         = new Date().getHours();
  const greeting     = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel   = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const lastMonthData = monthlyTrend[monthlyTrend.length - 2];
  const spendChange   = lastMonthData?.total > 0
    ? ((monthlyTotal - lastMonthData.total) / lastMonthData.total) * 100
    : null;

  return (
    <div className="space-y-5">
      {/* ── Rate alert banner ── */}
      {showBanner && rateContext && settings && (
        <RateAlertBanner
          rateContext={rateContext}
          settings={settings}
          typicalTransferAmount={typicalTransfer}
          onDismiss={handleDismiss}
        />
      )}

      {/* ── Greeting ── */}
      <div>
        <p className="text-xl font-bold text-gray-900">{greeting}! 👋</p>
        <p className="text-sm text-gray-400">{todayLabel}</p>
      </div>

      {/* ── Hero: My Portfolio ── */}
      <div className="bg-indigo-600 rounded-2xl p-5 shadow-md">
        <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide mb-4">My Portfolio</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-indigo-300 text-xs mb-1">Invested</p>
            <p className="text-white text-base font-bold leading-tight">{toDisplay(totalInvested)}</p>
          </div>
          <div>
            <p className="text-indigo-300 text-xs mb-1">Current Value</p>
            <p className="text-white text-base font-bold leading-tight">{toDisplay(totalCurrent)}</p>
          </div>
          <div>
            <p className="text-indigo-300 text-xs mb-1">At Maturity</p>
            <p className="text-white text-base font-bold leading-tight">{toDisplay(atMaturity)}</p>
            <p className="text-indigo-300 text-xs">est.</p>
          </div>
        </div>
        <div className="border-t border-indigo-500 pt-3">
          <p className={`text-sm font-semibold ${isPositive ? 'text-indigo-100' : 'text-red-300'}`}>
            {isPositive ? '+' : ''}{toDisplay(totalGain)} gain
            <span className="text-indigo-300 font-normal ml-2">· {isPositive ? '+' : ''}{gainPct.toFixed(1)}% overall</span>
          </p>
        </div>
      </div>

      {/* ── Monthly Scorecard ── */}
      {(monthlyScorecard.salary !== null || monthlyScorecard.thisMonthRemitted > 0) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Monthly Scorecard</h2>
            <span className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {monthlyScorecard.salary !== null && (
              <div className="bg-indigo-50 rounded-xl p-3">
                <p className="text-xs text-indigo-500 mb-0.5">Salary</p>
                <p className="text-sm font-bold text-indigo-900">{toDisplay(monthlyScorecard.salary)}</p>
              </div>
            )}
            {monthlyScorecard.abroadExpenses > 0 && (
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xs text-orange-500 mb-0.5">Abroad Expenses</p>
                <p className="text-sm font-bold text-orange-900">{toDisplay(monthlyScorecard.abroadExpenses)}</p>
              </div>
            )}
            {monthlyScorecard.thisMonthRemitted > 0 && (
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-emerald-500 mb-0.5">Remitted Home</p>
                <p className="text-sm font-bold text-emerald-900">{toDisplay(monthlyScorecard.thisMonthRemitted)}</p>
              </div>
            )}
            {monthlyScorecard.homeExpenses > 0 && (
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-400 mb-0.5">Home Expenses</p>
                <p className="text-sm font-bold text-red-800">{toDisplay(monthlyScorecard.homeExpenses)}</p>
              </div>
            )}
          </div>

          {monthlyScorecard.savingsRate !== null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Remittance rate</p>
                <p className="text-xs font-bold text-indigo-700">{monthlyScorecard.savingsRate.toFixed(1)}%</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, monthlyScorecard.savingsRate)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Unallocated Pool ── */}
      {unallocatedPool > 0 && (
        <Link
          href="/remittances"
          className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm hover:bg-amber-100 transition-colors"
        >
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-0.5">💰 Unallocated Pool</p>
            <p className="text-xs text-amber-600">Money received but not yet linked to savings or expenses</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-base font-bold text-amber-800">{toDisplay(unallocatedPool)}</p>
            <p className="text-xs text-amber-600 font-medium">View transfers →</p>
          </div>
        </Link>
      )}

      {/* ── Needs Attention ── */}
      {needsAttentionItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Needs Attention</h2>
          {needsAttentionItems.map((item, i) => {
            if (item.kind === 'chit') {
              const overdue = item.daysLeft < 0;
              return (
                <button
                  key={`chit-${item.saving.id}`}
                  type="button"
                  onClick={() => openEditSaving(item.saving)}
                  className={`w-full text-left bg-white rounded-xl border shadow-sm px-4 py-3 hover:shadow-md transition-shadow ${overdue ? 'border-red-200' : 'border-amber-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span>🎟</span>
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.saving.name}</p>
                      </div>
                      {overdue ? (
                        <p className="text-xs text-red-600 mt-0.5 font-medium">Bid overdue — confirm if it happened</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Next bid: {formatDate(item.nextBidDate)} · in {item.daysLeft} days
                        </p>
                      )}
                      <p className="text-xs text-amber-600 mt-0.5">Eligible to bid — plan your transfer</p>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full ${overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {overdue ? `${Math.abs(item.daysLeft)}d overdue` : `${item.daysLeft}d`}
                    </span>
                  </div>
                </button>
              );
            }

            if (item.kind === 'fd') {
              const overdue = item.daysLeft < 0;
              return (
                <button
                  key={`fd-${item.saving.id}`}
                  type="button"
                  onClick={() => openEditSaving(item.saving)}
                  className={`w-full text-left bg-white rounded-xl border shadow-sm px-4 py-3 hover:shadow-md transition-shadow ${overdue ? 'border-red-200' : 'border-blue-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span>🏦</span>
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.saving.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Matures: {formatDate(item.maturityDate)}
                        {!overdue && ` · in ${item.daysLeft} days`}
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        {toDisplay(item.invested)} invested → {toDisplay(item.maturityValue)} at maturity
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Decide where to reinvest</p>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full ${overdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {overdue ? 'Matured' : `${item.daysLeft}d`}
                    </span>
                  </div>
                </button>
              );
            }

            if (item.kind === 'idle') {
              return (
                <Link
                  key={`idle-${item.remittance.id}`}
                  href="/remittances"
                  className="block bg-white rounded-xl border border-amber-200 shadow-sm px-4 py-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span>💰</span>
                        <p className="text-sm font-semibold text-gray-900">{toDisplay(item.unallocated)} undeployed</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        From your {formatShortDate(item.remittance.transferDate)} transfer · sitting idle for {item.daysSince} day{item.daysSince !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">Tag to savings or expenses when you invest it</p>
                    </div>
                    <span className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {item.daysSince}d idle
                    </span>
                  </div>
                </Link>
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
          <Link href="/expenses" className="text-xs text-indigo-600 font-medium hover:underline">View all →</Link>
        </div>

        {recentExpenses.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No expenses recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[e.category] + '1A' }}>
                  {EXPENSE_CATEGORY_ICONS[e.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{e.category}</p>
                  {e.notes && <p className="text-xs text-gray-400 truncate">{e.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{toDisplay(e.homeAmount)}</p>
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

      {/* ── Edit savings modal (from Needs Attention) ── */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditEntry(null); }}
        title="Edit Savings"
      >
        <SavingsForm
          initial={editEntry}
          initialCycles={editCycles}
          remittances={remittances}
          onSubmit={handleSavingEdit}
          onChitSubmit={handleChitEdit}
          onCancel={() => { setEditOpen(false); setEditEntry(null); }}
          submitting={editSubmitting}
        />
      </Modal>
    </div>
  );
}
