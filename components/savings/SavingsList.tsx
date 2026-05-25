'use client';

import { useState } from 'react';
import type { SavingsEntry } from '@/lib/types';
import { SAVINGS_TYPE_COLORS } from '@/lib/types';
import { formatCurrency, formatDate, daysUntil } from '@/lib/utils';
import {
  parseFDMeta, fdMaturityDate,
  parseChitMeta, chitNextBidDate, calcChitMonthlyPayment, chitMonthsRemaining,
  parseMFMeta,
} from '@/lib/notesParsers';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

interface Props {
  savings: SavingsEntry[];
  onEdit:   (entry: SavingsEntry) => void;
  onDelete: (id: string) => void;
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
  const meta = parseChitMeta(entry.notes);
  if (!meta) return null;
  const nextBid = chitNextBidDate(entry.startDate, meta);
  const days    = nextBid ? daysUntil(nextBid) : null;
  const urgent  = days !== null && days >= 0 && days <= 7;
  const monthlyPmt = calcChitMonthlyPayment(meta);
  const remaining  = chitMonthsRemaining(meta);

  // Status label
  const status = meta.is_foreman
    ? '🏦 Foreman ✓'
    : meta.user_has_taken_bid
    ? '✅ Bid taken'
    : '🕐 Eligible to bid';

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-amber-700 font-medium">{status}</span>
        <span className="text-gray-500">{remaining.toFixed(0)} months remaining</span>
        <span className="text-gray-500">Monthly: <b>{formatCurrency(monthlyPmt)}</b></span>
      </div>
      {nextBid && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Next bid: <b>{formatDate(nextBid)}</b>
          </span>
          {urgent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold animate-pulse">
              🔴 In {days}d
            </span>
          )}
        </div>
      )}
    </div>
  );
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
  // Generic: show plain notes if not JSON
  try {
    JSON.parse(entry.notes);
    return null; // JSON from other entries — don't show raw
  } catch {
    return entry.notes
      ? <p className="text-xs text-gray-500 mt-1 truncate">{entry.notes}</p>
      : null;
  }
}

// ─── Main list ────────────────────────────────────────────────────────────────

export default function SavingsList({ savings, onEdit, onDelete }: Props) {
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
        const gain     = s.currentValue - s.amountInvested;
        const gainPct  = s.amountInvested > 0 ? (gain / s.amountInvested) * 100 : 0;
        const positive = gain >= 0;
        const color    = SAVINGS_TYPE_COLORS[s.type];

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

            {/* ── Amounts row ── */}
            <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Invested</p>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(s.amountInvested)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Current</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(s.currentValue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Gain / Loss</p>
                <p className={`text-sm font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {positive ? '+' : ''}{formatCurrency(gain)}
                  <span className="text-xs font-normal ml-1">({gainPct.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
