import { Router } from "express";
import { verifyNIN as verifyMeNIN, verifyBVN as verifyMeBVN } from "../services/verifyMeService";
import { qoreVerifyNIN, qoreVerifyBVN } from "../services/qoreIdService";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();

const provider = (process.env.IDENTITY_VERIFICATION_PROVIDER || "").toLowerCase();
const useQoreIdByEnv = provider === "qoreid"
  || ((!!process.env.QOREID_API_KEY || (!!process.env.QOREID_CLIENT_ID && !!process.env.QOREID_CLIENT_SECRET))
      && provider !== "verifyme");
const verificationDisabled = (process.env.DISABLE_ID_VERIFICATION || "").toLowerCase() === "true";

router.post("/nin", rateLimit(), async (req, res) => {
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
    } else if (!process.env.VERIFYME_API_KEY) {
      return res.status(503).json({ message: "Verification service not configured (missing VerifyMe API key)." });
    }

    const result = useQoreIdByEnv ? await qoreVerifyNIN(nin) : await verifyMeNIN(nin);
    return res.json({ success: true, name: result.name, details: result.raw });
  } catch (err: any) {
    // Map timeouts to 504 to avoid generic 500s
    const isTimeout = typeof err?.message === "string" && err.message.includes("timeout");
    const status = isTimeout ? 504 : (err?.response?.status || 500);
    const message = err?.response?.data?.message || err?.message || "Verification service error";
    return res.status(status).json({ message });
  }
});

router.post("/bvn", rateLimit(), async (req, res) => {
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
    } else if (!process.env.VERIFYME_API_KEY) {
      return res.status(503).json({ message: "Verification service not configured (missing VerifyMe API key)." });
    }

    const result = useQoreIdByEnv ? await qoreVerifyBVN(bvn) : await verifyMeBVN(bvn);
    return res.json({ success: true, name: result.name, details: result.raw });
  } catch (err: any) {
    const isTimeout = typeof err?.message === "string" && err.message.includes("timeout");
    const status = isTimeout ? 504 : (err?.response?.status || 500);
    const message = err?.response?.data?.message || err?.message || "Verification service error";
    return res.status(status).json({ message });
  }
});

export default router;