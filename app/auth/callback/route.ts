import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const url  = new URL(request.url);
  const code = url.searchParams.get('code');

  // Create the redirect response first so we can attach session cookies directly to it.
  // Using cookies() from next/headers here would queue cookies on an internal response
  // that gets discarded when we return the NextResponse.redirect — session would be lost.
  const response = NextResponse.redirect(new URL('/', request.url));

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll()             { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Auto-claim any pre-auth rows (user_id IS NULL → set to this user)
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

  return response;
}
