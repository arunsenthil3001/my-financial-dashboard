import { createClient } from '@supabase/supabase-js';
import { syncHoldingsForUser } from '@/lib/upstoxSync';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // State check: warn but don't block — cookie can be lost on some browsers
  // in a cross-site redirect. Single-user app so CSRF risk is negligible.
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
  let tokenData: { access_token: string; refresh_token?: string; expires_in: number };
  try {
    const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '');
      console.error('Upstox token exchange failed:', tokenRes.status, body);
      return NextResponse.redirect(new URL('/settings?upstox=error&reason=token_exchange', request.url));
    }

    tokenData = await tokenRes.json() as typeof tokenData;
  } catch (err) {
    console.error('Upstox token fetch threw:', err);
    return NextResponse.redirect(new URL('/settings?upstox=error&reason=fetch_error', request.url));
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  const now       = new Date().toISOString();

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Single-user: delete existing null-user token then insert fresh
  await adminClient.from('upstox_tokens').delete().is('user_id', null);
  const { error: insertErr } = await adminClient.from('upstox_tokens').insert({
    user_id:       null,
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_at:    expiresAt,
    updated_at:    now,
  });

  if (insertErr) {
    console.error('upstox_tokens insert error:', insertErr.message);
    return NextResponse.redirect(new URL('/settings?upstox=error&reason=db_insert', request.url));
  }

  // Trigger immediate holdings sync (best-effort)
  try {
    await syncHoldingsForUser(null, tokenData.access_token);
  } catch (err) {
    console.error('Upstox initial sync error:', err);
  }

  const response = NextResponse.redirect(new URL('/savings?upstox=connected', request.url));
  response.cookies.delete('upstox_state');
  return response;
}
