/**
 * Server-side only — imported by API routes and the cron job.
 * Never import this in client components.
 */

import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ── Stocks ────────────────────────────────────────────────────────────────────

interface UpstoxHolding {
  company_name: string;
  trading_symbol: string;
  quantity: number;
  average_price: number;
  last_price: number;
}

async function fetchHoldings(accessToken: string): Promise<UpstoxHolding[]> {
  const res = await fetch('https://api.upstox.com/v2/portfolio/long-term-holdings', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Upstox holdings API error: ${res.status}`);
  const json = await res.json() as { data: UpstoxHolding[] };
  return json.data ?? [];
}

async function syncStocks(userId: string | null, accessToken: string): Promise<void> {
  const holdings = await fetchHoldings(accessToken);
  const today = new Date().toISOString().split('T')[0];

  for (const h of holdings) {
    const amountInvested = h.quantity * h.average_price;
    const currentValue   = h.quantity * h.last_price;
    const notes = `Synced from Upstox · ${h.quantity} shares @ ₹${h.average_price.toFixed(2)}`;

    const query = serviceClient
      .from('savings')
      .select('id')
      .eq('name', h.company_name)
      .eq('type', 'Stocks');

    const { data: existing } = await (
      userId ? query.eq('user_id', userId) : query.is('user_id', null)
    ).maybeSingle();

    if (existing) {
      await serviceClient
        .from('savings')
        .update({ amount_invested: amountInvested, current_value: currentValue, notes })
        .eq('id', existing.id);
    } else {
      await serviceClient.from('savings').insert({
        user_id:         userId,
        name:            h.company_name,
        type:            'Stocks',
        amount_invested: amountInvested,
        current_value:   currentValue,
        start_date:      today,
        notes,
      });
    }
  }
}

// ── Mutual Funds ──────────────────────────────────────────────────────────────

interface UpstoxMFHolding {
  fund: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  folio: string;
  instrument_key: string;
}

async function fetchMFHoldings(accessToken: string): Promise<UpstoxMFHolding[]> {
  const res = await fetch('https://api.upstox.com/v2/mf/holdings', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Upstox MF API error: ${res.status}`);
  const json = await res.json() as { data: UpstoxMFHolding[] };
  return json.data ?? [];
}

async function syncMutualFunds(userId: string | null, accessToken: string): Promise<void> {
  const holdings = await fetchMFHoldings(accessToken);
  const today = new Date().toISOString().split('T')[0];

  for (const h of holdings) {
    const amountInvested = h.quantity * h.average_price;
    const currentValue   = h.quantity * h.last_price;
    const notes = `Synced from Upstox · ${h.quantity} units @ ₹${h.average_price.toFixed(4)}`;

    const query = serviceClient
      .from('savings')
      .select('id')
      .eq('name', h.fund)
      .eq('type', 'Mutual Fund');

    const { data: existing } = await (
      userId ? query.eq('user_id', userId) : query.is('user_id', null)
    ).maybeSingle();

    if (existing) {
      await serviceClient
        .from('savings')
        .update({ amount_invested: amountInvested, current_value: currentValue, notes })
        .eq('id', existing.id);
    } else {
      await serviceClient.from('savings').insert({
        user_id:         userId,
        name:            h.fund,
        type:            'Mutual Fund',
        amount_invested: amountInvested,
        current_value:   currentValue,
        start_date:      today,
        notes,
      });
    }
  }
}

// ── Public entry points ───────────────────────────────────────────────────────

/** Syncs stock and MF holdings for a single token. Called from OAuth callback and cron. */
export async function syncHoldingsForUser(userId: string | null, accessToken: string): Promise<void> {
  await syncStocks(userId, accessToken);
  await syncMutualFunds(userId, accessToken);

  await serviceClient
    .from('upstox_tokens')
    .update({ updated_at: new Date().toISOString() })
    .is('user_id', null);
}

/** Called by the cron job — syncs all connected tokens. */
export async function syncAllUsers(): Promise<{ synced: number; failed: number }> {
  const { data: tokens } = await serviceClient
    .from('upstox_tokens')
    .select('id, user_id, access_token, expires_at')
    .not('access_token', 'is', null);

  if (!tokens?.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const token of tokens) {
    try {
      const expiresAt = new Date(token.expires_at as string);

      // Upstox v2 has no refresh tokens — if expired, mark disconnected and skip
      if (expiresAt <= new Date()) {
        await serviceClient
          .from('upstox_tokens')
          .update({ access_token: null })
          .eq('id', token.id);
        failed++;
        continue;
      }

      const userId      = (token.user_id as string | null) ?? null;
      const accessToken = token.access_token as string;
      await syncHoldingsForUser(userId, accessToken);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
