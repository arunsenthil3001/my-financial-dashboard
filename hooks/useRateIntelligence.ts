'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useRemittances } from '@/hooks/useRemittances';
import { getRateContext, getRateHistory, type RateContext, type RateHistoryPoint } from '@/lib/rateIntelligence';

export function useRateIntelligence() {
  const { settings } = useSettings();
  const { remittances } = useRemittances();

  const [rateContext, setRateContext]   = useState<RateContext | null>(null);
  const [rateHistory, setRateHistory]   = useState<RateHistoryPoint[]>([]);
  const [loading, setLoading]           = useState(true);

  const load = useCallback(async () => {
    if (!settings) return;
    const { earningCurrency, homeCurrency, rateAlertThresholdPct } = settings;

    // No cross-currency rates needed when earning == home
    if (earningCurrency === homeCurrency) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [ctx, history] = await Promise.all([
      getRateContext(earningCurrency, homeCurrency, remittances, rateAlertThresholdPct),
      getRateHistory(earningCurrency, homeCurrency),
    ]);
    setRateContext(ctx);
    setRateHistory(history);
    setLoading(false);
  }, [settings, remittances]);

  useEffect(() => { load(); }, [load]);

  return { rateContext, rateHistory, loading, reload: load };
}
