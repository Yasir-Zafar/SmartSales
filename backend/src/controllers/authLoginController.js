import { supabaseAuth, supabaseAdmin } from '../config/db.js';
import {
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  COOKIE_CSRF,
  ACCESS_TOKEN_TTL_SECONDS,
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
  csrfCookieOptions,
  validatePasswordStrength,
} from '../config/security.js';
import { rotateCsrfCookie } from '../middleware/csrf.js';
import { invalidateProfileCache } from '../middleware/auth.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, newJti } from '../utils/tokens.js';
import {
  createSession,
  findSession,
  isSessionUsable,
  listActiveSessions,
  recordAuthEvent,
  revokeAllSessionsForUser,
  revokeSession,
  rotateSession,
  sessionMatchesJti,
} from '../utils/sessionStore.js';

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function clientAgent(req) {
  return req.headers['user-agent'] || null;
}

function publicUser(profile, email) {
  return {
    id: profile.id,
    email,
    name: profile.name,
    role: profile.role,
    last_logged_in: profile.last_logged_in || null,
  };
}

/** Writes the access + refresh cookie pair and refreshes the CSRF secret. */
function issueSession(res, { userId, email, role, name, tokenVersion, sessionId, jti }) {
  const accessToken = signAccessToken({ userId, email, role, name, tokenVersion });
  const refreshToken = signRefreshToken({ userId, sessionId, jti });

  res.cookie(COOKIE_ACCESS, accessToken, accessCookieOptions());
  res.cookie(COOKIE_REFRESH, refreshToken, refreshCookieOptions());
  rotateCsrfCookie(res);
}

function clearSessionCookies(res) {
  res.clearCookie(COOKIE_ACCESS, clearCookieOptions(accessCookieOptions()));
  res.clearCookie(COOKIE_REFRESH, clearCookieOptions(refreshCookieOptions()));
  res.clearCookie(COOKIE_CSRF, clearCookieOptions(csrfCookieOptions()));
}

/** Mirrors failures into the legacy table the admin tooling already reads. */
async function logFailedLogin(req, email, reason) {
  try {
    await supabaseAdmin.from('failed_login_attempts').insert({
      email: email || 'unknown',
      ip_address: clientIp(req),
      user_agent: clientAgent(req),
      reason,
    });
  } catch (err) {
    console.error('[auth] Could not log failed login:', err?.message || err);
  }
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
export async function login(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required', code: 'MISSING_CREDENTIALS' });
  }

  try {
    // Supabase remains the password store; we only borrow it to verify the
    // credential, then mint our own revocable session on top.
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (authError || !authData?.user) {
      await logFailedLogin(req, email, authError?.message || 'Invalid credentials');
      await recordAuthEvent({
        email,
        event: 'login_failed',
        ipAddress: clientIp(req),
        userAgent: clientAgent(req),
        detail: authError?.message,
      });
      // Deliberately vague: never reveal whether the address exists.
      return res.status(401).json({ message: 'Incorrect email or password', code: 'BAD_CREDENTIALS' });
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      await logFailedLogin(req, email, 'Profile not found');
      await recordAuthEvent({ userId, email, event: 'login_failed', ipAddress: clientIp(req), detail: 'no profile' });
      return res.status(401).json({ message: 'Incorrect email or password', code: 'BAD_CREDENTIALS' });
    }

    if (profile.active === false) {
      await logFailedLogin(req, email, 'Account deactivated');
      await recordAuthEvent({ userId, email, event: 'login_blocked', ipAddress: clientIp(req), detail: 'deactivated' });
      return res.status(403).json({
        message: 'This account has been deactivated. Contact your administrator.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    const jti = newJti();
    const sessionId = await createSession({
      userId,
      jti,
      userAgent: clientAgent(req),
      ipAddress: clientIp(req),
    });

    const lastLoggedIn = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ last_logged_in: lastLoggedIn })
      .eq('id', userId);
    if (updateError) console.error('[auth] last_logged_in update failed:', updateError.message);

    invalidateProfileCache(userId);

    issueSession(res, {
      userId,
      email: authData.user.email,
      role: profile.role,
      name: profile.name,
      tokenVersion: Number(profile.token_version || 0),
      sessionId,
      jti,
    });

    await recordAuthEvent({ userId, email, event: 'login_success', ipAddress: clientIp(req), userAgent: clientAgent(req) });

    // No token in the body — the whole point of httpOnly cookies.
    return res.json({
      user: publicUser({ ...profile, last_logged_in: lastLoggedIn }, authData.user.email),
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    const code = err?.cause?.code || err?.code;
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'Authentication service unreachable', code: 'AUTH_BACKEND_DOWN' });
    }
    return res.status(500).json({ message: err.message || 'Could not sign in', code: 'SERVER_ERROR' });
  }
}

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
export async function refresh(req, res) {
  const token = req.cookies?.[COOKIE_REFRESH];
  if (!token) {
    clearSessionCookies(res);
    return res.status(401).json({ message: 'No refresh token', code: 'NO_REFRESH_TOKEN' });
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearSessionCookies(res);
    return res.status(401).json({ message: 'Refresh token is invalid or expired', code: 'REFRESH_INVALID' });
  }

  try {
    const session = await findSession(payload.sid);

    // A jti that does not match the stored hash means this token was already
    // rotated away — i.e. somebody kept a copy. Assume compromise and burn
    // every session for the account.
    if (session && !sessionMatchesJti(session, payload.jti)) {
      await revokeAllSessionsForUser(session.user_id, 'refresh_token_reuse');
      await recordAuthEvent({
        userId: session.user_id,
        event: 'refresh_reuse_detected',
        ipAddress: clientIp(req),
        userAgent: clientAgent(req),
        detail: `session ${session.id}`,
      });
      clearSessionCookies(res);
      return res.status(401).json({
        message: 'This session was revoked for security reasons. Please sign in again.',
        code: 'REFRESH_REUSE',
      });
    }

    if (!isSessionUsable(session)) {
      clearSessionCookies(res);
      return res.status(401).json({ message: 'Session has ended. Please sign in again.', code: 'SESSION_ENDED' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', session.user_id)
      .maybeSingle();

    if (profileError || !profile) {
      await revokeSession(session.id, 'profile_missing');
      clearSessionCookies(res);
      return res.status(401).json({ message: 'Account no longer exists', code: 'NO_PROFILE' });
    }

    if (profile.active === false) {
      await revokeAllSessionsForUser(profile.id, 'deactivated');
      clearSessionCookies(res);
      return res.status(403).json({ message: 'This account has been deactivated', code: 'ACCOUNT_DISABLED' });
    }

    const nextJti = newJti();
    const rotated = await rotateSession({
      sessionId: session.id,
      nextJti,
      rotatedCount: session.rotated_count || 0,
      ipAddress: clientIp(req),
      userAgent: clientAgent(req),
    });

    if (!rotated) {
      clearSessionCookies(res);
      return res.status(401).json({ message: 'Session has ended. Please sign in again.', code: 'SESSION_ENDED' });
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
    const email = authUser?.user?.email || null;

    issueSession(res, {
      userId: profile.id,
      email,
      role: profile.role,
      name: profile.name,
      tokenVersion: Number(profile.token_version || 0),
      sessionId: session.id,
      jti: nextJti,
    });

    return res.json({
      user: publicUser(profile, email),
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    console.error('[auth] refresh error:', err);
    return res.status(500).json({ message: err.message || 'Could not refresh session', code: 'SERVER_ERROR' });
  }
}

// ── POST /api/auth/logout ────────────────────────────────────────────────────
export async function logout(req, res) {
  const token = req.cookies?.[COOKIE_REFRESH];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await revokeSession(payload.sid, 'logout');
      await recordAuthEvent({ userId: payload.sub, event: 'logout', ipAddress: clientIp(req) });
    } catch {
      // An expired or malformed token still means "end this session" — clearing
      // the cookies below is the whole job.
    }
  }
  clearSessionCookies(res);
  return res.json({ message: 'Signed out' });
}

// ── POST /api/auth/logout-all ────────────────────────────────────────────────
export async function logoutEverywhere(req, res) {
  try {
    await revokeAllSessionsForUser(req.user.id, 'logout_all');
    await recordAuthEvent({ userId: req.user.id, event: 'logout_all', ipAddress: clientIp(req) });
    clearSessionCookies(res);
    return res.json({ message: 'Signed out on every device' });
  } catch (err) {
    return res.status(500).json({ message: err.message, code: 'SERVER_ERROR' });
  }
}

// ── GET /api/auth/sessions ───────────────────────────────────────────────────
export async function getSessions(req, res) {
  try {
    const sessions = await listActiveSessions(req.user.id);
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ message: err.message, code: 'SERVER_ERROR' });
  }
}

// ── DELETE /api/auth/sessions/:id ────────────────────────────────────────────
export async function endSession(req, res) {
  try {
    const session = await findSession(req.params.id);
    // Scoped to the caller so one user can never end another user's session.
    if (!session || session.user_id !== req.user.id) {
      return res.status(404).json({ message: 'Session not found', code: 'NOT_FOUND' });
    }
    await revokeSession(session.id, 'user_revoked');
    return res.json({ message: 'Session ended' });
  } catch (err) {
    return res.status(500).json({ message: err.message, code: 'SERVER_ERROR' });
  }
}

// ── POST /api/auth/change-password ───────────────────────────────────────────
export async function changePassword(req, res) {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required', code: 'MISSING_FIELDS' });
  }

  const problems = validatePasswordStrength(newPassword);
  if (problems.length) {
    return res.status(400).json({ message: `Password ${problems.join(', ')}`, code: 'WEAK_PASSWORD', problems });
  }

  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
    const email = authUser?.user?.email;
    if (!email) return res.status(404).json({ message: 'Account not found', code: 'NOT_FOUND' });

    // Re-verify the current password: an attacker holding a live session must
    // not be able to lock the real owner out.
    const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      await recordAuthEvent({ userId: req.user.id, email, event: 'password_change_failed', ipAddress: clientIp(req) });
      return res.status(401).json({ message: 'Current password is incorrect', code: 'BAD_CREDENTIALS' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      password: newPassword,
    });
    if (updateError) {
      return res.status(400).json({ message: updateError.message, code: 'UPDATE_FAILED' });
    }

    // Changing a password must invalidate everything issued under the old one.
    await bumpTokenVersion(req.user.id);
    await revokeAllSessionsForUser(req.user.id, 'password_changed');
    await recordAuthEvent({ userId: req.user.id, email, event: 'password_changed', ipAddress: clientIp(req) });

    clearSessionCookies(res);
    return res.json({ message: 'Password updated. Please sign in again.' });
  } catch (err) {
    console.error('[auth] change password error:', err);
    return res.status(500).json({ message: err.message, code: 'SERVER_ERROR' });
  }
}

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
export async function getCurrentUser(req, res) {
  return res.json({ user: req.user });
}

/**
 * Invalidates every access token already issued for a user.
 * Shared with the admin controllers so role changes and forced password resets
 * take effect immediately rather than at the next token expiry.
 */
export async function bumpTokenVersion(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('token_version')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  const next = Number(data?.token_version || 0) + 1;
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ token_version: next })
    .eq('id', userId);

  if (updateError) throw updateError;
  invalidateProfileCache(userId);
  return next;
}

// Kept so existing imports of the old name keep working.
export const loginEndpointSupabaseAuth = login;
