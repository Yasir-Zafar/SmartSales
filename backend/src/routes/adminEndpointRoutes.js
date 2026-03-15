import express from "express";
const router = express.Router();
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {adminEndpointCreation} from "../controllers/adminEndpointController.js";

router.post('/', authenticateToken, authorizeRoles('ADMIN'), adminEndpointCreation);

export default router;