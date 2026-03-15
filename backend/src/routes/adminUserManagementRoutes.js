import express from "express";
const router = express.Router();
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  findUserByEmail,
  resetUserPassword,
  updateUserRole,
  updateUserStatus
} from '../controllers/adminUserManagementController.js';

// All routes here are ADMIN-only
router.use(authenticateToken, authorizeRoles('ADMIN'));

router.post('/find-by-email', findUserByEmail);
router.patch('/:id/password', resetUserPassword);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);

export default router;

