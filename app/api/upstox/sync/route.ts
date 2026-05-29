import { createClient } from '@supabase/supabase-js';
import { syncHoldingsForUser } from '@/lib/upstoxSync';
import { NextResponse } from 'next/server';

export async function POST() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: token } = await adminClient
    .from('upstox_tokens')
    .select('access_token, expires_at')
    .is('user_id', null)
    .maybeSingle();

  if (!token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  const { access_token, expires_at } = token as { access_token: string | null; expires_at: string };

  if (!access_token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  if (new Date(expires_at) <= new Date()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 400 });
  }

  await syncHoldingsForUser(null, access_token);

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
