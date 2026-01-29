import express from "express";
import { authMiddleware, AdminPrivilege } from "../middleware/authMiddleware";
import { betterAuthMiddleware } from "../middleware/betterAuthMiddleware";
import { adminCreateBlogger, createOrUpdatePost, deletePost, getMyPosts, publishPost, upsertCategory, upsertTag } from "../controllers/blogControllers";

const router = express.Router();

// Admin: create blogger accounts
router.post(
  "/admin/bloggers",
  authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]),
  adminCreateBlogger
);

// Blogger management
router.get("/me/posts", betterAuthMiddleware(["blogger", "admin"]), getMyPosts);
router.post("/posts", betterAuthMiddleware(["blogger", "admin"]), createOrUpdatePost);
router.put("/posts", betterAuthMiddleware(["blogger", "admin"]), createOrUpdatePost);
router.post("/posts/:id/publish", betterAuthMiddleware(["blogger", "admin"]), publishPost);
router.delete("/posts/:id", betterAuthMiddleware(["blogger", "admin"]), deletePost);

// Admin manage categories/tags
router.post("/admin/categories", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), upsertCategory);
router.post("/admin/tags", authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]), upsertTag);

export default router;
