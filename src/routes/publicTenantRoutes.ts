import express from "express";
import {
  validateLandlordRegistrationLink,
  createTenantViaLandlordLink,
} from "../controllers/tenantControllers";

const router = express.Router();

// Public routes that don't require authentication
router.get("/validate-link/:registrationLink", validateLandlordRegistrationLink);
router.post("/register-via-link", createTenantViaLandlordLink);

export default router;