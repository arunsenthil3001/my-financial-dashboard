'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toaster';
import type { UserSettings } from '@/lib/types';

interface SettingsRow {
  id: string;
  home_currency: string;
  earning_currency: string;
  cached_rate: number | null;
  rate_fetched_at: string | null;
  rate_alert_enabled: boolean | null;
  rate_alert_threshold_pct: number | null;
  rate_alert_dismissed_at: string | null;
  rate_alert_dismissed_rate: number | null;
}

function rowToSettings(row: SettingsRow): UserSettings {
  return {
    id: row.id,
    homeCurrency: row.home_currency,
    earningCurrency: row.earning_currency,
    cachedRate: row.cached_rate ?? null,
    rateFetchedAt: row.rate_fetched_at ?? null,
    rateAlertEnabled: row.rate_alert_enabled ?? true,
    rateAlertThresholdPct: row.rate_alert_threshold_pct ?? 1.0,
    rateAlertDismissedAt: row.rate_alert_dismissed_at ?? null,
    rateAlertDismissedRate: row.rate_alert_dismissed_rate ?? null,
  };
}

type SettingsPatch = Partial<Pick<UserSettings,
  | 'homeCurrency'
  | 'earningCurrency'
  | 'rateAlertEnabled'
  | 'rateAlertThresholdPct'
  | 'rateAlertDismissedAt'
  | 'rateAlertDismissedRate'
>>;

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading]   = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.warn('useSettings load:', error.message);
    } else {
      setSettings(rowToSettings(data as SettingsRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(
    async (patch: SettingsPatch, silent?: boolean): Promise<boolean> => {
      if (!settings) return false;
      const row: Partial<SettingsRow> = {};
      if (patch.homeCurrency          !== undefined) row.home_currency           = patch.homeCurrency;
      if (patch.earningCurrency       !== undefined) row.earning_currency        = patch.earningCurrency;
      if (patch.rateAlertEnabled      !== undefined) row.rate_alert_enabled      = patch.rateAlertEnabled;
      if (patch.rateAlertThresholdPct !== undefined) row.rate_alert_threshold_pct = patch.rateAlertThresholdPct;
      if (patch.rateAlertDismissedAt  !== undefined) row.rate_alert_dismissed_at  = patch.rateAlertDismissedAt;
      if (patch.rateAlertDismissedRate !== undefined) row.rate_alert_dismissed_rate = patch.rateAlertDismissedRate;

      const { data, error } = await supabase
        .from('user_settings')
        .update(row)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) {
        if (!silent) toast(`Failed to update settings: ${error.message}`, 'error');
        return false;
      }
      setSettings(rowToSettings(data as SettingsRow));
      if (!silent) toast('Settings saved', 'success');
      return true;
    },
    [settings, toast],
  );

  return { settings, loading, update, reload: load };
}
