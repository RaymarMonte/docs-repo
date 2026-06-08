import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use on the server: React Server Components (data fetching),
 * Server Actions and Route Handlers (mutations).
 *
 * `cookies()` is async in Next.js 16, so this factory is async — always `await` it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where setting cookies
            // is not allowed. Safe to ignore — the proxy refreshes the session.
          }
        },
      },
    },
  );
}
