import express from "express";
import { betterAuthMiddleware } from "../middleware/betterAuthMiddleware";
import {
  initializePayment,
  verifyPayment,
  getPaymentHistory,
  createPayment
} from "../controllers/paymentControllers";

const router = express.Router();

// Initialize payment with Flutterwave
router.post("/initialize", betterAuthMiddleware(["tenant"]), initializePayment);

// Verify payment callback from Flutterwave
router.get("/verify/:reference", verifyPayment);

// Get payment history for a lease
router.get("/history/:leaseId", betterAuthMiddleware(["tenant", "landlord", "admin"]), getPaymentHistory);

// Create a new payment record
router.post("/create", betterAuthMiddleware(["tenant", "admin"]), createPayment);

export default router;