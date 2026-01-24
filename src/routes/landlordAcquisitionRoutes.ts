import express from "express";
import { authMiddleware, AdminPrivilege } from "../middleware/authMiddleware";
import { listAcquisitions, updateAcquisitionStatus } from "../controllers/landlordAcquisitionController";

const router = express.Router();

router.get("/", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), listAcquisitions);
router.put("/:id/status", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), updateAcquisitionStatus);

export default router;

