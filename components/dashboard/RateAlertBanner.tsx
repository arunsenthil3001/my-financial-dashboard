'use client';

import Link from 'next/link';
import { formatAmount } from '@/lib/formatNumber';
import type { RateContext } from '@/lib/rateIntelligence';
import type { UserSettings } from '@/lib/types';

interface RateAlertBannerProps {
  rateContext: RateContext;
  settings: UserSettings;
  /** Typical transfer size in earning currency — used for projected gain. */
  typicalTransferAmount: number;
  onDismiss: () => void;
}

export default function RateAlertBanner({
  rateContext,
  settings,
  typicalTransferAmount,
  onDismiss,
}: RateAlertBannerProps) {
  const { todayRate, baseline, differencePct, projectedGain } = rateContext;
  const { earningCurrency, homeCurrency } = settings;

  if (todayRate === null || baseline === null || differencePct === null) return null;

  const gain        = projectedGain(typicalTransferAmount);
  const gainDisplay = formatAmount(Math.abs(gain), homeCurrency);
  const trendArrow  = rateContext.trend === 'up' ? '↑' : rateContext.trend === 'down' ? '↓' : '→';

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Headline */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg">💹</span>
            <p className="text-sm font-bold text-emerald-800">
              Rate is {differencePct.toFixed(1)}% above your average {trendArrow}
            </p>
          </div>

          {/* Rate detail */}
          <p className="text-xs text-emerald-700 mb-2">
            Today: <span className="font-semibold">1 {earningCurrency} = {formatAmount(todayRate, homeCurrency)}</span>
            {' · '}
            Your avg: <span className="font-semibold">{formatAmount(baseline, homeCurrency)}</span>
          </p>

          {/* Projected gain */}
          {typicalTransferAmount > 0 && (
            <p className="text-xs text-emerald-700 mb-3">
              On a {formatAmount(typicalTransferAmount, earningCurrency)} transfer you'd receive
              {' '}<span className="font-semibold text-emerald-800">+{gainDisplay} extra</span> vs your average rate.
            </p>
          )}

          {/* CTA */}
          <Link
            href="/remittances"
            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Send now →
          </Link>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="shrink-0 p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors"
          aria-label="Dismiss rate alert"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
