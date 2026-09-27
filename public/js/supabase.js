import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { supabaseConfig } from "./supabase-config.js";

export const isConfigured =
  /^https?:\/\/.+/.test(supabaseConfig.url || "") &&
  !supabaseConfig.url.includes("YOUR_PROJECT_REF") &&
  typeof supabaseConfig.anonKey === "string" &&
  supabaseConfig.anonKey.length > 0 &&
  !supabaseConfig.anonKey.startsWith("YOUR_");

// PKCE puts auth redirects in "?code=" rather than the URL hash, which the hash router owns.
export const supabase = isConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Where Supabase should send users back to from confirmation / reset emails. */
export const authRedirectUrl = () => `${location.origin}${location.pathname}`;
