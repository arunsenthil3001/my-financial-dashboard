'use client';

import { useState } from 'react';
import { useExpenses, type FilterPeriod } from '@/hooks/useExpenses';
import { formatCurrency } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ExpenseForm from './ExpenseForm';
import ExpenseList from './ExpenseList';
import MonthlyTrendChart from './MonthlyTrendChart';
import type { ExpenseEntry } from '@/lib/types';

const PERIODS: { key: FilterPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All' },
];

export default function ExpensesClient() {
  const { expenses, loading, add, remove, filter, monthlyTrend } = useExpenses();
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filtered = filter(period);
  const periodTotal = filtered.reduce((s, e) => s + e.amount, 0);

  const handleSubmit = async (data: Omit<ExpenseEntry, 'id' | 'createdAt'>) => {
    setSubmitting(true);
    const ok = await add(data);
    setSubmitting(false);
    if (ok) setModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            {PERIODS.find((p) => p.key === period)?.label} · {filtered.length} entries
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(periodTotal)}</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </button>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
              period === key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Monthly trend chart ── */}
      <MonthlyTrendChart data={monthlyTrend} />

      {/* ── Expense list ── */}
      <ExpenseList
        expenses={filtered}
        onDelete={remove}
        onAddClick={() => setModalOpen(true)}
      />

      {/* ── Add modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Expense">
        <ExpenseForm
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={submitting}
        />
      </Modal>
    </div>
  );
}
