import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteTokens } from '@/lib/upstox/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST() {
  await supabase
    .from('savings')
    .delete()
    .like('notes', 'Synced from Upstox%');

  await deleteTokens();

  return NextResponse.json({ success: true });
}
