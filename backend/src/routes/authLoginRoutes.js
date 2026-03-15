import express from "express";
const router = express.Router();
import {loginEndpointSupabaseAuth} from "../controllers/authLoginController.js";

// Login endpoint using Supabase Auth
router.post('/', loginEndpointSupabaseAuth);

export default router;