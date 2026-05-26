'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toaster';
import type { UserSettings } from '@/lib/types';

interface SettingsRow {
  id: string;
  home_currency: string;
  earning_currency: string;
}

function rowToSettings(row: SettingsRow): UserSettings {
  return {
    id: row.id,
    homeCurrency: row.home_currency,
    earningCurrency: row.earning_currency,
  };
}

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
      // Table might not exist yet if migration hasn't been run
      console.warn('useSettings load:', error.message);
    } else {
      setSettings(rowToSettings(data as SettingsRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(
    async (patch: Partial<Pick<UserSettings, 'homeCurrency' | 'earningCurrency'>>): Promise<boolean> => {
      if (!settings) return false;
      const row: Partial<SettingsRow> = {};
      if (patch.homeCurrency    !== undefined) row.home_currency    = patch.homeCurrency;
      if (patch.earningCurrency !== undefined) row.earning_currency = patch.earningCurrency;

      const { data, error } = await supabase
        .from('user_settings')
        .update(row)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) {
        toast(`Failed to update settings: ${error.message}`, 'error');
        return false;
      }
      setSettings(rowToSettings(data as SettingsRow));
      toast('Settings saved', 'success');
      return true;
    },
    [settings, toast],
  );

  return { settings, loading, update, reload: load };
}
