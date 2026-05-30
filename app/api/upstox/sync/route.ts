import { NextResponse } from 'next/server';
import { runFullSync } from '@/lib/upstox/sync';

export async function POST() {
  try {
    const result = await runFullSync();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message === 'NOT_CONNECTED' || message === 'TOKEN_EXPIRED' || message.startsWith('TOKEN_REFRESH_FAILED')) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    console.error('[Upstox] Sync error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
