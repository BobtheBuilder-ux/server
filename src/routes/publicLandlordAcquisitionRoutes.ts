import express from "express";
import { submitAcquisition } from "../controllers/landlordAcquisitionController";

const router = express.Router();

router.post("/", submitAcquisition);

export default router;

