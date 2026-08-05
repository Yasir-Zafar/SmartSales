import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.js';
import { requireCsrfToken } from '../middleware/csrf.js';
import {
  changePassword,
  endSession,
  getCurrentUser,
  getSessions,
  login,
  logout,
  logoutEverywhere,
  refresh,
} from '../controllers/authLoginController.js';

const router = express.Router();

/**
 * Login is the one endpoint an attacker can hammer with a password list, so it
 * gets a much tighter budget than the rest of the API.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Keyed by IP *and* account, so one attacker cannot lock out an entire office
  // behind a shared NAT, and spraying one password across many accounts is
  // still throttled per address. ipKeyGenerator normalises IPv6 to its /64
  // prefix — without it, a single IPv6 host could rotate addresses to evade
  // the limit.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`,
  message: { message: 'Too many sign-in attempts. Try again in a few minutes.', code: 'RATE_LIMITED' },
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many refresh attempts', code: 'RATE_LIMITED' },
});

const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many password change attempts. Try again later.', code: 'RATE_LIMITED' },
});

router.post('/login', loginLimiter, requireCsrfToken, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);

router.post('/logout-all', authenticateToken, requireCsrfToken, logoutEverywhere);
router.post('/change-password', passwordLimiter, authenticateToken, requireCsrfToken, changePassword);

router.get('/me', authenticateToken, getCurrentUser);
router.get('/sessions', authenticateToken, getSessions);
router.delete('/sessions/:id', authenticateToken, requireCsrfToken, endSession);

export default router;
