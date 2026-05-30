import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, storeTokens } from '@/lib/upstox/client';
import { runFullSync } from '@/lib/upstox/sync';

function baseUrl(): string {
  const redirectUri = process.env.UPSTOX_REDIRECT_URI ?? '';
  try {
    return new URL(redirectUri).origin;
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  console.log('[Upstox] Callback route hit');

  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    console.error('[Upstox] OAuth error param:', error);
    return NextResponse.redirect(`${baseUrl()}/settings?upstox=error&reason=oauth_denied`);
  }

  try {
    console.log('[Upstox] Exchanging code for tokens...');
    const { access_token, refresh_token } = await exchangeCodeForToken(code);
    await storeTokens(access_token, refresh_token);

    console.log('[Upstox] Starting holdings sync...');
    const result = await runFullSync();
    console.log('[Upstox] Sync complete:', JSON.stringify({ stocks: result.stocks.synced, mf: result.mutualFunds.synced }));

    return NextResponse.redirect(`${baseUrl()}/savings?upstox=connected`);
  } catch (err) {
    console.error('[Upstox] Callback error:', err);
    return NextResponse.redirect(`${baseUrl()}/settings?upstox=error&reason=sync_failed`);
  }
}
