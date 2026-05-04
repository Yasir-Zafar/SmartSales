import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { listProducts } from '../controllers/productsController.js';

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('OWNER', 'STAFF', 'ADMIN'), listProducts);

export default router;
