import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return store.getAll(); },
        setAll(all: CookieToSet[]) {
          try {
            all.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server Components cannot always write cookies.
          }
        },
      },
    }
  );
}
