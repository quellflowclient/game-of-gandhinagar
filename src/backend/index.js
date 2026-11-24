import { ENV } from "../config.js";

// Picks the live Supabase backend when it is configured, else the local demo backend.
// The Supabase client is only downloaded when it is actually used.
export async function loadBackend() {
  if (ENV.supabaseUrl && ENV.supabaseAnonKey) {
    const { supabase } = await import("./supabase.js");
    return supabase;
  }
  const { local } = await import("./local.js");
  return local;
}
