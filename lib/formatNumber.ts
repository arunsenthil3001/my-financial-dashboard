import { CURRENCIES } from './currencies';

/**
 * Compact display formatter for UI (not forms).
 * - Earning currencies with 3 decimals (KWD, etc.): whole-number format
 * - Home currencies: compact Indian notation (L / Cr)
 */
export function formatAmount(amount: number, currency: string): string {
  const config = CURRENCIES[currency];
  const symbol = config?.symbol ?? currency;

  // Earning / high-value currencies — whole numbers, no decimals
  if (config?.decimals === 3) {
    const sign = amount < 0 ? '-' : '';
    return `${sign}${symbol}${Math.round(Math.abs(amount)).toLocaleString('en-IN')}`;
  }

  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10_000_000) {
    return `${sign}${symbol}${(abs / 10_000_000).toFixed(1)}Cr`;
  }
  if (abs >= 100_000) {
    return `${sign}${symbol}${(abs / 100_000).toFixed(1)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${Math.round(abs).toLocaleString('en-IN')}`;
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}
