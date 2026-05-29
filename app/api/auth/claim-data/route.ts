import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const tables = ['expenses', 'savings', 'remittances', 'salary_history', 'user_settings', 'chit_cycles'];
  const results = await Promise.all(
    tables.map((t) =>
      adminClient.from(t).update({ user_id: user.id }).is('user_id', null),
    ),
  );

  const errors = results.filter((r) => r.error).map((r) => r.error?.message);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
