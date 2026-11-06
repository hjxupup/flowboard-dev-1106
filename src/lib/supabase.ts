import { createClient } from '@supabase/supabase-js';
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
// Only the Supabase project origin is valid, never dashboard URLs or API subpaths.
let validUrl = false;
try {
  if (url) {
    const parsed = new URL(url);
    validUrl = parsed.protocol === 'https:' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(parsed.href);
  }
} catch { /* handled by the setup message */ }
export const configured = Boolean(validUrl && key && !key?.includes('YOUR_'));
export const supabase = configured ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;
