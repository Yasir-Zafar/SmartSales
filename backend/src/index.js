import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { corsOptions, IS_PRODUCTION, TRUST_PROXY, ALLOWED_ORIGINS } from './config/security.js';
import { issueCsrfCookie, requireCsrfToken } from './middleware/csrf.js';
import { checkAuthSchema } from './utils/preflight.js';

import authLoginRoutes from './routes/authLoginRoutes.js';
import adminEndpointRoutes from './routes/adminEndpointRoutes.js';
import adminUserManagementRoutes from './routes/adminUserManagementRoutes.js';
import currentUserRoutes from './routes/currentUserRoutes.js';
import csvRoutes from './routes/csvRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
import analystRoutes from './routes/analystRoutes.js';
import salesSummaryRoutes from './routes/salesSummaryRoute.js';
import productsRoutes from './routes/productsRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Transport ────────────────────────────────────────────────────────────────
// Behind a proxy, req.ip and req.secure only tell the truth once Express is told
// to read X-Forwarded-*. Rate limiting and Secure cookies both depend on it.
if (TRUST_PROXY) app.set('trust proxy', TRUST_PROXY);
app.disable('x-powered-by');

/** In production every plain-HTTP request is bounced to HTTPS before it can carry a cookie. */
if (IS_PRODUCTION && process.env.DISABLE_HTTPS_REDIRECT !== 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// ── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // This is a JSON API: nothing here should ever be framed, scripted or
        // embedded, so the policy is as close to "deny everything" as it gets.
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        connectSrc: ["'self'", ...ALLOWED_ORIGINS],
      },
    },
    // Tells browsers to refuse plain HTTP for this host for a year.
    hsts: IS_PRODUCTION ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// ── Parsing ──────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(cookieParser());
// A body limit stops a single request from exhausting server memory. CSV uploads
// go through multer, which has its own limit, so this only caps JSON payloads.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Rate limiting ────────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 300),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Slow down a moment.', code: 'RATE_LIMITED' },
  })
);

// ── CSRF ─────────────────────────────────────────────────────────────────────
// Every response hands out a CSRF cookie; every unsafe method must echo it.
app.use(issueCsrfCookie);
app.use('/api', requireCsrfToken);

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ service: 'SmartSales API', status: 'running' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Sign in / refresh / sign out / sessions / password change
app.use('/api/auth', authLoginRoutes);

// Admin-only user provisioning
app.use('/api/admin/create-user', adminEndpointRoutes);

// Admin-only user management
app.use('/api/admin/users', adminUserManagementRoutes);

// Current user profile (kept for backwards compatibility with /api/auth/me)
app.use('/api/me', currentUserRoutes);

// Product catalog (inventory pages)
app.use('/api/products', productsRoutes);

// Daily sales CSV upload + history + records
app.use('/api/csv', csvRoutes);

// ML insights (owner / analyst / staff views)
app.use('/api/insights', insightsRoutes);

// Analyst: training CSV export + ML reload
app.use('/api/analyst', analystRoutes);

// Staff sales summary (legacy path, superseded by /api/insights/staff/sales-summary)
app.use('/api/insights/staff', salesSummaryRoutes);

// ── Errors ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
  if (err?.message?.includes('is not allowed by CORS')) {
    return res.status(403).json({ message: err.message, code: 'CORS_BLOCKED' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' });
  }

  console.error('❌ Error:', err);
  // Never leak stack traces or internal messages to a production client.
  return res.status(err.status || 500).json({
    message: IS_PRODUCTION ? 'Internal server error' : err.message || 'Internal server error',
    code: 'SERVER_ERROR',
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`✅ SmartSales API running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔐 Cookie auth · CSRF on · helmet on · ${IS_PRODUCTION ? 'production' : 'development'} mode`);
  if (ALLOWED_ORIGINS.length) console.log(`🌐 CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);

  checkAuthSchema().catch((err) => console.warn('⚠️  Could not verify auth schema:', err?.message || err));
});

export default app;
