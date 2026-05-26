'use client';

import { useEffect, useState } from 'react';
import type { ExpenseEntry, ExpenseCategory, RemittanceEntry } from '@/lib/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import { CURRENCIES, CURRENCY_LIST, formatAmount } from '@/lib/currencies';
import { getLiveRate } from '@/lib/forex';
import { useCurrency } from '@/lib/currencyContext';

interface Props {
  initial?: ExpenseEntry | null;
  remittances?: RemittanceEntry[];
  onSubmit: (data: Omit<ExpenseEntry, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export default function ExpenseForm({
  initial,
  remittances = [],
  onSubmit,
  onCancel,
  submitting = false,
}: Props) {
  const { homeCurrency, earningCurrency } = useCurrency();

  // ── Form state ──
  const [entryMode, setEntryMode]       = useState<'home' | 'earning'>(
    initial ? (initial.currency === homeCurrency ? 'home' : 'earning') : 'home'
  );
  const [amount, setAmount]             = useState(initial ? String(initial.originalAmount) : '');
  const [category, setCategory]         = useState<ExpenseCategory>(initial?.category ?? 'Food');
  const [date, setDate]                 = useState(initial?.date ?? todayISO());
  const [notes, setNotes]               = useState(initial?.notes ?? '');
  const [rateUsed, setRateUsed]         = useState(
    initial ? String(initial.rateUsed) : ''
  );
  const [remittanceId, setRemittanceId] = useState<string>(initial?.remittanceId ?? '');
  const [fetchingRate, setFetchingRate] = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});

  const isEarningMode  = entryMode === 'earning';
  const txCurrency     = isEarningMode ? earningCurrency : homeCurrency;
  const isCrossRate    = isEarningMode && earningCurrency !== homeCurrency;
  const isBackdated    = date < todayISO();

  // Auto-fetch rate when switching to earning mode
  const fetchRate = async () => {
    if (!isCrossRate) { setRateUsed('1'); return; }
    setFetchingRate(true);
    const r = await getLiveRate(earningCurrency, homeCurrency);
    if (r !== null) setRateUsed(r.toFixed(6));
    setFetchingRate(false);
  };

  useEffect(() => {
    if (isEarningMode && !rateUsed) { fetchRate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryMode]);

  // ── Derived display ──
  const homeAmountPreview = (() => {
    const a = Number(amount);
    const r = Number(rateUsed);
    if (!a || a <= 0) return null;
    if (!isCrossRate) return a;
    if (!r || r <= 0) return null;
    return a * r;
  })();

  // ── Validation ──
  const validate = () => {
    const e: Record<string, string> = {};
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'Enter a valid amount';
    if (!date) e.date = 'Date is required';
    if (isCrossRate && (!rateUsed || Number(rateUsed) <= 0)) e.rateUsed = 'Enter exchange rate';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──
  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const origAmount = Number(amount);
    const rate       = isCrossRate ? Number(rateUsed) : 1;
    const homeAmt    = isCrossRate ? origAmount * rate : origAmount;

    onSubmit({
      amount: homeAmt,
      category,
      date,
      notes: notes.trim(),
      currency: txCurrency,
      originalAmount: origAmount,
      rateUsed: rate,
      homeAmount: homeAmt,
      foreignAmount: isCrossRate ? origAmount : null,
      remittanceId: remittanceId || null,
    });
  };

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Currency toggle ── */}
      {earningCurrency !== homeCurrency && (
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button type="button"
            onClick={() => setEntryMode('home')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              entryMode === 'home' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}>
            {CURRENCIES[homeCurrency]?.flag ?? ''} {homeCurrency} (Home)
          </button>
          <button type="button"
            onClick={() => setEntryMode('earning')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              entryMode === 'earning' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}>
            {CURRENCIES[earningCurrency]?.flag ?? ''} {earningCurrency} (Abroad)
          </button>
        </div>
      )}

      {/* ── Amount ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Amount ({txCurrency}) *
        </label>
        <input
          type="number" min="0" step="any" value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0" autoFocus
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-lg font-semibold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
      </div>

      {/* ── Exchange rate (only for earning-mode cross-currency) ── */}
      {isCrossRate && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">
              Rate (1 {earningCurrency} = ? {homeCurrency})
            </label>
            <button type="button" onClick={fetchRate} disabled={fetchingRate}
              className="text-xs text-indigo-600 font-medium hover:underline disabled:opacity-50">
              {fetchingRate ? 'Fetching…' : 'Refresh live rate'}
            </button>
          </div>
          <input type="number" step="0.000001" value={rateUsed}
            onChange={e => setRateUsed(e.target.value)}
            onFocus={() => { if (!rateUsed) fetchRate(); }}
            placeholder="e.g. 282.50" className={inputCls} />
          {errors.rateUsed && <p className="text-xs text-red-500 mt-1">{errors.rateUsed}</p>}

          {/* Preview */}
          {homeAmountPreview !== null && (
            <p className="text-xs text-gray-500 mt-1">
              ≈ {formatAmount(homeAmountPreview, homeCurrency)} at save time
            </p>
          )}

          {/* Backdated warning */}
          {isBackdated && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              ⚠️ Today's rate used — adjust if you know the actual rate on {date}
            </p>
          )}
        </div>
      )}

      {/* ── Category ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                category === cat
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              <span>{EXPENSE_CATEGORY_ICONS[cat]}</span>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Date ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className={inputCls} />
        {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
      </div>

      {/* ── Notes ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Optional description…" className={inputCls} />
      </div>

      {/* ── Link to transfer ── */}
      {remittances.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link to Transfer</label>
          <select value={remittanceId} onChange={e => setRemittanceId(e.target.value)} className={inputCls}>
            <option value="">— None —</option>
            {remittances.map((r) => (
              <option key={r.id} value={r.id}>
                {r.transferDate} · {formatAmount(r.fromAmount, r.fromCurrency)} → {formatAmount(r.toAmount, r.toCurrency)}
                {r.channel ? ` (${r.channel})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {submitting ? 'Saving…' : (initial ? 'Update Expense' : 'Add Expense')}
        </button>
      </div>
    </form>
  );
}
