import { NextRequest, NextResponse } from 'next/server';
import { fetchRateServer } from '@/lib/server/fetchRate';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from or to param' }, { status: 400 });
  }

  const rate = await fetchRateServer(from, to);

  if (rate === null) {
    return NextResponse.json({ error: 'Rate unavailable' }, { status: 502 });
  }

  return NextResponse.json({ rate });
}
