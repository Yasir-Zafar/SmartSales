import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_TTL_SECONDS,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
} from '../config/security.js';

/**
 * SmartSales signs its own tokens rather than forwarding the Supabase session.
 *
 * Why: the Supabase access token cannot be revoked from our side, cannot carry
 * our role claim, and forced a network round-trip to Supabase on every single
 * API call. Our own tokens verify locally in microseconds and can be killed
 * instantly by bumping the user's token_version.
 */

const ACCESS_TYPE = 'access';
const REFRESH_TYPE = 'refresh';

export function signAccessToken({ userId, email, role, name, tokenVersion }) {
  return jwt.sign(
    {
      typ: ACCESS_TYPE,
      email,
      role,
      name,
      tv: Number(tokenVersion) || 0,
    },
    ACCESS_TOKEN_SECRET,
    {
      subject: String(userId),
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
    }
  );
}

/**
 * The refresh token carries a session id (which row in auth_sessions) and a
 * jti (which *generation* of that session). Rotation replaces the jti; a replay
 * of an older jti is what proves theft.
 */
export function signRefreshToken({ userId, sessionId, jti }) {
  return jwt.sign(
    {
      typ: REFRESH_TYPE,
      sid: sessionId,
    },
    REFRESH_TOKEN_SECRET,
    {
      subject: String(userId),
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
      jwtid: jti,
    }
  );
}

function verify(token, secret, expectedType) {
  const payload = jwt.verify(token, secret, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    algorithms: ['HS256'],
  });
  if (payload?.typ !== expectedType) {
    // Blocks using a refresh token as a bearer credential and vice versa.
    const err = new Error('Wrong token type');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return payload;
}

export function verifyAccessToken(token) {
  return verify(token, ACCESS_TOKEN_SECRET, ACCESS_TYPE);
}

export function verifyRefreshToken(token) {
  return verify(token, REFRESH_TOKEN_SECRET, REFRESH_TYPE);
}

export function newJti() {
  return crypto.randomUUID();
}

export function refreshExpiryDate() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
