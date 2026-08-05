import { supabaseAdmin } from '../config/db.js';
import { COOKIE_ACCESS, PROFILE_CACHE_TTL_MS } from '../config/security.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Request authentication.
 *
 * The access token arrives in an httpOnly cookie, which JavaScript on the page
 * cannot read — so an XSS bug can no longer walk off with a session the way it
 * could when the token lived in localStorage.
 */

/**
 * Role and active-status live in the database, not only in the token, so an
 * admin deactivating someone takes effect within PROFILE_CACHE_TTL_MS instead
 * of waiting for their access token to expire. The cache keeps that check from
 * costing a database round-trip on every request of a polling dashboard.
 */
const profileCache = new Map();

export function invalidateProfileCache(userId) {
  if (userId) profileCache.delete(String(userId));
  else profileCache.clear();
}

async function loadProfile(userId) {
  const key = String(userId);
  const cached = profileCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role, active, token_version')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (/token_version/.test(error.message || '')) {
      throw new Error(
        '[auth] profiles.token_version is missing. Run backend/migrations/002_auth_sessions.sql ' +
          'in the Supabase SQL editor, then restart the API.'
      );
    }
    throw error;
  }
  if (!data) return null;

  profileCache.set(key, { profile: data, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
  return data;
}

function readAccessToken(req) {
  const fromCookie = req.cookies?.[COOKIE_ACCESS];
  if (fromCookie) return fromCookie;

  // Bearer is still accepted for API clients (Postman, the ML service, scripts).
  // Browsers use the cookie, so this is not an XSS-reachable path.
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function unauthorized(res, message, code) {
  return res.status(401).json({ message, code });
}

export const authenticateToken = async (req, res, next) => {
  const token = readAccessToken(req);
  if (!token) return unauthorized(res, 'Not signed in', 'NO_TOKEN');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    // TokenExpiredError is the normal, expected case: the client should call
    // /api/auth/refresh. A distinct code lets the frontend do that silently
    // instead of bouncing the user to the login screen.
    const expired = err?.name === 'TokenExpiredError';
    return unauthorized(res, expired ? 'Session expired' : 'Invalid session', expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
  }

  try {
    const profile = await loadProfile(payload.sub);
    if (!profile) return res.status(403).json({ message: 'Profile not found', code: 'NO_PROFILE' });
    if (profile.active === false) {
      return res.status(403).json({ message: 'This account has been deactivated', code: 'ACCOUNT_DISABLED' });
    }

    // Bumping token_version (password reset, role change, deactivation) kills
    // every access token already in the wild, immediately.
    if (Number(profile.token_version || 0) !== Number(payload.tv || 0)) {
      return unauthorized(res, 'Session is no longer valid, please sign in again', 'TOKEN_STALE');
    }

    req.user = {
      id: profile.id,
      email: payload.email,
      role: profile.role,
      name: profile.name,
      tokenVersion: Number(profile.token_version || 0),
    };
    return next();
  } catch (err) {
    const code = err?.cause?.code || err?.code;
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
      return res.status(503).json({
        message: 'Authentication service unreachable. Check SUPABASE_URL and your network.',
        code: 'AUTH_BACKEND_DOWN',
      });
    }
    console.error('[auth] authentication failed:', err?.message || err);
    return res.status(500).json({ message: 'Authentication failed', code: 'AUTH_ERROR' });
  }
};

/** Route guard: `authorizeRoles('OWNER', 'ADMIN')`. */
export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user?.role) {
    return unauthorized(res, 'Not signed in', 'NO_TOKEN');
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Your role does not have access to this resource',
      code: 'FORBIDDEN_ROLE',
      required: roles,
    });
  }
  return next();
};

export default { authenticateToken, authorizeRoles, invalidateProfileCache };
