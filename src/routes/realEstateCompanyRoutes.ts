import { Router } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuthMiddleware";
import { 
  registerCompany, 
  getCompanyProfile, 
  getAllCompanies, 
  getCompanyById, 
  updateCompanyStatus,
  updateCompanyProfile
} from "../controllers/realEstateCompanyControllers";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public routes
router.get("/", getAllCompanies);
router.get("/:id", getCompanyById);

// Protected routes
router.post(
  "/register", 
  betterAuthMiddleware(["tenant", "landlord", "sale", "agent", "admin"]), 
  upload.single("logo"), 
  registerCompany
);

router.get(
  "/me", 
  betterAuthMiddleware(["tenant", "landlord", "sale", "agent", "admin", "real_estate_company"]), 
  getCompanyProfile
);

router.put(
  "/me", 
  betterAuthMiddleware(["real_estate_company", "admin"]), 
  upload.single("logo"), 
  updateCompanyProfile
);

// Admin routes
router.patch(
  "/:id/status", 
  betterAuthMiddleware(["admin"]), 
  updateCompanyStatus
);

export default router;
