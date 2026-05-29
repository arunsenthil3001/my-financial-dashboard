import { createClient } from '@supabase/supabase-js';
import { syncHoldingsForUser, refreshAccessToken } from '@/lib/upstoxSync';
import { NextResponse } from 'next/server';

export async function POST() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: token } = await adminClient
    .from('upstox_tokens')
    .select('id, access_token, refresh_token, expires_at')
    .is('user_id', null)
    .maybeSingle();

  if (!token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  const { id, access_token, refresh_token, expires_at } = token as {
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    expires_at: string;
  };

  if (!access_token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  let activeToken = access_token;

  if (new Date(expires_at) <= new Date()) {
    const newToken = refresh_token
      ? await refreshAccessToken(id, refresh_token)
      : null;
    if (!newToken) {
      await adminClient.from('upstox_tokens').delete().is('user_id', null);
      return NextResponse.json({ error: 'token_expired', reconnect: true }, { status: 401 });
    }
    activeToken = newToken;
  }

  await syncHoldingsForUser(null, activeToken);

  const { data: updated } = await adminClient
    .from('upstox_tokens')
    .select('updated_at')
    .is('user_id', null)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    updated_at: (updated as { updated_at: string } | null)?.updated_at ?? null,
  });
}
