// ── Forex rate fetching ───────────────────────────────────────────────────────
// Primary:  ExchangeRate-API v6 (free tier, API key required)
//           https://v6.exchangerate-api.com/v6/{key}/pair/{from}/{to}
// Fallback: open.er-api.com (no key needed, limited pairs)

const API_KEY = process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_KEY ?? '';

/** Returns how many units of `to` equal 1 unit of `from`. Returns null on failure. */
export async function getLiveRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;

  // Primary: ExchangeRate-API
  if (API_KEY) {
    try {
      const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/${from}/${to}`;
      const res  = await fetch(url, { next: { revalidate: 0 } });
      if (res.ok) {
        const json = await res.json();
        if (json.result === 'success' && typeof json.conversion_rate === 'number') {
          return json.conversion_rate;
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: open.er-api.com (free, no key)
  try {
    const url = `https://open.er-api.com/v6/latest/${from}`;
    const res  = await fetch(url, { next: { revalidate: 0 } });
    if (res.ok) {
      const json = await res.json();
      if (json.result === 'success' && json.rates?.[to] != null) {
        return json.rates[to] as number;
      }
    }
  } catch {
    // both sources failed
  }

  return null;
}

/** Convert `amount` from `from` currency to `to` currency using a live rate. */
export async function convertAmount(
  amount: number,
  from: string,
  to: string,
): Promise<{ converted: number; rate: number } | null> {
  const rate = await getLiveRate(from, to);
  if (rate === null) return null;
  return { converted: amount * rate, rate };
}
