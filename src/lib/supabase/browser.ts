"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client using the anon/public key. This key is safe
 * to expose (that's its purpose) and is used exclusively for Realtime
 * Broadcast + Presence — ephemeral pub/sub for chat messages, typing, and
 * online status. It is never used to read/write database tables directly;
 * all persistence goes through our own API routes (lib/supabase/server.ts),
 * which use the service role key and are never reachable from the browser.
 */
let cachedClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example."
    );
  }

  cachedClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
