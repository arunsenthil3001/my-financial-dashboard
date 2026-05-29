'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useSalary, type SalaryInput } from '@/hooks/useSalary';
import { useCurrency } from '@/lib/currencyContext';
import { CURRENCY_LIST, CURRENCIES, formatAmount } from '@/lib/currencies';
import { formatDate, todayISO } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { useRateIntelligence } from '@/hooks/useRateIntelligence';
import { supabase } from '@/lib/supabase';

// ── Guided switch modal ───────────────────────────────────────────────────────

interface SwitchModalProps {
  currentCode: string;
  onConfirm: (newCode: string) => void;
  onCancel: () => void;
}

function EarningCurrencySwitchModal({ currentCode, onConfirm, onCancel }: SwitchModalProps) {
  const [selected, setSelected] = useState(currentCode);

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <p className="font-semibold mb-1">⚠️ Before you switch</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-700">
          <li>All existing expense and savings records keep their stored rates — they are never recomputed.</li>
          <li>New expenses will use the new earning currency from this point on.</li>
          <li>You should record a final payslip in the old currency before switching.</li>
        </ul>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">New Earning Currency</label>
        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
          {CURRENCY_LIST.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setSelected(c.code)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-colors ${
                selected === c.code
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-base">{c.flag}</span>
              <div>
                <p className="font-medium">{c.code}</p>
                <p className="text-gray-400 text-[10px] truncate">{c.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button onClick={() => onConfirm(selected)} disabled={selected === currentCode}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40">
          Switch to {selected}
        </button>
      </div>
    </div>
  );
}

// ── Salary form ───────────────────────────────────────────────────────────────

interface SalaryFormProps {
  defaultCurrency: string;
  onSubmit: (input: SalaryInput) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function SalaryForm({ defaultCurrency, onSubmit, onCancel, submitting }: SalaryFormProps) {
  const [netAmount, setNetAmount] = useState('');
  const [currency, setCurrency]       = useState(defaultCurrency);
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [notes, setNotes]             = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      netAmount: Number(netAmount),
      currency,
      effectiveFrom,
      effectiveTo: null,
      notes: notes || null,
    });
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Gross Amount</label>
          <input type="number" step="0.01" value={netAmount} onChange={e => setNetAmount(e.target.value)}
            placeholder="0.00" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
            {CURRENCY_LIST.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Effective From</label>
        <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
          required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Annual increment" className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
          {submitting ? 'Saving…' : 'Save Salary'}
        </button>
      </div>
    </form>
  );
}

// ── Main Settings client ──────────────────────────────────────────────────────

export default function SettingsClient() {
  const { settings, loading: settingsLoading, update: updateSettings } = useSettings();
  const { salary, current: currentSalary, loading: salaryLoading, closeCurrentAndAdd, remove: removeSalary } = useSalary();
  const { liveRate, earningCurrency: ctxEarning, homeCurrency: ctxHome, switchModalOpen, openSwitchModal, closeSwitchModal } = useCurrency();
  const { rateContext } = useRateIntelligence();

  const [salaryModalOpen, setSalaryModalOpen]   = useState(false);
  const [submittingSalary, setSubmittingSalary] = useState(false);
  const [confirmSalaryId, setConfirmSalaryId]   = useState<string | null>(null);

  // Rate alert local state (controlled by settings)
  const [alertEnabled, setAlertEnabled]     = useState<boolean | null>(null);
  const [alertThreshold, setAlertThreshold] = useState<number | null>(null);
  const [savingAlert, setSavingAlert]       = useState(false);

  // Upstox connection status
  const [upstoxConnected, setUpstoxConnected] = useState(false);
  const [upstoxLastSynced, setUpstoxLastSynced] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    supabase.from('upstox_tokens').select('updated_at').is('user_id', null).maybeSingle().then(({ data }) => {
      if (data) {
        setUpstoxConnected(true);
        setUpstoxLastSynced((data as { updated_at: string }).updated_at ?? null);
      }
    });
  }, []);

  const handleUpstoxSync = async () => {
    setSyncing(true);
    setSyncDone(false);
    const res = await fetch('/api/upstox/sync', { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { updated_at?: string };
      if (data.updated_at) setUpstoxLastSynced(data.updated_at);
      setSyncDone(true);
    }
    setSyncing(false);
  };

  const handleUpstoxDisconnect = async () => {
    setDisconnecting(true);
    await fetch('/api/upstox/disconnect', { method: 'POST' });
    setUpstoxConnected(false);
    setUpstoxLastSynced(null);
    setConfirmDisconnect(false);
    setSyncDone(false);
    setDisconnecting(false);
  };

  const homeCurrency    = settings?.homeCurrency    ?? 'INR';
  const earningCurrency = settings?.earningCurrency ?? 'INR';

  const homeCur    = CURRENCIES[homeCurrency];
  const earningCur = CURRENCIES[earningCurrency];

  const handleSwitchConfirm = async (newCode: string) => {
    await updateSettings({ earningCurrency: newCode });
    closeSwitchModal();
  };

  const handleSalarySubmit = async (input: SalaryInput) => {
    setSubmittingSalary(true);
    await closeCurrentAndAdd(input);
    setSubmittingSalary(false);
    setSalaryModalOpen(false);
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Currency settings ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Currency Settings</h2>

        {/* Home currency — read-only */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Home Currency (receiving)</p>
          <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-100 rounded-xl bg-gray-50">
            <span className="text-lg">{homeCur?.flag ?? ''}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{homeCurrency} — {homeCur?.name ?? ''}</p>
              <p className="text-xs text-gray-400">Read-only — contact support to change</p>
            </div>
          </div>
        </div>

        {/* Earning currency — editable via guided modal */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Earning Currency (abroad)</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-white">
              <span className="text-lg">{earningCur?.flag ?? ''}</span>
              <p className="text-sm font-semibold text-gray-900">{earningCurrency} — {earningCur?.name ?? ''}</p>
            </div>
            <button onClick={openSwitchModal}
              className="px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-200">
              Change
            </button>
          </div>
        </div>

        {/* Live rate */}
        {homeCurrency !== earningCurrency && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-sm">📡</span>
            <p className="text-xs text-emerald-700">
              {liveRate
                ? `Live rate: 1 ${earningCurrency} = ${liveRate.toFixed(4)} ${homeCurrency}`
                : 'Fetching live rate…'}
            </p>
          </div>
        )}
      </div>

      {/* ── Current salary ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Current Salary</h2>
          <button onClick={() => setSalaryModalOpen(true)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
            {currentSalary ? 'Update' : 'Add'}
          </button>
        </div>

        {currentSalary ? (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900">
                {formatAmount(currentSalary.netAmount, currentSalary.currency)}
              </p>
              <p className="text-xs text-gray-400">
                per month · effective {formatDate(currentSalary.effectiveFrom)}
                {currentSalary.notes && ` · ${currentSalary.notes}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No salary recorded yet</p>
        )}
      </div>

      {/* ── Salary history ── */}
      {salary.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Salary History</h2>
          <div className="space-y-2">
            {salary.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatAmount(s.netAmount, s.currency)}
                    {s.effectiveTo === null && (
                      <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-normal">Current</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(s.effectiveFrom)}
                    {s.effectiveTo ? ` – ${formatDate(s.effectiveTo)}` : ' – Present'}
                    {s.notes && ` · ${s.notes}`}
                  </p>
                </div>
                {confirmSalaryId === s.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => { removeSalary(s.id); setConfirmSalaryId(null); }}
                      className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-red-600">
                      Delete
                    </button>
                    <button onClick={() => setConfirmSalaryId(null)}
                      className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium hover:bg-gray-200">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmSalaryId(s.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rate Alerts ── */}
      {homeCurrency !== earningCurrency && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Rate Alerts</h2>

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Rate alert notifications</p>
              <p className="text-xs text-gray-400">Show a banner when the rate is unusually high</p>
            </div>
            <button
              type="button"
              onClick={() => setAlertEnabled((v) => v === null ? !(settings?.rateAlertEnabled ?? true) : !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                (alertEnabled ?? settings?.rateAlertEnabled ?? true) ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={(alertEnabled ?? settings?.rateAlertEnabled ?? true)}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                (alertEnabled ?? settings?.rateAlertEnabled ?? true) ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Alert when rate is <span className="text-indigo-700 font-semibold">{(alertThreshold ?? settings?.rateAlertThresholdPct ?? 1.0).toFixed(1)}%</span> above average
            </label>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={alertThreshold ?? settings?.rateAlertThresholdPct ?? 1.0}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.5%</span>
              <span>5.0%</span>
            </div>
          </div>

          {/* Status info */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Baseline source</span>
              <span className="font-medium capitalize">
                {rateContext?.baselineSource
                  ? rateContext.baselineSource === 'remittance_history' ? 'Transfer history' : '90-day average'
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Today's rate</span>
              <span className="font-medium">
                {rateContext?.todayRate
                  ? `1 ${earningCurrency} = ${formatAmount(rateContext.todayRate, homeCurrency)}`
                  : settings?.cachedRate
                    ? `1 ${earningCurrency} = ${formatAmount(settings.cachedRate, homeCurrency)}`
                    : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Your average</span>
              <span className="font-medium">
                {rateContext?.baseline
                  ? `1 ${earningCurrency} = ${formatAmount(rateContext.baseline, homeCurrency)}`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Last checked</span>
              <span className="font-medium">
                {settings?.rateFetchedAt
                  ? new Date(settings.rateFetchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </span>
            </div>
          </div>

          {/* Save button — only show when changes are pending */}
          {(alertEnabled !== null || alertThreshold !== null) && (
            <button
              onClick={async () => {
                setSavingAlert(true);
                const patch: Parameters<typeof updateSettings>[0] = {};
                if (alertEnabled   !== null) patch.rateAlertEnabled      = alertEnabled;
                if (alertThreshold !== null) patch.rateAlertThresholdPct = alertThreshold;
                const ok = await updateSettings(patch);
                if (ok) { setAlertEnabled(null); setAlertThreshold(null); }
                setSavingAlert(false);
              }}
              disabled={savingAlert}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {savingAlert ? 'Saving…' : 'Save Alert Settings'}
            </button>
          )}
        </div>
      )}

      {/* ── Connected Accounts ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Connected Accounts</h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Upstox</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {upstoxConnected
                ? syncDone
                  ? 'Connected ✓ · Synced just now'
                  : `Connected ✓${upstoxLastSynced ? ` · Last synced: ${new Date(upstoxLastSynced).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}`
                : 'Auto-sync your equity holdings (stocks only)'}
            </p>
          </div>
          {upstoxConnected ? (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleUpstoxSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <span className="w-3 h-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                ) : (
                  <span>↻</span>
                )}
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
              <button
                onClick={() => { setConfirmDisconnect(true); setSyncDone(false); }}
                className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/upstox"
              className="text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
            >
              Connect Upstox
            </a>
          )}
        </div>
        {confirmDisconnect && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
            <p className="text-xs text-red-700">
              This will remove all Upstox-synced entries from your Savings. Continue?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpstoxDisconnect}
                disabled={disconnecting}
                className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Guided earning currency switch modal ── */}
      <Modal open={switchModalOpen} onClose={closeSwitchModal} title="Switch Earning Currency">
        <EarningCurrencySwitchModal
          currentCode={earningCurrency}
          onConfirm={handleSwitchConfirm}
          onCancel={closeSwitchModal}
        />
      </Modal>

      {/* ── Add salary modal ── */}
      <Modal open={salaryModalOpen} onClose={() => setSalaryModalOpen(false)} title="Update Salary">
        <SalaryForm
          defaultCurrency={earningCurrency}
          onSubmit={handleSalarySubmit}
          onCancel={() => setSalaryModalOpen(false)}
          submitting={submittingSalary}
        />
      </Modal>
    </div>
  );
}
