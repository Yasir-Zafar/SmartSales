import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { getSalesSummary } from '../controllers/SalesSummaryController.js';

// NOTE: this was `express().router`, which hung the handler off a throwaway app
// instead of an exported Router — the route never actually mounted.
const router = express.Router();

// Superseded by /api/insights/staff/sales-summary, which anchors to the latest
// uploaded sale date rather than the wall clock. Kept on a distinct path so it
// no longer collides with (and is shadowed by) the insights route.
router.get(
  '/sales-summary-legacy',
  authenticateToken,
  authorizeRoles('STAFF', 'OWNER', 'ANALYST', 'ADMIN'),
  getSalesSummary
);

export default router;
