import { Router } from "express";
import {
  getLandlordEarnings,
  createWithdrawalRequest,
  getLandlordWithdrawals
} from "../controllers/earningsControllers";

const router = Router();

// GET /api/earnings/landlord/:authId - Get landlord earnings statistics
router.get("/landlord/:authId", getLandlordEarnings);

// POST /api/earnings/landlord/:authId/withdraw - Create withdrawal request
router.post("/landlord/:authId/withdraw", createWithdrawalRequest);

// GET /api/earnings/landlord/:authId/withdrawals - Get withdrawal history
router.get("/landlord/:authId/withdrawals", getLandlordWithdrawals);

export default router;