import { NextResponse } from 'next/server';

export async function GET() {
  const clientId   = process.env.UPSTOX_CLIENT_ID;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Upstox not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'profile,holdings',
  });

  return NextResponse.redirect(
    `https://api.upstox.com/v2/login/authorization/dialog?${params}`,
  );
}
