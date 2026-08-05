import { COOKIE_CSRF, csrfCookieOptions, randomToken, safeEquals } from '../config/security.js';

/**
 * Double-submit CSRF protection.
 *
 * Because the session now rides in a cookie, the browser attaches it to *any*
 * request — including one triggered by evil.com. The defence: also require the
 * value of a JS-readable cookie to be echoed in a header. Same-origin script
 * can read that cookie; a cross-origin page cannot, and cannot set the header.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

/** Issues a CSRF cookie to any visitor that does not have one yet. */
export function issueCsrfCookie(req, res, next) {
  if (!req.cookies?.[COOKIE_CSRF]) {
    const token = randomToken(32);
    res.cookie(COOKIE_CSRF, token, csrfCookieOptions());
    // Expose it on the response too, so a fresh client can prime itself without
    // a second round-trip.
    res.setHeader('X-CSRF-Token', token);
    req.cookies = { ...(req.cookies || {}), [COOKIE_CSRF]: token };
  }
  next();
}

export function rotateCsrfCookie(res) {
  const token = randomToken(32);
  res.cookie(COOKIE_CSRF, token, csrfCookieOptions());
  res.setHeader('X-CSRF-Token', token);
  return token;
}

/** Blocks state-changing requests that cannot prove they came from our own UI. */
export function requireCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  // Bearer-token callers are not browsers, so there is no ambient cookie for an
  // attacker to ride on and nothing for CSRF to protect against.
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) return next();

  const cookieToken = req.cookies?.[COOKIE_CSRF];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || !safeEquals(cookieToken, headerToken)) {
    return res.status(403).json({
      message: 'CSRF check failed. Refresh the page and try again.',
      code: 'CSRF_INVALID',
    });
  }

  return next();
}

export default { issueCsrfCookie, requireCsrfToken, rotateCsrfCookie, CSRF_HEADER };
