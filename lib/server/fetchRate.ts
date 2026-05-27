// ── Server-side rate fetch ────────────────────────────────────────────────────
// Used by both /api/forex (per-request) and /api/cron/fetch-rate (scheduled).
// Never import this from client components — it reads EXCHANGE_RATE_API_KEY.

const API_KEY = process.env.EXCHANGE_RATE_API_KEY ?? '';

export async function fetchRateServer(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;

  // Primary: ExchangeRate-API v6
  if (API_KEY) {
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/${from}/${to}`,
        { cache: 'no-store' },
      );
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

  // Fallback: open.er-api.com (no key needed)
  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${from}`,
      { cache: 'no-store' },
    );
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
