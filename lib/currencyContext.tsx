'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getLiveRate } from './forex';
import { CURRENCIES } from './currencies';
import { formatAmount } from './formatNumber';
import { useSettings } from '@/hooks/useSettings';

// ── Context shape ─────────────────────────────────────────────────────────────

interface CurrencyContextValue {
  /** ISO code of the home / receiving currency (e.g. "INR") */
  homeCurrency: string;
  /** ISO code of the earning / abroad currency (e.g. "KWD") */
  earningCurrency: string;
  /** Live rate: 1 earningCurrency = liveRate homeCurrency. null while loading. */
  liveRate: number | null;
  /** Which view the user has toggled to */
  display: 'home' | 'earning';
  /** Flip the display currency */
  toggle: () => void;
  /**
   * Convert a home-currency amount for display.
   * When display === 'home'    → returns formatted homeAmount as-is.
   * When display === 'earning' → divides by liveRate and formats in earningCurrency.
   */
  toDisplay: (homeAmount: number) => string;
  /** Trigger the guided earning-currency switch modal */
  openSwitchModal: () => void;
  switchModalOpen: boolean;
  closeSwitchModal: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { settings, loading: settingsLoading } = useSettings();
  const [display, setDisplay]                   = useState<'home' | 'earning'>('home');
  const [liveRate, setLiveRate]                 = useState<number | null>(null);
  const [switchModalOpen, setSwitchModalOpen]   = useState(false);

  const homeCurrency    = settings?.homeCurrency    ?? 'INR';
  const earningCurrency = settings?.earningCurrency ?? 'INR';

  // Fetch live rate whenever currencies change
  const rateKey = `${earningCurrency}->${homeCurrency}`;
  const prevKey = useRef('');
  useEffect(() => {
    if (settingsLoading) return;
    if (rateKey === prevKey.current && liveRate !== null) return;
    prevKey.current = rateKey;
    if (earningCurrency === homeCurrency) {
      setLiveRate(1);
      return;
    }
    let cancelled = false;
    getLiveRate(earningCurrency, homeCurrency).then((r) => {
      // Treat null, undefined, and 0 all as "failed" — fall back to 1 so toDisplay never divides by zero.
      if (!cancelled) setLiveRate((r != null && r > 0) ? r : 1);
    });
    return () => { cancelled = true; };
  }, [rateKey, settingsLoading, earningCurrency, homeCurrency, liveRate]);

  const toggle = useCallback(() => {
    setDisplay((d) => (d === 'home' ? 'earning' : 'home'));
  }, []);

  const openSwitchModal  = useCallback(() => setSwitchModalOpen(true),  []);
  const closeSwitchModal = useCallback(() => setSwitchModalOpen(false), []);

  const toDisplay = useCallback(
    (homeAmount: number): string => {
      if (display === 'home' || earningCurrency === homeCurrency) {
        return formatAmount(homeAmount, homeCurrency);
      }
      const rate = (liveRate != null && liveRate > 0) ? liveRate : 1;
      return formatAmount(homeAmount / rate, earningCurrency);
    },
    [display, homeCurrency, earningCurrency, liveRate],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      homeCurrency,
      earningCurrency,
      liveRate,
      display,
      toggle,
      toDisplay,
      openSwitchModal,
      switchModalOpen,
      closeSwitchModal,
    }),
    [homeCurrency, earningCurrency, liveRate, display, toggle, toDisplay, openSwitchModal, switchModalOpen, closeSwitchModal],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside <CurrencyProvider>');
  return ctx;
}
