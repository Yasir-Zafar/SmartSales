import express from 'express';
import multer from 'multer';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { uploadCSV, getCSV, getSalesRecords } from '../controllers/csvController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

//upload daily sales csv
router.post('/', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), upload.single('file'), uploadCSV);

//see upload history
router.get('/', authenticateToken, authorizeRoles('STAFF', 'ADMIN', 'ANALYST'), getCSV);

// get sales records for analysts
router.get('/records', authenticateToken, authorizeRoles('ANALYST', 'ADMIN'), getSalesRecords);

export default router;