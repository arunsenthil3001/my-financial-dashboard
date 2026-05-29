import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const clientId    = process.env.UPSTOX_CLIENT_ID;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Upstox not configured' }, { status: 500 });
  }

  // Generate random state and store in cookie for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL('https://api.upstox.com/v2/login/authorization/dialog');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('upstox_state', state, { httpOnly: true, maxAge: 600, sameSite: 'lax' });

  return response;
}
