import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const TABLES_TO_CLAIM = [
  'expenses',
  'savings',
  'remittances',
  'salary_history',
  'user_settings',
  'chit_cycles',
] as const;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    console.error('[Auth] Callback received error param:', error);
    return NextResponse.redirect(`${origin}/auth?error=true`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[Auth] exchangeCodeForSession error:', exchangeError.message);
    return NextResponse.redirect(`${origin}/auth?error=true`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Claim all rows that were created before the user authenticated.
    // Service role bypasses RLS so we can update rows where user_id IS NULL.
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    await Promise.all(
      TABLES_TO_CLAIM.map(table =>
        adminClient
          .from(table)
          .update({ user_id: user.id })
          .is('user_id', null),
      ),
    );

    console.log(`[Auth] Data claimed for user ${user.id}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
