import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  ownerAbnormalDrops,
  ownerLatestForecasts,
  ownerForecasts,
  analystForecast,
  analystForecastSnapshots,
  analystSegments,
  analystForecasts,
  analystAbnormalDrops,
  staffInventoryRisk,
  staffCustomerUpsell,
  staffSalesSummary,
} from '../controllers/insightsController.js';

const router = express.Router();

// Owner: high-level alerting only
router.get('/owner/alerts/abnormal-drops', authenticateToken, authorizeRoles('OWNER', 'ADMIN'), ownerAbnormalDrops);

// Owner: latest persisted forecast batch (for charts / planning)
router.get('/owner/forecasts/latest', authenticateToken, authorizeRoles('OWNER', 'ADMIN'), ownerLatestForecasts);
router.get('/owner/forecasts', authenticateToken, authorizeRoles('OWNER', 'ADMIN'), ownerForecasts);

// Analyst: full forecast payload + metrics + derived trust/trend
router.get('/analyst/forecast/:product', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystForecast);

// Analyst: prior persisted runs for a product (compare forecast vs later actuals offline)
router.get('/analyst/forecast/:product/snapshots', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystForecastSnapshots);

// Analyst: segment profiles + top products per segment
router.get('/analyst/segments', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystSegments);

// Analyst: all forecasts (for dashboard display)
router.get('/analyst/forecasts', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystForecasts);

// Analyst: abnormal drop alerts (for dashboard display)
router.get('/analyst/abnormal-drops', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystAbnormalDrops);

// Staff: simplified inventory risk guidance
router.get('/staff/inventory/risk', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), staffInventoryRisk);

// Staff: customer segment + upsell hint (customerId currently maps to ML customer_id)
router.get('/staff/customers/:customerId/upsell', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), staffCustomerUpsell);

// Staff: sales summary (today + week)
router.get('/staff/sales-summary', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), staffSalesSummary);

export default router;

