'use client';

import { useState } from 'react';
import type { ExpenseEntry, ExpenseCategory } from '@/lib/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS } from '@/lib/types';
import { todayISO } from '@/lib/utils';

interface Props {
  onSubmit: (data: Omit<ExpenseEntry, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const blank = {
  amount: '',
  category: 'Food' as ExpenseCategory,
  date: todayISO(),
  notes: '',
};

export default function ExpenseForm({ onSubmit, onCancel, submitting = false }: Props) {
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof blank, string>>>({});

  const set = (k: keyof typeof blank, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e: Partial<Record<keyof typeof blank, string>> = {};
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = 'Enter a valid amount';
    if (!form.date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit({
      amount: Number(form.amount),
      category: form.category,
      date: form.date,
      notes: form.notes.trim(),
    });
    setForm({ ...blank, date: form.date }); // keep date for quick successive adds
    setErrors({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
        <input
          type="number"
          min="0"
          step="any"
          value={form.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder="0"
          autoFocus
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-lg font-semibold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
      </div>

      {/* Category pills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => set('category', cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                form.category === cat
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span>{EXPENSE_CATEGORY_ICONS[cat]}</span>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => set('date', e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Optional description..."
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white
            hover:bg-indigo-700 active:bg-indigo-800 transition-colors
            disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && (
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          {submitting ? 'Saving…' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}
