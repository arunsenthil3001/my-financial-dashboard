// ── Forex rate fetching ───────────────────────────────────────────────────────
// All real HTTP calls happen in /app/api/forex/route.ts (server-side).
// The client calls this internal Next.js route — the API key never reaches the browser.

/** Returns how many units of `to` equal 1 unit of `from`. Returns null on failure. */
export async function getLiveRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  try {
    const res = await fetch(`/api/forex?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.rate === 'number' ? json.rate : null;
  } catch {
    return null;
  }
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
