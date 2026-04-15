import express from "express"
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {getSalesSummary} from "../controllers/SalesSummaryController.js"

const router = express().router

router.get('/sales-summary', authenticateToken,  getSalesSummary)

export default router