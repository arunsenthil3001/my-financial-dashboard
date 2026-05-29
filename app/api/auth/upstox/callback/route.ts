import { createClient } from '@supabase/supabase-js';
import { syncHoldingsForUser } from '@/lib/upstoxSync';
import { NextResponse, type NextRequest } from 'next/server';

// Upstox v2 token response: access_token is nested under `data`, no expires_in or refresh_token
interface UpstoxTokenResponse {
  status: string;
  data: {
    access_token: string;
    extended_token?: string | null;
    email?: string;
    user_id?: string;
  };
}

export async function GET(request: NextRequest) {
  console.log('[Upstox] Callback route hit - starting sync');
  const url   = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const storedState = request.cookies.get('upstox_state')?.value;
  if (!code) {
    return NextResponse.redirect(new URL('/settings?upstox=error&reason=no_code', request.url));
  }
  if (storedState && state !== storedState) {
    return NextResponse.redirect(new URL('/settings?upstox=error&reason=state_mismatch', request.url));
  }

  const clientId     = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri  = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/settings?upstox=error&reason=not_configured', request.url));
  }

  // Exchange code for tokens
  let accessToken: string;
  try {
    const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });

    const body = await tokenRes.json().catch(() => null);

    if (!tokenRes.ok || !body) {
      console.error('Upstox token exchange failed:', tokenRes.status, JSON.stringify(body));
      return NextResponse.redirect(new URL('/settings?upstox=error&reason=token_exchange', request.url));
    }

    // Upstox v2 wraps the token under `data`
    const parsed = body as UpstoxTokenResponse;
    accessToken = parsed.data?.access_token ?? (body as { access_token?: string }).access_token ?? '';

    if (!accessToken) {
      console.error('Upstox: no access_token in response:', JSON.stringify(body));
      return NextResponse.redirect(new URL('/settings?upstox=error&reason=no_token', request.url));
    }
  } catch (err) {
    console.error('Upstox token fetch threw:', err);
    return NextResponse.redirect(new URL('/settings?upstox=error&reason=fetch_error', request.url));
  }

  // 23h conservative buffer — Upstox tokens expire at end of trading day
  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const now       = new Date().toISOString();

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Single-user: delete existing null-user token then insert fresh
  await adminClient.from('upstox_tokens').delete().is('user_id', null);
  const { error: insertErr } = await adminClient.from('upstox_tokens').insert({
    user_id:       null,
    access_token:  accessToken,
    refresh_token: null,
    expires_at:    expiresAt,
    updated_at:    now,
  });

  if (insertErr) {
    console.error('upstox_tokens insert error:', insertErr.message);
    return NextResponse.redirect(new URL('/settings?upstox=error&reason=db_insert', request.url));
  }

  // Trigger immediate holdings sync (best-effort)
  try {
    console.log('[Upstox] Starting holdings sync...');
    await syncHoldingsForUser(null, accessToken);
    console.log('[Upstox] Holdings sync complete');
  } catch (err) {
    console.error('[Upstox] Holdings sync failed:', err);
  }

  const response = NextResponse.redirect(new URL('/savings?upstox=connected', request.url));
  response.cookies.delete('upstox_state');
  return response;
}
