import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  ownerAbnormalDrops,
  ownerLatestForecasts,
  analystForecast,
  analystForecastSnapshots,
  analystSegments,
  staffInventoryRisk,
  staffCustomerUpsell,
} from '../controllers/insightsController.js';

const router = express.Router();

// Owner: high-level alerting only
router.get('/owner/alerts/abnormal-drops', authenticateToken, authorizeRoles('OWNER', 'ADMIN'), ownerAbnormalDrops);

// Owner: latest persisted forecast batch (for charts / planning)
router.get('/owner/forecasts/latest', authenticateToken, authorizeRoles('OWNER', 'ADMIN'), ownerLatestForecasts);

// Analyst: full forecast payload + metrics + derived trust/trend
router.get('/analyst/forecast/:product', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystForecast);

// Analyst: prior persisted runs for a product (compare forecast vs later actuals offline)
router.get('/analyst/forecast/:product/snapshots', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystForecastSnapshots);

// Analyst: segment profiles + top products per segment
router.get('/analyst/segments', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), analystSegments);

// Staff: simplified inventory risk guidance
router.get('/staff/inventory/risk', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), staffInventoryRisk);

// Staff: customer segment + upsell hint (customerId currently maps to ML customer_id)
router.get('/staff/customers/:customerId/upsell', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), staffCustomerUpsell);

export default router;

