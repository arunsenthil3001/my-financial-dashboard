/**
 * Server-side only — imported by API routes and the cron job.
 * Never import this in client components.
 */

import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

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

export async function syncHoldingsForUser(userId: string, accessToken: string): Promise<void> {
  const holdings = await fetchHoldings(accessToken);

  for (const h of holdings) {
    const amountInvested = h.quantity * h.average_price;
    const currentValue   = h.quantity * h.last_price;
    const notes = `Synced from Upstox · ${h.quantity} shares @ ₹${h.average_price.toFixed(2)}`;

    const { data: existing } = await serviceClient
      .from('savings')
      .select('id')
      .eq('user_id', userId)
      .eq('name', h.company_name)
      .eq('type', 'Stocks')
      .maybeSingle();

    if (existing) {
      await serviceClient
        .from('savings')
        .update({ current_value: currentValue, notes })
        .eq('id', existing.id);
    } else {
      const today = new Date().toISOString().split('T')[0];
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

  // Update last-synced timestamp
  await serviceClient
    .from('upstox_tokens')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

async function refreshToken(
  refreshTokenStr: string,
): Promise<{ access_token: string; refresh_token: string; expires_at: string } | null> {
  const clientId     = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://api.upstox.com/v2/login/authorization/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshTokenStr,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) return null;
  const json = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    access_token:  json.access_token,
    refresh_token: json.refresh_token ?? refreshTokenStr,
    expires_at:    new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

/** Called by the cron job — syncs holdings for all connected users. */
export async function syncAllUsers(): Promise<{ synced: number; failed: number }> {
  const { data: tokens } = await serviceClient
    .from('upstox_tokens')
    .select('id, user_id, access_token, refresh_token, expires_at')
    .not('access_token', 'is', null);

  if (!tokens?.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const token of tokens) {
    try {
      let accessToken = token.access_token as string;
      const expiresAt = new Date(token.expires_at as string);

      if (expiresAt <= new Date()) {
        const refreshed = await refreshToken(token.refresh_token as string);
        if (!refreshed) {
          // Mark as disconnected
          await serviceClient
            .from('upstox_tokens')
            .update({ access_token: null })
            .eq('id', token.id);
          failed++;
          continue;
        }
        accessToken = refreshed.access_token;
        await serviceClient.from('upstox_tokens').update({
          access_token:  refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at:    refreshed.expires_at,
        }).eq('id', token.id);
      }

      await syncHoldingsForUser(token.user_id as string, accessToken);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
