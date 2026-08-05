import { supabaseAdmin } from '../config/db.js';

/**
 * Startup schema check.
 *
 * The cookie-auth build depends on tables that a pre-existing deployment will
 * not have. Discovering that at 3am from a PostgREST error code is miserable,
 * so we check once at boot and print exactly what to run.
 */
export async function checkAuthSchema() {
  const missing = [];

  for (const table of ['auth_sessions', 'auth_events']) {
    const { error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (error) missing.push(`table "${table}"`);
  }

  const { error: columnError } = await supabaseAdmin.from('profiles').select('token_version').limit(1);
  if (columnError) missing.push('column "profiles.token_version"');

  if (missing.length === 0) {
    console.log('🗄️  Auth schema OK (auth_sessions, auth_events, profiles.token_version)');
    return true;
  }

  console.warn('');
  console.warn('╭──────────────────────────────────────────────────────────────────────╮');
  console.warn('│  ⚠️  DATABASE MIGRATION REQUIRED                                      │');
  console.warn('╰──────────────────────────────────────────────────────────────────────╯');
  console.warn(`   Missing: ${missing.join(', ')}`);
  console.warn('   Sign-in will fail until this is applied.');
  console.warn('');
  console.warn('   Fix: open your Supabase project → SQL Editor → paste and run');
  console.warn('        backend/migrations/002_auth_sessions.sql');
  console.warn('');
  return false;
}
