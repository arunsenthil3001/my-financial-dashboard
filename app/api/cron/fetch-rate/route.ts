import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchRateServer } from '@/lib/server/fetchRate';
import { runFullSync } from '@/lib/upstox/sync';

// Use the service-role client so this route isn't blocked by RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest) {
  // ── Auth: verify Bearer token matches CRON_SECRET ──
  const authHeader = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET ?? '';

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  // ── Read user_settings to get currency pair ──
  const { data: settings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('id, earning_currency, home_currency')
    .limit(1)
    .single();

  if (settingsErr || !settings) {
    return NextResponse.json({ error: 'Could not load user settings' }, { status: 500 });
  }

  const { id, earning_currency: from, home_currency: to } = settings;

  // ── Fetch live rate ──
  const rate = await fetchRateServer(from, to);

  if (rate === null) {
    return NextResponse.json({ error: 'Rate fetch failed', from, to }, { status: 502 });
  }

  const fetchedAt = new Date().toISOString();

  // ── Persist rate snapshot ──
  await supabase.from('rate_snapshots').insert({
    from_currency: from,
    to_currency:   to,
    rate,
    fetched_at:    fetchedAt,
  });

  // ── Cache latest rate in user_settings ──
  await supabase
    .from('user_settings')
    .update({ cached_rate: rate, rate_fetched_at: fetchedAt })
    .eq('id', id);

  // ── Sync Upstox holdings if connected ──
  await runFullSync().catch((err: unknown) => {
    if (err instanceof Error && err.message !== 'NOT_CONNECTED') {
      console.error('[Cron] Upstox sync failed:', err.message);
    }
  });

  return NextResponse.json({
    ok: true,
    from,
    to,
    rate,
    fetched_at: fetchedAt,
  });
}
