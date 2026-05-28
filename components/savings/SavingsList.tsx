'use client';

import { useState, useEffect } from 'react';
import type { SavingsEntry } from '@/lib/types';
import { SAVINGS_TYPE_COLORS } from '@/lib/types';
import { formatDate, daysUntil, addMonths } from '@/lib/utils';
import { formatAmount, CURRENCIES } from '@/lib/currencies';
import { useCurrency } from '@/lib/currencyContext';
import {
  parseFDMeta, fdMaturityDate,
  parseMFMeta,
} from '@/lib/notesParsers';
import { elapsedCycles } from '@/lib/chitFundCalc';
import { useChitCycles } from '@/hooks/useChitCycles';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

interface Props {
  savings: SavingsEntry[];
  onEdit:   (entry: SavingsEntry) => void;
  onDelete: (id: string) => Promise<boolean>;
}

// ─── Type-specific detail rows ────────────────────────────────────────────────

function FDDetail({ entry }: { entry: SavingsEntry }) {
  const meta = parseFDMeta(entry.notes);
  if (!meta) return null;
  const maturity = fdMaturityDate(entry.startDate, meta.tenure_months);
  const days = maturity ? daysUntil(maturity) : null;
  const gain = entry.currentValue - entry.amountInvested;
  const gainPct = entry.amountInvested > 0 ? (gain / entry.amountInvested) * 100 : 0;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
      <span className="text-blue-600 font-medium">{meta.interest_rate}% p.a. · {meta.compound_frequency}</span>
      {maturity && (
        <span className={`font-medium ${days !== null && days <= 30 ? 'text-red-600' : 'text-gray-500'}`}>
          Matures {formatDate(maturity)}
          {days !== null && days <= 30 && days >= 0 && ` — ${days}d left ⚠️`}
          {days !== null && days < 0 && ' — matured'}
        </span>
      )}
      <span className={`font-semibold ${gainPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}% gain
      </span>
    </div>
  );
}

function ChitDetail({ entry }: { entry: SavingsEntry }) {
  const { homeCurrency } = useCurrency();
  const { fetchCycles }  = useChitCycles();
  const [cycleCount,    setCycleCount]    = useState<number | null>(null);
  const [lastCycleDate, setLastCycleDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCycles(entry.id).then((cycles) => {
      if (cancelled) return;
      setCycleCount(cycles.length);
      const last = cycles[cycles.length - 1];
      if (last?.cycleDate) setLastCycleDate(last.cycleDate);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  if (entry.chitMembers && entry.chitFaceValue && entry.chitDurationMonths && entry.chitBidFrequency) {
    const n  = entry.chitMembers;
    const fv = entry.chitFaceValue;
    const d  = entry.chitDurationMonths;
    const bf = entry.chitBidFrequency;
    const totalCycles = Math.round(d / bf);

    // Use actual DB cycle count; fall back to schedule formula until loaded
    const elapsed    = cycleCount ?? elapsedCycles(entry.startDate, bf);
    const remaining  = Math.max(0, totalCycles - elapsed);

    // Next bid from last actual cycle date; fall back to theoretical if not loaded
    const nextBidDate = lastCycleDate
      ? addMonths(lastCycleDate, bf)
      : addMonths(entry.startDate, elapsed * bf);
    const days  = daysUntil(nextBidDate);
    const urgent = days >= 0 && days <= 30;

    const hasWon         = (entry.chitIsForeman ?? false) || entry.chitWonCycle !== null;
    const bidReceived    = entry.chitBidReceived ?? 0;
    const totalPaid      = entry.amountInvested;
    const futurePayments = remaining * fv;
    const totalCommitted = totalPaid + futurePayments;
    const netGain        = hasWon && bidReceived > 0
      ? bidReceived - totalCommitted : null;
    const gainPct        = netGain !== null && totalCommitted > 0
      ? (netGain / totalCommitted) * 100 : null;

    return (
      <div className="mt-2 space-y-2">
        {/* Cycle N of M · Next bid */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-amber-700 font-medium">
            Cycle {elapsed} of {totalCycles}
          </span>
          {entry.chitIsForeman && <span className="text-amber-600">· Foreman</span>}
          {hasWon && !entry.chitIsForeman && <span className="text-emerald-600 font-medium">· Bid taken ✓</span>}
          <span className="text-gray-400">·</span>
          <span className="text-gray-600">
            Next bid: <b>{formatDate(nextBidDate)}</b>
            {urgent && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold animate-pulse">
                {days}d
              </span>
            )}
            {!urgent && days >= 0 && (
              <span className="ml-1 text-gray-400">({days}d)</span>
            )}
          </span>
        </div>

        {/* 3-column: Paid so far / Bid received / Net gain */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-400 mb-0.5">Paid so far</p>
            <p className="font-semibold text-gray-700">{formatAmount(totalPaid, homeCurrency)}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Bid received</p>
            <p className="font-semibold text-gray-700">
              {hasWon && bidReceived > 0 ? formatAmount(bidReceived, homeCurrency) : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Net gain</p>
            {netGain !== null ? (
              <p className={`font-semibold ${netGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {netGain >= 0 ? '+' : ''}{formatAmount(netGain, homeCurrency)}
                {gainPct !== null && <span className="text-xs font-normal ml-0.5">({gainPct.toFixed(0)}%)</span>}
              </p>
            ) : (
              <p className="font-semibold text-gray-400">Projected</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Legacy chit (JSON in notes — read-only display)
  try {
    const meta = JSON.parse(entry.notes);
    if (meta?.total_members) {
      return (
        <p className="text-xs text-amber-600 mt-2 italic">
          Legacy chit data — edit to migrate to new format
        </p>
      );
    }
  } catch { /* not JSON */ }
  return entry.notes
    ? <p className="text-xs text-gray-500 mt-1 truncate">{entry.notes}</p>
    : null;
}

function MFDetail({ entry }: { entry: SavingsEntry }) {
  const meta = parseMFMeta(entry.notes);
  if (!meta) return null;
  const invested = meta.units * meta.nav_at_purchase;
  const current  = meta.units * meta.current_nav;
  const gainPct  = invested > 0 ? ((current - invested) / invested) * 100 : 0;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-purple-700 font-medium truncate">{meta.scheme_name}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
        <span>{meta.units} units</span>
        <span>NAV ₹{meta.current_nav.toFixed(4)}</span>
        {meta.nav_updated_date && <span>as of {meta.nav_updated_date}</span>}
        <span className={`font-semibold ${gainPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function TypeDetail({ entry }: { entry: SavingsEntry }) {
  if (entry.type === 'FD')           return <FDDetail   entry={entry} />;
  if (entry.type === 'Chit Funds')   return <ChitDetail entry={entry} />;
  if (entry.type === 'Mutual Funds') return <MFDetail   entry={entry} />;
  try {
    JSON.parse(entry.notes);
    return null;
  } catch {
    return entry.notes
      ? <p className="text-xs text-gray-500 mt-1 truncate">{entry.notes}</p>
      : null;
  }
}

// ─── Main list ────────────────────────────────────────────────────────────────

export default function SavingsList({ savings, onEdit, onDelete }: Props) {
  const { homeCurrency } = useCurrency();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (savings.length === 0) {
    return (
      <EmptyState
        icon="🏦"
        title="No savings yet"
        description="Add your first savings entry to start tracking your portfolio."
      />
    );
  }

  return (
    <div className="space-y-3">
      {savings.map((s) => {
        const isChitNew = s.type === 'Chit Funds' && s.chitMembers !== null;
        // For chit entries, gain is already in currentValue - amountInvested
        const gain    = s.currentValue - s.amountInvested;
        const gainPct = s.amountInvested > 0 ? (gain / s.amountInvested) * 100 : 0;
        const positive = gain >= 0;
        const color   = SAVINGS_TYPE_COLORS[s.type];

        return (
          <div key={s.id}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">

            {/* ── Header row ── */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{s.name}</h3>
                  <Badge color={color} label={s.type} />
                </div>
                <p className="text-xs text-gray-400">Started {formatDate(s.startDate)}</p>
              </div>

              {/* Edit / Delete */}
              <div className="flex items-center gap-1 shrink-0">
                {confirmId === s.id ? (
                  <>
                    <button onClick={() => { onDelete(s.id); setConfirmId(null); }}
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
                    <button onClick={() => onEdit(s)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      aria-label="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => setConfirmId(s.id)}
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

            {/* ── Type-specific detail ── */}
            <TypeDetail entry={s} />

            {/* ── Amounts row (skip for new-schema chit — already shown in ChitDetail) ── */}
            {!isChitNew && (
              <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Invested</p>
                  <p className="text-sm font-semibold text-gray-700">{formatAmount(s.amountInvested, homeCurrency)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Current</p>
                  <p className="text-sm font-semibold text-gray-900">{formatAmount(s.currentValue, homeCurrency)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Gain / Loss</p>
                  <p className={`text-sm font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {positive ? '+' : ''}{formatAmount(gain, homeCurrency)}
                    <span className="text-xs font-normal ml-1">({gainPct.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
