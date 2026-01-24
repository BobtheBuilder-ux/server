import express from "express";
import {
  getProperties,
  getProperty,
  createProperty,
} from "../controllers/propertyControllers";
import { getPropertyLeases } from "../controllers/leaseControllers";
import multer from "multer";
import { betterAuthMiddleware } from "../middleware/betterAuthMiddleware";


const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false); // Reject file silently instead of throwing error
    }
  }
});

const router = express.Router();

router.get("/", getProperties);
router.get("/:id", getProperty);
router.get(
  "/:propertyId/leases",
  betterAuthMiddleware(["landlord", "tenant", "admin"]),
  getPropertyLeases
);
router.post(
  "/",
  betterAuthMiddleware(["landlord"]),
  upload.fields([
    { name: 'photos', maxCount: 20 },
    { name: 'video', maxCount: 1 }
  ]),
  createProperty
);

export default router;
