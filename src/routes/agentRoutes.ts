import express from "express";
import {
  getAgentLeads,
  getAgentClients,
  getAgentTasks,
  updateLeadStatus,
  updateTaskStatus,
  updateAgentSettings,
} from "../controllers/agentControllers";

const router = express.Router();

router.get("/leads", getAgentLeads);
router.get("/clients", getAgentClients);
router.get("/tasks", getAgentTasks);
router.put("/leads/:leadId/status", updateLeadStatus);
router.put("/tasks/:taskId/status", updateTaskStatus);
router.put("/:authId", updateAgentSettings);

export default router;