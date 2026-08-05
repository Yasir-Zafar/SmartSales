import { supabaseAdmin } from '../config/db.js';
import { sha256 } from '../config/security.js';
import { refreshExpiryDate } from './tokens.js';

/**
 * Server-side registry of live refresh tokens.
 *
 * Only the SHA-256 of the current jti is stored, so a database dump does not
 * hand an attacker usable refresh tokens. Every refresh rotates the jti; if a
 * client ever presents a jti that does not match the stored hash, the token was
 * cloned and we burn every session that user owns.
 */

const TABLE = 'auth_sessions';

function missingTableError(error) {
  const msg = String(error?.message || '');
  return error?.code === '42P01' || /relation .*auth_sessions.* does not exist/i.test(msg);
}

function wrap(error, action) {
  if (missingTableError(error)) {
    return new Error(
      `[auth] The "${TABLE}" table is missing. Run backend/migrations/002_auth_sessions.sql ` +
        'against your Supabase project, then restart the API.'
    );
  }
  return new Error(`[auth] Could not ${action}: ${error.message}`);
}

export async function createSession({ userId, jti, userAgent, ipAddress }) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert({
      user_id: userId,
      token_hash: sha256(jti),
      expires_at: refreshExpiryDate().toISOString(),
      last_used_at: new Date().toISOString(),
      user_agent: (userAgent || '').slice(0, 400) || null,
      ip_address: ipAddress || null,
    })
    .select('id')
    .single();

  if (error) throw wrap(error, 'create a session');
  return data.id;
}

export async function findSession(sessionId) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw wrap(error, 'look up the session');
  return data || null;
}

/**
 * Swap in the next jti. The `.is('revoked_at', null)` guard makes this the
 * atomic step of the rotation: two parallel refreshes with the same token can
 * only both succeed if neither revoked the session, and reuse detection has
 * already revoked it by then. Returns false if the row was revoked mid-flight.
 */
export async function rotateSession({ sessionId, nextJti, rotatedCount = 0, ipAddress, userAgent }) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update({
      token_hash: sha256(nextJti),
      last_used_at: new Date().toISOString(),
      expires_at: refreshExpiryDate().toISOString(),
      rotated_count: Number(rotatedCount) + 1,
      ip_address: ipAddress || null,
      user_agent: (userAgent || '').slice(0, 400) || null,
    })
    .eq('id', sessionId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw wrap(error, 'rotate the session');
  return Boolean(data);
}

export async function revokeSession(sessionId, reason = 'logout') {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq('id', sessionId)
    .is('revoked_at', null);

  if (error) throw wrap(error, 'revoke the session');
}

/** Used on logout-everywhere, password reset, role change and theft detection. */
export async function revokeAllSessionsForUser(userId, reason = 'revoke_all') {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (error) throw wrap(error, 'revoke the sessions');
}

export async function listActiveSessions(userId) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('id, created_at, last_used_at, expires_at, user_agent, ip_address')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_used_at', { ascending: false });

  if (error) throw wrap(error, 'list sessions');
  return data || [];
}

export function isSessionUsable(session) {
  if (!session) return false;
  if (session.revoked_at) return false;
  return new Date(session.expires_at).getTime() > Date.now();
}

export function sessionMatchesJti(session, jti) {
  return Boolean(session?.token_hash) && session.token_hash === sha256(jti);
}

/**
 * Auth audit trail. Best-effort by design — a logging outage must never block a
 * legitimate login or leave a user unable to sign out.
 */
export async function recordAuthEvent({ userId = null, email = null, event, ipAddress = null, userAgent = null, detail = null }) {
  try {
    await supabaseAdmin.from('auth_events').insert({
      user_id: userId,
      email: email ? String(email).slice(0, 255) : null,
      event,
      ip_address: ipAddress,
      user_agent: (userAgent || '').slice(0, 400) || null,
      detail: detail ? String(detail).slice(0, 1000) : null,
    });
  } catch (err) {
    console.error('[auth] Could not write auth event:', err?.message || err);
  }
}
