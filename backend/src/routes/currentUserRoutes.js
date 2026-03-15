import express from "express";
const router = express.Router();
import {authenticateToken} from '../middleware/auth.js';
import {getCurrentUserProfile} from "../controllers/currentUserController.js";

router.get('/', authenticateToken, getCurrentUserProfile);

export default router;