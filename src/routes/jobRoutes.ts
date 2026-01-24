import express from "express";
import {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getActiveJobs,
  submitJobApplication,
  getJobApplications,
  getJobApplicationById,
  updateJobApplicationStatus,
  rateJobApplication,
  getJobApplicationRatings,
  getJobApplicationsByStatus,
  searchJobApplications,
  getJobStats,
  getApplicationStats,
  exportJobApplications,
  getGeneralJobStats,
} from "../controllers/jobControllers";

const router = express.Router();

// Job Management Routes (Admin)
router.post("/", createJob);
router.get("/", getAllJobs);
router.get("/active", getActiveJobs);
router.get("/general-stats", getGeneralJobStats);

// Job Application Routes (must come before parameterized job routes)
router.get("/applications", searchJobApplications);
router.get("/applications/stats", getApplicationStats);
router.get("/applications/status/:status", getJobApplicationsByStatus);
router.get("/applications/export", exportJobApplications);
router.get("/applications/:id", getJobApplicationById);
router.put("/applications/:id/status", updateJobApplicationStatus);

// Parameterized Job Routes (must come after specific routes)
router.get("/:id", getJobById);
router.put("/:id", updateJob);
router.delete("/:id", deleteJob);
router.get("/:id/stats", getJobStats);
router.post("/:id/apply", submitJobApplication);
router.get("/:id/applications", getJobApplications);

// Rating System Routes
router.post("/applications/:id/rate", rateJobApplication);
router.get("/applications/:id/ratings", getJobApplicationRatings);

export default router;