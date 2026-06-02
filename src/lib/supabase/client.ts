// Supabase client for Client Components ("use client")
// Usage: import { supabase } from '@/lib/supabase/client'

import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}
