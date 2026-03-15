import express from 'express';
import multer from 'multer';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { uploadCSV, getCSV } from '../controllers/csvController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

//upload daily sales csv
router.post('/', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), upload.single('file'), uploadCSV);

//see upload history
router.get('/', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), getCSV);

export default router;