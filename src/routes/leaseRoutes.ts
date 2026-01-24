import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { getLeasePayments, getLeases } from "../controllers/leaseControllers";

const router = express.Router();

router.get("/", authMiddleware(["landlord", "tenant"]), getLeases);
router.get(
  "/:id/payments",
  authMiddleware(["landlord", "tenant"]),
  getLeasePayments
);

export default router;
