'use client';

import { useMemo, useState } from 'react';
import type { RemittanceEntry, SavingsEntry, ExpenseEntry } from '@/lib/types';
import { formatAmount } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  remittances: RemittanceEntry[];
  savings: SavingsEntry[];
  expenses: ExpenseEntry[];
  onLinkSaving:  (savingId:  string, remittanceId: string) => Promise<boolean>;
  onLinkExpense: (expenseId: string, remittanceId: string) => Promise<boolean>;
  homeCurrency:    string;
  earningCurrency: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rem2digits(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AllocateModal({
  open, onClose,
  remittances, savings, expenses,
  onLinkSaving, onLinkExpense,
  homeCurrency, earningCurrency,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [linking,    setLinking]    = useState(false);

  // Compute remaining per remittance (home-currency only)
  const enriched = useMemo(() => remittances
    .filter((r) => r.toCurrency === homeCurrency)
    .map((r) => {
      const linkedSav = savings
        .filter((s) => s.remittanceId === r.id)
        .reduce((sum, s) => sum + s.amountInvested, 0);
      const linkedExp = expenses
        .filter((e) => e.remittanceId === r.id)
        .reduce((sum, e) => sum + e.homeAmount, 0);
      return { ...r, remaining: rem2digits(r.toAmount - linkedSav - linkedExp) };
    })
    .filter((r) => r.remaining > 0.01)
    .sort((a, b) => b.transferDate.localeCompare(a.transferDate)),
    [remittances, savings, expenses, homeCurrency],
  );

  // Active remittance: selected or most recent
  const active = enriched.find((r) => r.id === selectedId) ?? enriched[0] ?? null;

  // Unlinked savings / expenses (remittanceId is null)
  const unlinkedSavings  = savings.filter( (s) => s.remittanceId === null);
  const unlinkedExpenses = expenses.filter((e) => e.remittanceId === null);

  const handleLinkSaving = async (savingId: string) => {
    if (!active || linking) return;
    setLinking(true);
    await onLinkSaving(savingId, active.id);
    setLinking(false);
  };

  const handleLinkExpense = async (expenseId: string) => {
    if (!active || linking) return;
    setLinking(true);
    await onLinkExpense(expenseId, active.id);
    setLinking(false);
  };

  const handleClose = () => {
    setSelectedId('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Allocate Funds">
      {enriched.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm font-semibold text-gray-700">All funds allocated!</p>
          <p className="text-xs text-gray-400 mt-1">Every remittance is fully linked to savings or expenses.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Remittance picker (only shown when > 1) ── */}
          {enriched.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Remittance to allocate
              </label>
              <select
                value={active?.id ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {enriched.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatDate(r.transferDate)} · {r.fromAmount} {r.fromCurrency}
                    {' → '}{formatAmount(r.toAmount, homeCurrency)}
                    {' · Left: '}{formatAmount(r.remaining, homeCurrency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Selected remittance info ── */}
          {active && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-600 mb-0.5">
                      {formatDate(active.transferDate)}
                      {active.channel ? ` · via ${active.channel}` : ''}
                    </p>
                    <p className="text-sm font-bold text-amber-900">
                      {active.fromAmount} {earningCurrency} &rarr; {formatAmount(active.toAmount, homeCurrency)}
                    </p>
                    {active.reference && (
                      <p className="text-xs text-amber-500 mt-0.5">Ref: {active.reference}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-amber-600 mb-0.5">Unallocated</p>
                    <p className={`text-xl font-bold ${active.remaining > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                      {formatAmount(active.remaining, homeCurrency)}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                {active.toAmount > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((active.toAmount - active.remaining) / active.toAmount) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-amber-500 mt-1 text-right">
                      {(((active.toAmount - active.remaining) / active.toAmount) * 100).toFixed(0)}% allocated
                    </p>
                  </div>
                )}
              </div>

              {/* ── Two link options ── */}
              <div className="grid grid-cols-2 gap-3">

                {/* Link to Savings */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
                  <p className="text-xs font-semibold text-indigo-700 mb-2">🏦 Link to Savings</p>
                  {unlinkedSavings.length === 0 ? (
                    <p className="text-xs text-indigo-400 italic">No unlinked savings</p>
                  ) : (
                    <select
                      disabled={linking || active.remaining <= 0}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleLinkSaving(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs text-gray-900
                                 focus:outline-none focus:ring-2 focus:ring-indigo-400
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select entry…</option>
                      {unlinkedSavings.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {formatAmount(s.amountInvested, homeCurrency)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Link to Expense */}
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3">
                  <p className="text-xs font-semibold text-rose-700 mb-2">💸 Link to Expense</p>
                  {unlinkedExpenses.length === 0 ? (
                    <p className="text-xs text-rose-400 italic">No unlinked expenses</p>
                  ) : (
                    <select
                      disabled={linking || active.remaining <= 0}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleLinkExpense(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs text-gray-900
                                 focus:outline-none focus:ring-2 focus:ring-rose-400
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select expense…</option>
                      {unlinkedExpenses.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.category} · {formatDate(e.date)} · {formatAmount(e.homeAmount, homeCurrency)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {active.remaining <= 0 && (
                <p className="text-xs text-emerald-600 font-medium text-center">
                  ✅ This remittance is fully allocated
                </p>
              )}

              {linking && (
                <p className="text-xs text-gray-400 text-center animate-pulse">Saving link…</p>
              )}
            </>
          )}

          {/* ── Done ── */}
          <button
            onClick={handleClose}
            className="w-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
