'use client';

import { useMemo, useState } from 'react';
import type { ExpenseEntry } from '@/lib/types';
import { EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_ICONS } from '@/lib/types';
import { formatShortDate } from '@/lib/utils';
import { CURRENCIES } from '@/lib/currencies';
import { formatAmount } from '@/lib/formatNumber';
import { useCurrency } from '@/lib/currencyContext';
import EmptyState from '@/components/ui/EmptyState';

interface Props {
  expenses: ExpenseEntry[];
  onEdit: (e: ExpenseEntry) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
}

export default function ExpenseList({ expenses, onEdit, onDelete, onAddClick }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { toDisplay, homeCurrency } = useCurrency();

  // Group by date descending
  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseEntry[]>();
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
    for (const e of sorted) {
      const existing = map.get(e.date) ?? [];
      map.set(e.date, [...existing, e]);
    }
    return Array.from(map.entries());
  }, [expenses]);

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="🧾"
        title="No expenses yet"
        description="Start tracking your spending to see where your money goes."
        action={
          <button
            onClick={onAddClick}
            className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Add First Expense
          </button>
        }
      />
    );
  }

  const dateLabel = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return formatShortDate(d);
  };

  return (
    <div className="space-y-5">
      {grouped.map(([date, items]) => {
        const dayTotal = items.reduce((s, e) => s + e.homeAmount, 0);
        return (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {dateLabel(date)}
              </h3>
              <span className="text-xs font-medium text-gray-500">{toDisplay(dayTotal)}</span>
            </div>

            <div className="space-y-2">
              {items.map((e) => {
                const isForeign  = e.currency !== homeCurrency;
                const foreignCur = CURRENCIES[e.currency];

                return (
                  <div key={e.id}
                    className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[e.category] + '1A' }}>
                      {EXPENSE_CATEGORY_ICONS[e.category]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{e.category}</p>
                      {e.notes && <p className="text-xs text-gray-400 truncate">{e.notes}</p>}
                      {/* Foreign amount sub-line */}
                      {isForeign && (
                        <p className="text-xs text-indigo-500">
                          {foreignCur?.flag ?? ''} {formatAmount(e.originalAmount, e.currency)}
                          {' '}@ {e.rateUsed.toFixed(4)}
                        </p>
                      )}
                    </div>

                    {/* Amount + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-gray-900">
                        {toDisplay(e.homeAmount)}
                      </span>
                      {confirmId === e.id ? (
                        <>
                          <button onClick={() => { onDelete(e.id); setConfirmId(null); }}
                            className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-lg font-medium hover:bg-red-600">
                            Del
                          </button>
                          <button onClick={() => setConfirmId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onEdit(e)}
                            className="p-1 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                            aria-label="Edit expense">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setConfirmId(e.id)}
                            className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            aria-label="Delete expense">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
