import { createClient } from "@supabase/supabase-js";

let _adminClient: ReturnType<typeof createClient> | null = null;

/**
 * Returns a server-side Supabase client initialized with the SERVICE_ROLE_KEY.
 * This client is used strictly for server-side operations that bypass Row Level Security (RLS)
 * such as reading and writing cached Astronomy Pictures of the Day.
 * 
 * WARNING: Never import this client inside any client components or expose it to the browser.
 */
export function getSupabaseAdmin() {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in environment variables."
    );
  }

  _adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _adminClient;
}
