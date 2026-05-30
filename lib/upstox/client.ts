/**
 * Server-side only — token management for Upstox OAuth.
 * Never import this in client components.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const UPSTOX_TOKEN_URL = 'https://api.upstox.com/v2/login/authorization/token';

interface TokenRow {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

interface TokenExchangeResult {
  access_token: string;
  refresh_token: string | null;
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResult> {
  const res = await fetch(UPSTOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     process.env.UPSTOX_CLIENT_ID     ?? '',
      client_secret: process.env.UPSTOX_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TOKEN_REFRESH_FAILED: ${res.status} ${body}`);
  }

  const json = await res.json() as { data?: { access_token?: string; refresh_token?: string | null } };
  const accessToken = json.data?.access_token ?? (json as { access_token?: string }).access_token;
  if (!accessToken) throw new Error('TOKEN_REFRESH_FAILED: no access_token in response');

  return {
    access_token:  accessToken,
    refresh_token: json.data?.refresh_token ?? null,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Returns a valid access token, refreshing if expired. Throws if not connected. */
export async function getValidToken(): Promise<string> {
  const { data } = await supabase
    .from('upstox_tokens')
    .select('id, access_token, refresh_token, expires_at')
    .is('user_id', null)
    .maybeSingle();

  const row = data as TokenRow | null;
  if (!row?.access_token) throw new Error('NOT_CONNECTED');

  const isExpired = row.expires_at ? new Date(row.expires_at) <= new Date() : false;
  if (!isExpired) return row.access_token;

  if (!row.refresh_token) {
    await supabase.from('upstox_tokens').delete().is('user_id', null);
    throw new Error('TOKEN_EXPIRED');
  }

  const refreshed = await refreshAccessToken(row.refresh_token).catch(async (err: unknown) => {
    await supabase.from('upstox_tokens').delete().is('user_id', null);
    throw err;
  });

  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('upstox_tokens')
    .update({
      access_token:  refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? row.refresh_token,
      expires_at:    expiresAt,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', row.id);

  return refreshed.access_token;
}

/** Exchanges an OAuth code for tokens. */
export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  const res = await fetch(UPSTOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      client_id:     process.env.UPSTOX_CLIENT_ID     ?? '',
      client_secret: process.env.UPSTOX_CLIENT_SECRET ?? '',
      redirect_uri:  process.env.UPSTOX_REDIRECT_URI  ?? '',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TOKEN_EXCHANGE_FAILED: ${res.status} ${body}`);
  }

  const json = await res.json() as { data?: { access_token?: string; refresh_token?: string | null }; access_token?: string };
  const accessToken = json.data?.access_token ?? json.access_token;
  if (!accessToken) throw new Error('TOKEN_EXCHANGE_FAILED: no access_token in response');

  return {
    access_token:  accessToken,
    refresh_token: json.data?.refresh_token ?? null,
  };
}

/** Replaces any existing token row with a fresh one. */
export async function storeTokens(accessToken: string, refreshToken: string | null): Promise<void> {
  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  await supabase.from('upstox_tokens').delete().is('user_id', null);
  await supabase.from('upstox_tokens').insert({
    user_id:       null,
    access_token:  accessToken,
    refresh_token: refreshToken,
    expires_at:    expiresAt,
    updated_at:    new Date().toISOString(),
  });
}

/** Deletes all stored tokens. */
export async function deleteTokens(): Promise<void> {
  await supabase.from('upstox_tokens').delete().is('user_id', null);
}

/** Stamps updated_at after a successful sync. */
export async function markSynced(): Promise<void> {
  await supabase
    .from('upstox_tokens')
    .update({ updated_at: new Date().toISOString() })
    .is('user_id', null);
}
