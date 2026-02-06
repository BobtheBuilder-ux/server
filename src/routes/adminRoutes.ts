import express from "express";
import { authMiddleware, AdminPrivilege } from "../middleware/authMiddleware";
import surveyRoutes from "./surveyRoutes";
import { adminCreateLandlord, listLandlords, impersonateLandlord } from "../controllers/landlordControllers";
import {
  getAnalytics,
  getAllUsers,
  createUser,
  getAllProperties,
  updateUserStatus,
  deleteUser,
  updatePropertyStatus,
  deleteProperty,
  getAdminSettings,
  updateAdminSettings,
  getAdmin,
  getAgent,
  getLandlordRegistrations,
  getLandlordRegistrationStats,
  getAgentRegistrations,
  getAgentRegistrationStats,
  assignCodeToAgent,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getTaskStats,
  getUserPrivileges,
  updateUserRole,
  getAllPrivileges,
  getPrivilegeMatrix,
  checkUserPrivilege,
  getAdminActivityLog,
} from "../controllers/adminControllers";

const router = express.Router();

// Analytics routes - require analytics access
router.get("/analytics", authMiddleware(["admin"], [AdminPrivilege.ANALYTICS_ACCESS]), getAnalytics);

// User management routes - require user management privilege
router.get("/users", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), getAllUsers);
router.post("/users", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), createUser);
router.put("/users/:userId/status", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), updateUserStatus);
router.delete("/users/:userId", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), deleteUser);

// Property management routes - allow admin and agents with property management privilege
router.get("/properties", authMiddleware(["admin", "agent"], [AdminPrivilege.PROPERTY_MANAGEMENT]), getAllProperties);
router.put("/properties/:propertyId/status", authMiddleware(["admin", "agent"], [AdminPrivilege.PROPERTY_MANAGEMENT]), updatePropertyStatus);
router.delete("/properties/:propertyId", authMiddleware(["admin"], [AdminPrivilege.PROPERTY_MANAGEMENT]), deleteProperty);

// System settings routes - require system settings privilege
router.get("/settings", authMiddleware(["admin"], [AdminPrivilege.SYSTEM_SETTINGS]), getAdminSettings);
router.put("/settings", authMiddleware(["admin"], [AdminPrivilege.SYSTEM_SETTINGS]), updateAdminSettings);

// Admin and agent profile routes - require user management privilege
router.get("/agents/:cognitoId", authMiddleware(["admin", "agent"], []), getAgent);
router.get("/admins/:cognitoId", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), getAdmin);

// Registration management routes - require user management privilege
router.get("/landlord-registrations", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), getLandlordRegistrations);
router.get("/landlord-registration-stats", authMiddleware(["admin"], [AdminPrivilege.ANALYTICS_ACCESS]), getLandlordRegistrationStats);

// Agent Registration Code Management - require agent management privilege
router.get("/agent-registrations", authMiddleware(["admin"], [AdminPrivilege.AGENT_MANAGEMENT]), getAgentRegistrations);
router.get("/agent-registration-stats", authMiddleware(["admin"], [AdminPrivilege.ANALYTICS_ACCESS]), getAgentRegistrationStats);
router.post("/assign-code-to-agent", authMiddleware(["admin"], [AdminPrivilege.AGENT_MANAGEMENT]), assignCodeToAgent);

// Task Management - allow admin and agents with task management privilege
router.post("/tasks", authMiddleware(["admin"], [AdminPrivilege.TASK_MANAGEMENT]), createTask);
router.get("/tasks", authMiddleware(["admin", "agent"], [AdminPrivilege.TASK_MANAGEMENT]), getTasks);
router.put("/tasks/:id", authMiddleware(["admin", "agent"], [AdminPrivilege.TASK_MANAGEMENT]), updateTask);
router.delete("/tasks/:id", authMiddleware(["admin"], [AdminPrivilege.TASK_MANAGEMENT]), deleteTask);
router.get("/task-stats", authMiddleware(["admin"], [AdminPrivilege.ANALYTICS_ACCESS]), getTaskStats);

router.post("/landlords", authMiddleware(["admin", "agent"], [AdminPrivilege.PROPERTY_MANAGEMENT]), adminCreateLandlord);
router.get("/landlords", authMiddleware(["admin", "agent"], [AdminPrivilege.PROPERTY_MANAGEMENT]), listLandlords);
router.post("/landlords/:userId/impersonate", authMiddleware(["admin", "agent"], [AdminPrivilege.PROPERTY_MANAGEMENT]), impersonateLandlord);

// ============ PRIVILEGE MANAGEMENT ROUTES ============

// Get user privileges
router.get("/users/:userId/privileges", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), getUserPrivileges);

// Update user role (requires SUPER_ADMIN)
router.put("/users/:userId/role", authMiddleware(["admin"], [AdminPrivilege.SUPER_ADMIN]), updateUserRole);

// Get all available privileges
router.get("/privileges", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), getAllPrivileges);

// Get privilege matrix for all roles
router.get("/privilege-matrix", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), getPrivilegeMatrix);

// Check if current user has specific privilege
router.get("/check-privilege/:privilege", authMiddleware(["admin", "agent", "landlord", "tenant"]), checkUserPrivilege);

// Get admin activity log
router.get("/activity-log", authMiddleware(["admin"], [AdminPrivilege.SUPER_ADMIN]), getAdminActivityLog);

// ============ SURVEY MANAGEMENT ROUTES ============

// Survey statistics - require analytics access
router.use("/surveys", authMiddleware(["admin"], [AdminPrivilege.ANALYTICS_ACCESS]), surveyRoutes);

export default router;
