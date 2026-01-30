import express from "express";
import { authMiddleware, AdminPrivilege } from "../middleware/authMiddleware";
import { betterAuthMiddleware } from "../middleware/betterAuthMiddleware";
import { adminCreateBlogger, createOrUpdatePost, deletePost, getBloggerProfile, getCategories, getMyPosts, getTags, publishPost, upsertCategory, upsertTag } from "../controllers/blogControllers";

const router = express.Router();

// Public/Common
router.get("/categories", getCategories);
router.get("/tags", getTags);

// Admin: create blogger accounts
router.post(
  "/admin/bloggers",
  authMiddleware(["admin"], [AdminPrivilege.USER_MANAGEMENT]),
  adminCreateBlogger
);

// Blogger management
router.get("/me/profile", betterAuthMiddleware(["blogger", "admin"]), getBloggerProfile);
router.get("/me/posts", betterAuthMiddleware(["blogger", "admin"]), getMyPosts);
router.post("/posts", betterAuthMiddleware(["blogger", "admin"]), createOrUpdatePost);
router.put("/posts", betterAuthMiddleware(["blogger", "admin"]), createOrUpdatePost);
router.post("/posts/:id/publish", betterAuthMiddleware(["blogger", "admin"]), publishPost);
router.delete("/posts/:id", betterAuthMiddleware(["blogger", "admin"]), deletePost);

// Admin manage categories/tags
router.post("/admin/categories", betterAuthMiddleware(["admin", "blogger"]), upsertCategory);
router.post("/admin/tags", betterAuthMiddleware(["admin", "blogger"]), upsertTag);

export default router;
