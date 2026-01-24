"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const betterAuthMiddleware_1 = require("../middleware/betterAuthMiddleware");
const saleControllers_1 = require("../controllers/saleControllers");
const router = (0, express_1.Router)();
router.get("/listings", saleControllers_1.getSaleListings);
router.get("/listings/:id", saleControllers_1.getSaleListing);
router.post("/listings", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["sale", "admin"]), saleControllers_1.saleUpload.fields([
    { name: "proof", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 4 },
    { name: "surveyPlan", maxCount: 1 },
    { name: "titleDocs", maxCount: 10 },
    { name: "idUpload", maxCount: 1 },
    { name: "signature", maxCount: 1 },
]), saleControllers_1.createSaleListing);
router.patch("/listings/:id", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["sale", "admin"]), saleControllers_1.updateSaleListing);
router.put("/listings/:id", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["sale", "admin"]), saleControllers_1.updateSaleListing);
router.post("/admin/listings/:id/approve", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), saleControllers_1.approveSaleListing);
router.post("/admin/listings/:id/reject", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), saleControllers_1.rejectSaleListing);
router.post("/listings/:id/approve", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), saleControllers_1.approveSaleListing);
router.post("/listings/:id/reject", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), saleControllers_1.rejectSaleListing);
router.post("/admin/listings/:id/verify", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), saleControllers_1.saleUpload.fields([
    { name: "supportingDocs", maxCount: 10 },
]), saleControllers_1.verifySaleListing);
router.post("/listings/:id/negotiations", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["tenant", "landlord", "sale", "agent", "admin"]), saleControllers_1.submitSaleNegotiation);
router.get("/listings/:id/negotiations", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), saleControllers_1.getSaleNegotiations);
router.post("/listings/:id/full-payment", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["tenant", "landlord", "sale", "agent", "admin"]), saleControllers_1.saleUpload.single("receipt"), saleControllers_1.submitSaleFullPayment);
router.get("/listings/:id/full-payments", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), saleControllers_1.getSaleFullPayments);
exports.default = router;
