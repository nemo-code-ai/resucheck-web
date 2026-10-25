import { createClient } from "@supabase/supabase-js";

// SERVER ONLY. This client uses the secret key, which can read and write
// everything. Only import it from API routes, never from page.tsx.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing (URL or secret key).");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
