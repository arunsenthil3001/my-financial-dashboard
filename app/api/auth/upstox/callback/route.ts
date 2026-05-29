import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { syncHoldingsForUser } from '@/lib/upstoxSync';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const storedState = request.cookies.get('upstox_state')?.value;
  if (!code || state !== storedState) {
    return NextResponse.redirect(new URL('/settings?upstox=error', request.url));
  }

  const clientId     = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri  = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/settings?upstox=error', request.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/settings?upstox=error', request.url));
  }

  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  // Get authenticated user
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Upsert token
  await adminClient.from('upstox_tokens').upsert({
    user_id:       user.id,
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_at:    expiresAt,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'user_id' });

  // Trigger immediate sync (best-effort)
  try {
    await syncHoldingsForUser(user.id, tokenData.access_token);
  } catch { /* non-fatal */ }

  const response = NextResponse.redirect(new URL('/savings?upstox=connected', request.url));
  response.cookies.delete('upstox_state');
  return response;
}
