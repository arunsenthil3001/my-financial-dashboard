import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const url  = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Auto-claim any pre-auth data (rows where user_id IS NULL)
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const tables = ['expenses', 'savings', 'remittances', 'salary_history', 'user_settings', 'chit_cycles'];
      await Promise.all(
        tables.map((t) =>
          adminClient.from(t).update({ user_id: user.id }).is('user_id', null),
        ),
      );
    }
  }

  return NextResponse.redirect(new URL('/', request.url));
}
