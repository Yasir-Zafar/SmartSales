import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { exportTrainingCsv, exportTrainingCsvInternal, retrainReloadMl } from '../controllers/analystExportController.js';

const router = express.Router();

router.get('/training-export', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), exportTrainingCsv);
router.get('/training-export/internal', exportTrainingCsvInternal);
router.post('/retrain', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), retrainReloadMl);

export default router;
