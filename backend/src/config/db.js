import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '[db] SUPABASE_URL, SUPABASE_KEY and SUPABASE_SERVICE_ROLE_KEY must all be set in backend/.env'
  );
}

/**
 * Anon client, used only to verify passwords during login.
 *
 * Session persistence is off on purpose: the server handles many users at once,
 * and a client that remembered "the last person who signed in" would be a
 * cross-user data leak waiting to happen.
 */
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

/** Service-role client. Bypasses RLS — never expose this to a request body. */
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// `supabase` is the historical name for the anon client; kept so existing
// imports across the controllers keep resolving.
const supabase = supabaseAuth;

export { supabase, supabaseAuth, supabaseAdmin };
