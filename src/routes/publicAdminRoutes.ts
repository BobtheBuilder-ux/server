import express from "express";
import { createAdmin } from "../controllers/adminControllers";

const router = express.Router();

// Public admin routes that don't require authentication
router.post("/admins", createAdmin);

export default router;