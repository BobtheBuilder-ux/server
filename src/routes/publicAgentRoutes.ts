import express from "express";
import { createAgent } from "../controllers/adminControllers";

const router = express.Router();

// Public agent creation route (no authentication required)
router.post("/agents", createAgent);

export default router;