import 'dotenv/config';
import crypto from 'node:crypto';

/**
 * Central security configuration.
 *
 * Everything that decides "how safe is a request" is resolved here once, so
 * cookie flags, token lifetimes and CORS rules can never drift apart between
 * the login controller, the refresh controller and the auth middleware.
 */

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Set TRUST_PROXY=1 when running behind nginx/Heroku/Render so req.secure + req.ip are accurate. */
export const TRUST_PROXY = process.env.TRUST_PROXY ?? (IS_PRODUCTION ? '1' : false);

// ── Secrets ──────────────────────────────────────────────────────────────────
// Access and refresh tokens are signed with *different* secrets so a leaked
// access secret can never be used to forge a long-lived refresh token.
function resolveSecret(name, legacyFallback) {
  const value = process.env[name] || legacyFallback;
  if (value && value.length >= 32) return value;

  if (IS_PRODUCTION) {
    throw new Error(
      `[security] ${name} is missing or shorter than 32 characters. ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }

  // Dev convenience only: a random per-boot secret. Restarting the server logs
  // everyone out, which is the correct trade-off versus shipping a default key.
  const generated = crypto.randomBytes(48).toString('hex');
  console.warn(
    `⚠️  [security] ${name} not set — generated an ephemeral dev secret. ` +
      'Sessions will not survive a restart. Set it in backend/.env before deploying.'
  );
  return generated;
}

export const ACCESS_TOKEN_SECRET = resolveSecret('JWT_ACCESS_SECRET', process.env.JWT_SECRET);
export const REFRESH_TOKEN_SECRET = resolveSecret('JWT_REFRESH_SECRET');

// ── Lifetimes ────────────────────────────────────────────────────────────────
/** Short access token: a stolen one is only useful for a few minutes. */
export const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
/** Refresh token: rotated on every use, so this is a *maximum* idle window. */
export const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 7 * 24 * 60 * 60);
/** How long a profile lookup stays cached in memory before we re-check role/active. */
export const PROFILE_CACHE_TTL_MS = Number(process.env.PROFILE_CACHE_TTL_MS || 15_000);

export const TOKEN_ISSUER = process.env.JWT_ISSUER || 'smartsales';
export const TOKEN_AUDIENCE = process.env.JWT_AUDIENCE || 'smartsales-app';

// ── Cookie names ─────────────────────────────────────────────────────────────
export const COOKIE_ACCESS = 'ss_access';
export const COOKIE_REFRESH = 'ss_refresh';
export const COOKIE_CSRF = 'ss_csrf';

/** Refresh cookie is scoped to the auth routes so it is never sent to data endpoints. */
export const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * Cross-site cookies require SameSite=None + Secure. That only works over HTTPS,
 * so it is opt-in via COOKIE_SAMESITE for teams hosting API and UI on
 * different domains.
 */
const CONFIGURED_SAMESITE = (process.env.COOKIE_SAMESITE || '').toLowerCase();
const SAMESITE_DEFAULT = CONFIGURED_SAMESITE === 'none' ? 'none' : 'lax';
const SAMESITE_STRICTEST = CONFIGURED_SAMESITE === 'none' ? 'none' : 'strict';

/** SameSite=None is meaningless (and rejected by browsers) without Secure. */
export const COOKIE_SECURE = IS_PRODUCTION || SAMESITE_DEFAULT === 'none' || process.env.COOKIE_SECURE === 'true';

export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

export function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: SAMESITE_DEFAULT,
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: SAMESITE_STRICTEST,
    path: REFRESH_COOKIE_PATH,
    domain: COOKIE_DOMAIN,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  };
}

/**
 * The CSRF cookie is deliberately readable by JavaScript — the browser echoes it
 * back in a header, and an attacker on another origin can do neither.
 */
export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: COOKIE_SECURE,
    sameSite: SAMESITE_DEFAULT,
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  };
}

/** Clearing must repeat path/domain or the browser keeps the original cookie. */
export function clearCookieOptions(options) {
  const { maxAge, ...rest } = options;
  return rest;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://localhost:3000'];

export const ALLOWED_ORIGINS = [
  ...new Set(
    (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .concat(IS_PRODUCTION ? [] : DEV_ORIGINS)
  ),
];

export const corsOptions = {
  origin(origin, callback) {
    // Same-origin requests, curl and server-to-server calls have no Origin header.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 600,
};

// ── Password policy ──────────────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 10);

/** Returns an array of human-readable problems; empty means the password is fine. */
export function validatePasswordStrength(password) {
  const problems = [];
  const value = typeof password === 'string' ? password : '';

  if (value.length < PASSWORD_MIN_LENGTH) {
    problems.push(`must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (value.length > 200) {
    problems.push('must be 200 characters or fewer');
  }
  if (!/[a-z]/.test(value)) problems.push('must contain a lowercase letter');
  if (!/[A-Z]/.test(value)) problems.push('must contain an uppercase letter');
  if (!/[0-9]/.test(value)) problems.push('must contain a number');
  if (!/[^A-Za-z0-9]/.test(value)) problems.push('must contain a symbol');

  return problems;
}

/** Constant-time string comparison that tolerates differing lengths. */
export function safeEquals(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) {
    // Still hash both so the comparison cost does not leak the length.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
