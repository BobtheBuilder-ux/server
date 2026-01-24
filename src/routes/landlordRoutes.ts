import express from "express";
import {
  getLandlord,
  createLandlord,
  updateLandlord,
  getLandlordProperties,
  registerLandlordWithCode,
  generateTenantRegistrationLink,
  getTenantRegistrationLink,
  getLandlordTenants,
  editTenantInfo,
} from "../controllers/landlordControllers";

const router = express.Router();

router.get("/:authId", getLandlord);
router.put("/:authId", updateLandlord);
router.get("/:authId/properties", getLandlordProperties);
router.get("/:authId/tenants", getLandlordTenants);
router.put("/:authId/edit-tenant", editTenantInfo);
router.post("/", createLandlord);
router.post("/register-with-code", registerLandlordWithCode);
router.post("/:authId/generate-tenant-link", generateTenantRegistrationLink);
router.get("/:authId/tenant-registration-link", getTenantRegistrationLink);

export default router;
