import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

// Routes that never require authentication
const PUBLIC_PATHS = new Set(['/auth', '/auth/callback']);

// API route prefixes that are protected by their own mechanisms (cron secret,
// Upstox token) and must not redirect on 401 with HTML
const PUBLIC_API_PREFIXES = [
  '/api/auth/upstox',
  '/api/upstox',
  '/api/cron',
  '/api/forex',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let Next.js internals and static assets through untouched
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  // Public API routes — protected by their own secrets, not user session
  if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareClient(request);

  // getUser() validates the session with Supabase and refreshes the token
  // if needed. Do not replace with getSession() — it doesn't re-validate.
  const { data: { user } } = await supabase.auth.getUser();

  // Authenticated user visiting /auth → send to dashboard
  if (user && PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Unauthenticated user visiting a protected route
  if (!user && !PUBLIC_PATHS.has(pathname)) {
    // API routes: return 401 JSON so fetch() callers don't get an HTML redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files that
     * don't need auth (handled above explicitly too, but belt-and-suspenders).
     */
    '/((?!_next/static|_next/image).*)',
  ],
};
