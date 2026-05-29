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
  console.log('[Upstox] Fetching stock holdings...');
  const res = await fetch('https://api.upstox.com/v2/portfolio/long-term-holdings', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[Upstox] Stock holdings API error ${res.status}:`, body);
    throw new Error(`Upstox holdings API error: ${res.status}`);
  }
  const json = await res.json() as { data: UpstoxHolding[] };
  console.log(`[Upstox] Stock holdings fetched: ${json.data?.length ?? 0} stocks`);
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
  fund_name: string;
  units: number;
  average_cost_price: number;
  last_price: number;
  current_value: number;
  pnl: number;
}

async function fetchMFHoldings(accessToken: string): Promise<UpstoxMFHolding[]> {
  console.log('[Upstox] Fetching MF holdings...');
  const res = await fetch('https://api.upstox.com/v2/portfolio/mutual-funds', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  console.log(`[Upstox] MF response status: ${res.status}`);
  const rawBody = await res.text();
  console.log('[Upstox] MF raw response body:', JSON.stringify(rawBody));
  if (!res.ok) {
    throw new Error(`Upstox MF API error: ${res.status}`);
  }
  const json = JSON.parse(rawBody) as { data: UpstoxMFHolding[] };
  const count = json.data?.length ?? 0;
  console.log(`[Upstox] MF count: ${count}`);
  return json.data ?? [];
}

async function syncMutualFunds(userId: string | null, accessToken: string): Promise<void> {
  const holdings = await fetchMFHoldings(accessToken);
  const today = new Date().toISOString().split('T')[0];

  for (const h of holdings) {
    const amountInvested = h.units * h.average_cost_price;
    const notes = `Synced from Upstox · ${h.units} units @ ₹${h.average_cost_price.toFixed(4)}`;

    const query = serviceClient
      .from('savings')
      .select('id')
      .eq('name', h.fund_name)
      .eq('type', 'Mutual Funds');

    const { data: existing } = await (
      userId ? query.eq('user_id', userId) : query.is('user_id', null)
    ).maybeSingle();

    if (existing) {
      await serviceClient
        .from('savings')
        .update({ amount_invested: amountInvested, current_value: h.current_value, notes })
        .eq('id', existing.id);
    } else {
      await serviceClient.from('savings').insert({
        user_id:         userId,
        name:            h.fund_name,
        type:            'Mutual Funds',
        amount_invested: amountInvested,
        current_value:   h.current_value,
        start_date:      today,
        notes,
      });
    }
  }
}

// ── Public entry points ───────────────────────────────────────────────────────

/** Syncs both stocks and MFs for a single token. Called from OAuth callback and cron. */
export async function syncHoldingsForUser(userId: string | null, accessToken: string): Promise<void> {
  console.log(`[Upstox] Starting holdings sync for userId=${userId ?? 'null'}`);
  await syncStocks(userId, accessToken).catch(err => console.error('[Upstox] syncStocks error:', err));
  await syncMutualFunds(userId, accessToken).catch(err => console.error('[Upstox] syncMutualFunds error:', err));

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
