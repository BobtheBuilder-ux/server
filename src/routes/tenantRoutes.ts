import express from "express";
import {
  getTenant,
  createTenant,
  updateTenant,
  getCurrentResidences,
  addFavoriteProperty,
  removeFavoriteProperty,
  getTenantLandlordInfo,
} from "../controllers/tenantControllers";

const router = express.Router();

router.get("/:authId", getTenant);
router.put("/:authId", updateTenant);
router.post("/", createTenant);
router.get("/:authId/current-residences", getCurrentResidences);
router.get("/:authId/landlord-info", getTenantLandlordInfo);
router.post("/:authId/favorites/:propertyId", addFavoriteProperty);
router.delete("/:authId/favorites/:propertyId", removeFavoriteProperty);

export default router;
