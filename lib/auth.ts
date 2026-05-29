import { supabase } from './supabase';

/** Returns the current user's ID, or null if unauthenticated. */
export async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
