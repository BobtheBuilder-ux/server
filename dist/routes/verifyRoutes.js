"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verifyMeService_1 = require("../services/verifyMeService");
const qoreIdService_1 = require("../services/qoreIdService");
const rateLimit_1 = require("../middlewares/rateLimit");
const router = (0, express_1.Router)();
const provider = (process.env.IDENTITY_VERIFICATION_PROVIDER || "").toLowerCase();
const useQoreIdByEnv = provider === "qoreid"
    || ((!!process.env.QOREID_API_KEY || (!!process.env.QOREID_CLIENT_ID && !!process.env.QOREID_CLIENT_SECRET))
        && provider !== "verifyme");
const verificationDisabled = (process.env.DISABLE_ID_VERIFICATION || "").toLowerCase() === "true";
router.post("/nin", (0, rateLimit_1.rateLimit)(), async (req, res) => {
    try {
        if (verificationDisabled) {
            return res.json({ success: true, disabled: true });
        }
        const { nin } = req.body || {};
        if (!nin || typeof nin !== "string" || !/^\d{11}$/.test(nin)) {
            return res.status(400).json({ message: "Invalid NIN format. Must be 11 digits." });
        }
        if (useQoreIdByEnv) {
            if (!process.env.QOREID_API_KEY && !(process.env.QOREID_CLIENT_ID && process.env.QOREID_CLIENT_SECRET)) {
                return res.status(503).json({ message: "Verification service not configured (missing QoreID credentials)." });
            }
        }
        else if (!process.env.VERIFYME_API_KEY) {
            return res.status(503).json({ message: "Verification service not configured (missing VerifyMe API key)." });
        }
        const result = useQoreIdByEnv ? await (0, qoreIdService_1.qoreVerifyNIN)(nin) : await (0, verifyMeService_1.verifyNIN)(nin);
        return res.json({ success: true, name: result.name, details: result.raw });
    }
    catch (err) {
        const isTimeout = typeof err?.message === "string" && err.message.includes("timeout");
        const status = isTimeout ? 504 : (err?.response?.status || 500);
        const message = err?.response?.data?.message || err?.message || "Verification service error";
        return res.status(status).json({ message });
    }
});
router.post("/bvn", (0, rateLimit_1.rateLimit)(), async (req, res) => {
    try {
        if (verificationDisabled) {
            return res.json({ success: true, disabled: true });
        }
        const { bvn } = req.body || {};
        if (!bvn || typeof bvn !== "string" || !/^\d{11}$/.test(bvn)) {
            return res.status(400).json({ message: "Invalid BVN format. Must be 11 digits." });
        }
        if (useQoreIdByEnv) {
            if (!process.env.QOREID_API_KEY && !(process.env.QOREID_CLIENT_ID && process.env.QOREID_CLIENT_SECRET)) {
                return res.status(503).json({ message: "Verification service not configured (missing QoreID credentials)." });
            }
        }
        else if (!process.env.VERIFYME_API_KEY) {
            return res.status(503).json({ message: "Verification service not configured (missing VerifyMe API key)." });
        }
        const result = useQoreIdByEnv ? await (0, qoreIdService_1.qoreVerifyBVN)(bvn) : await (0, verifyMeService_1.verifyBVN)(bvn);
        return res.json({ success: true, name: result.name, details: result.raw });
    }
    catch (err) {
        const isTimeout = typeof err?.message === "string" && err.message.includes("timeout");
        const status = isTimeout ? 504 : (err?.response?.status || 500);
        const message = err?.response?.data?.message || err?.message || "Verification service error";
        return res.status(status).json({ message });
    }
});
exports.default = router;
