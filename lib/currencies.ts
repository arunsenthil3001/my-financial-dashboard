// ── Supported currencies ──────────────────────────────────────────────────────

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  flag: string;
}

export const CURRENCIES: Record<string, Currency> = {
  KWD: { code: 'KWD', symbol: 'KD',  name: 'Kuwaiti Dinar',       decimals: 3, flag: '🇰🇼' },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham',           decimals: 2, flag: '🇦🇪' },
  GBP: { code: 'GBP', symbol: '£',   name: 'British Pound',        decimals: 2, flag: '🇬🇧' },
  USD: { code: 'USD', symbol: '$',   name: 'US Dollar',            decimals: 2, flag: '🇺🇸' },
  EUR: { code: 'EUR', symbol: '€',   name: 'Euro',                 decimals: 2, flag: '🇪🇺' },
  QAR: { code: 'QAR', symbol: 'QR',  name: 'Qatari Riyal',         decimals: 2, flag: '🇶🇦' },
  SAR: { code: 'SAR', symbol: 'SR',  name: 'Saudi Riyal',          decimals: 2, flag: '🇸🇦' },
  INR: { code: 'INR', symbol: '₹',   name: 'Indian Rupee',         decimals: 2, flag: '🇮🇳' },
  PHP: { code: 'PHP', symbol: '₱',   name: 'Philippine Peso',      decimals: 2, flag: '🇵🇭' },
  LKR: { code: 'LKR', symbol: 'Rs',  name: 'Sri Lankan Rupee',     decimals: 2, flag: '🇱🇰' },
  NPR: { code: 'NPR', symbol: 'Rs',  name: 'Nepalese Rupee',       decimals: 2, flag: '🇳🇵' },
  BDT: { code: 'BDT', symbol: '৳',   name: 'Bangladeshi Taka',     decimals: 2, flag: '🇧🇩' },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

/** Format an amount in the given currency without forcing a particular locale symbol. */
export function formatAmount(amount: number, code: string): string {
  const currency = CURRENCIES[code];
  if (!currency) {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const formatted = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currency.symbol}${formatted}`;
}
