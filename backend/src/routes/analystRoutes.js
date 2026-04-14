import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { exportTrainingCsv, retrainReloadMl } from '../controllers/analystExportController.js';

const router = express.Router();

router.get('/training-export', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), exportTrainingCsv);
router.post('/retrain', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), retrainReloadMl);

export default router;
