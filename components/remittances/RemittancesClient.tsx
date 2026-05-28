'use client';

import { useState } from 'react';
import { useRemittances, type RemittanceInput } from '@/hooks/useRemittances';
import { useSavings } from '@/hooks/useSavings';
import { useExpenses } from '@/hooks/useExpenses';
import { useCurrency } from '@/lib/currencyContext';
import { useSettings } from '@/hooks/useSettings';
import { calcRemittanceUnallocated } from '@/lib/unallocated';
import { useRateIntelligence } from '@/hooks/useRateIntelligence';
import { CURRENCIES, CURRENCY_LIST, formatAmount } from '@/lib/currencies';
import { getLiveRate } from '@/lib/forex';
import { formatDate, todayISO, monthKey } from '@/lib/utils';
import type { RemittanceEntry } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import RateHistoryChart from '@/components/remittances/RateHistoryChart';

// ── Transfer Form ─────────────────────────────────────────────────────────────

interface FormProps {
  initial?: RemittanceEntry | null;
  defaultFrom: string;
  defaultTo: string;
  onSubmit: (data: RemittanceInput) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function TransferForm({ initial, defaultFrom, defaultTo, onSubmit, onCancel, submitting }: FormProps) {
  const [transferDate, setTransferDate] = useState(initial?.transferDate ?? todayISO());
  const [fromCurrency, setFromCurrency] = useState(initial?.fromCurrency ?? defaultFrom);
  const [toCurrency, setToCurrency]     = useState(initial?.toCurrency   ?? defaultTo);
  const [fromAmount, setFromAmount]     = useState(initial ? String(initial.fromAmount) : '');
  const [toAmount, setToAmount]         = useState(initial ? String(initial.toAmount)   : '');
  const [rateUsed, setRateUsed]         = useState(initial ? String(initial.rateUsed)   : '');
  const [channel, setChannel]           = useState(initial?.channel   ?? '');
  const [reference, setReference]       = useState(initial?.reference ?? '');
  const [notes, setNotes]               = useState(initial?.notes     ?? '');
  const [fetchingRate, setFetchingRate] = useState(false);

  const fetchRate = async () => {
    if (fromCurrency === toCurrency) { setRateUsed('1'); return; }
    setFetchingRate(true);
    const rate = await getLiveRate(fromCurrency, toCurrency);
    if (rate !== null) {
      const r = rate.toFixed(6);
      setRateUsed(r);
      if (fromAmount) setToAmount((Number(fromAmount) * rate).toFixed(2));
    }
    setFetchingRate(false);
  };

  // Recalc toAmount when fromAmount or rateUsed changes
  const handleFromAmount = (v: string) => {
    setFromAmount(v);
    const r = Number(rateUsed);
    if (r > 0 && v) setToAmount((Number(v) * r).toFixed(2));
  };
  const handleRate = (v: string) => {
    setRateUsed(v);
    const r = Number(v);
    if (r > 0 && fromAmount) setToAmount((Number(fromAmount) * r).toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      transferDate,
      fromCurrency,
      toCurrency,
      fromAmount: Number(fromAmount),
      toAmount: Number(toAmount),
      rateUsed: Number(rateUsed) || 1,
      channel: channel || null,
      reference: reference || null,
      notes: notes || null,
    });
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Transfer Date</label>
        <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
          required className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>From Currency</label>
          <select value={fromCurrency} onChange={e => setFromCurrency(e.target.value)} className={inputCls}>
            {CURRENCY_LIST.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>To Currency</label>
          <select value={toCurrency} onChange={e => setToCurrency(e.target.value)} className={inputCls}>
            {CURRENCY_LIST.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls.replace('mb-1', '')}>Exchange Rate (1 {fromCurrency} = ? {toCurrency})</label>
          <button type="button" onClick={fetchRate} disabled={fetchingRate}
            className="text-xs text-indigo-600 font-medium hover:underline disabled:opacity-50">
            {fetchingRate ? 'Fetching…' : 'Fetch live rate'}
          </button>
        </div>
        <input type="number" step="0.000001" value={rateUsed} onChange={e => handleRate(e.target.value)}
          onFocus={!rateUsed ? fetchRate : undefined}
          placeholder="e.g. 282.50" required className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Amount Sent ({fromCurrency})</label>
          <input type="number" step="0.01" value={fromAmount} onChange={e => handleFromAmount(e.target.value)}
            placeholder="0.00" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Amount Received ({toCurrency})</label>
          <input type="number" step="0.01" value={toAmount} onChange={e => setToAmount(e.target.value)}
            placeholder="0.00" required className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Channel</label>
          <input type="text" value={channel} onChange={e => setChannel(e.target.value)}
            placeholder="e.g. Wise, Bank" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Reference</label>
          <input type="text" value={reference} onChange={e => setReference(e.target.value)}
            placeholder="Transaction ID" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Optional" className={inputCls} />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
          {submitting ? 'Saving…' : (initial ? 'Update' : 'Record Transfer')}
        </button>
      </div>
    </form>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export default function RemittancesClient() {
  const { remittances, loading, add, update, remove, totalSent, totalReceived } = useRemittances();
  const { savings } = useSavings();
  const { expenses } = useExpenses();
  const { settings } = useSettings();
  const { toDisplay } = useCurrency();
  const { rateContext, rateHistory } = useRateIntelligence();

  const [modalOpen, setModalOpen]       = useState(false);
  const [editing, setEditing]           = useState<RemittanceEntry | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [confirmId, setConfirmId]       = useState<string | null>(null);
  const [chartExpanded, setChartExpanded] = useState(false);

  const homeCurrency    = settings?.homeCurrency    ?? 'INR';
  const earningCurrency = settings?.earningCurrency ?? 'INR';

  const openAdd  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: RemittanceEntry) => { setEditing(r); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (data: RemittanceInput) => {
    setSubmitting(true);
    if (editing) {
      await update(editing.id, data);
    } else {
      await add(data);
    }
    setSubmitting(false);
    closeModal();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Monthly grouping
  const groups = remittances.reduce<Record<string, RemittanceEntry[]>>((acc, r) => {
    const key = monthKey(r.transferDate);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const totalTransfers = remittances.length;
  const avgRate = remittances.length > 0
    ? remittances.reduce((s, r) => s + r.rateUsed, 0) / remittances.length
    : 0;

  const fromCur = CURRENCIES[earningCurrency];
  const toCur   = CURRENCIES[homeCurrency];

  return (
    <div className="space-y-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">Total Sent</p>
          <p className="text-sm font-bold text-gray-900 truncate">
            {fromCur ? formatAmount(totalSent, earningCurrency) : `${totalSent.toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">Total Received</p>
          <p className="text-sm font-bold text-gray-900 truncate">
            {toCur ? formatAmount(totalReceived, homeCurrency) : `${totalReceived.toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">Transfers</p>
          <p className="text-sm font-bold text-gray-900">{totalTransfers}</p>
          {avgRate > 0 && earningCurrency !== homeCurrency && (
            <p className="text-xs text-gray-400">avg {avgRate.toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* ── List header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          All Transfers <span className="text-gray-400 font-normal">({totalTransfers})</span>
        </h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Transfer
        </button>
      </div>

      {/* ── Empty state ── */}
      {remittances.length === 0 && (
        <EmptyState icon="🏦" title="No transfers yet"
          description="Record your first international transfer to start tracking." />
      )}

      {/* ── Grouped list ── */}
      {groupKeys.map((gk) => {
        const [year, month] = gk.split('-');
        const label = new Date(Number(year), Number(month) - 1, 1)
          .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const monthTotal = groups[gk].reduce((s, r) => s + r.toAmount, 0);

        return (
          <div key={gk}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
              <p className="text-xs text-gray-500">{toCur ? formatAmount(monthTotal, homeCurrency) : monthTotal.toLocaleString('en-IN')}</p>
            </div>
            <div className="space-y-2">
              {groups[gk].map((r) => {
                const unalloc = calcRemittanceUnallocated(r, expenses, savings);
                return (
                <div key={r.id}
                  className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-gray-900">
                          {CURRENCIES[r.fromCurrency]?.flag ?? ''} {formatAmount(r.fromAmount, r.fromCurrency)}
                        </span>
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span className="text-sm font-semibold text-emerald-700">
                          {CURRENCIES[r.toCurrency]?.flag ?? ''} {formatAmount(r.toAmount, r.toCurrency)}
                        </span>
                        {unalloc > 0 && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {toDisplay(unalloc)} unallocated
                          </span>
                        )}
                        {unalloc <= 0 && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                            fully allocated ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDate(r.transferDate)}
                        {r.channel && ` · ${r.channel}`}
                        {r.reference && ` · Ref: ${r.reference}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Rate: 1 {r.fromCurrency} = {r.rateUsed.toFixed(4)} {r.toCurrency}
                      </p>
                      {r.notes && <p className="text-xs text-gray-400 truncate">{r.notes}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {confirmId === r.id ? (
                        <>
                          <button onClick={() => { remove(r.id); setConfirmId(null); }}
                            className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-red-600 transition-colors">
                            Delete
                          </button>
                          <button onClick={() => setConfirmId(null)}
                            className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(r)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            aria-label="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setConfirmId(r.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            aria-label="Delete">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Rate History Chart (collapsible) ── */}
      {earningCurrency !== homeCurrency && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setChartExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">📈</span>
              <div>
                <p className="text-sm font-semibold text-gray-700">Rate History</p>
                <p className="text-xs text-gray-400">
                  Last 90 days · 1 {earningCurrency} → {homeCurrency}
                  {rateContext?.todayRate ? ` · Today: ${formatAmount(rateContext.todayRate, homeCurrency)}` : ''}
                </p>
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${chartExpanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {chartExpanded && (
            <div className="px-5 pb-5">
              <RateHistoryChart
                history={rateHistory}
                baseline={rateContext?.baseline ?? null}
                baselineSource={rateContext?.baselineSource ?? null}
                remittances={remittances}
                earningCurrency={earningCurrency}
                homeCurrency={homeCurrency}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Transfer' : 'New Transfer'}>
        <TransferForm
          initial={editing}
          defaultFrom={earningCurrency}
          defaultTo={homeCurrency}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          submitting={submitting}
        />
      </Modal>
    </div>
  );
}
