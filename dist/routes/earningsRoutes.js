"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const earningsControllers_1 = require("../controllers/earningsControllers");
const router = (0, express_1.Router)();
router.get("/landlord/:authId", earningsControllers_1.getLandlordEarnings);
router.post("/landlord/:authId/withdraw", earningsControllers_1.createWithdrawalRequest);
router.get("/landlord/:authId/withdrawals", earningsControllers_1.getLandlordWithdrawals);
exports.default = router;
