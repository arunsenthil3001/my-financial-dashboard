import { NextRequest, NextResponse } from 'next/server';

// Server-side only — EXCHANGE_RATE_API_KEY is never sent to the browser
const API_KEY = process.env.EXCHANGE_RATE_API_KEY ?? '';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from or to param' }, { status: 400 });
  }

  if (from === to) {
    return NextResponse.json({ rate: 1 });
  }

  // Primary: ExchangeRate-API v6
  if (API_KEY) {
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/${from}/${to}`,
        { next: { revalidate: 0 } },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.result === 'success' && typeof json.conversion_rate === 'number') {
          return NextResponse.json({ rate: json.conversion_rate });
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
      { next: { revalidate: 0 } },
    );
    if (res.ok) {
      const json = await res.json();
      if (json.result === 'success' && json.rates?.[to] != null) {
        return NextResponse.json({ rate: json.rates[to] as number });
      }
    }
  } catch {
    // both sources failed
  }

  return NextResponse.json({ error: 'Rate unavailable' }, { status: 502 });
}
