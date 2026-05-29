import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  await adminClient
    .from('savings')
    .delete()
    .like('notes', 'Synced from Upstox%');

  await adminClient
    .from('upstox_tokens')
    .delete()
    .is('user_id', null);

  return NextResponse.json({ ok: true });
}
