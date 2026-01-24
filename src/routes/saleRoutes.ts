import { Router } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuthMiddleware";
import { saleUpload, createSaleListing, getSaleListings, getSaleListing, updateSaleListing, approveSaleListing, rejectSaleListing, verifySaleListing, submitSaleNegotiation, getSaleNegotiations, submitSaleFullPayment, getSaleFullPayments } from "../controllers/saleControllers";

const router = Router();

// Public fetch listings
router.get("/listings", getSaleListings);
router.get("/listings/:id", getSaleListing);

// Sale user submissions
router.post(
  "/listings",
  betterAuthMiddleware(["sale", "admin"]),
  saleUpload.fields([
    { name: "proof", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 4 },
    { name: "surveyPlan", maxCount: 1 },
    { name: "titleDocs", maxCount: 10 },
    { name: "idUpload", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  createSaleListing
);

router.patch(
  "/listings/:id",
  betterAuthMiddleware(["sale", "admin"]),
  updateSaleListing
);

router.put(
  "/listings/:id",
  betterAuthMiddleware(["sale", "admin"]),
  updateSaleListing
);

// Admin approval workflow
router.post(
  "/admin/listings/:id/approve",
  betterAuthMiddleware(["admin"]),
  approveSaleListing
);

router.post(
  "/admin/listings/:id/reject",
  betterAuthMiddleware(["admin"]),
  rejectSaleListing
);

// Align with client RTK Query paths
router.post(
  "/listings/:id/approve",
  betterAuthMiddleware(["admin"]),
  approveSaleListing
);
router.post(
  "/listings/:id/reject",
  betterAuthMiddleware(["admin"]),
  rejectSaleListing
);

// Admin verification outcome & supporting documents
router.post(
  "/admin/listings/:id/verify",
  betterAuthMiddleware(["admin"]),
  saleUpload.fields([
    { name: "supportingDocs", maxCount: 10 },
  ]),
  verifySaleListing
);

// Negotiations
router.post(
  "/listings/:id/negotiations",
  betterAuthMiddleware(["tenant", "landlord", "sale", "agent", "admin"]),
  submitSaleNegotiation
);
router.get(
  "/listings/:id/negotiations",
  betterAuthMiddleware(["admin"]),
  getSaleNegotiations
);

// Full payments (receipt upload)
router.post(
  "/listings/:id/full-payment",
  betterAuthMiddleware(["tenant", "landlord", "sale", "agent", "admin"]),
  saleUpload.single("receipt"),
  submitSaleFullPayment
);
router.get(
  "/listings/:id/full-payments",
  betterAuthMiddleware(["admin"]),
  getSaleFullPayments
);

export default router;