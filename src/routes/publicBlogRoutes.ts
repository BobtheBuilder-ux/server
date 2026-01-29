import express from "express";
import { getPostBySlug, listPublishedPosts, getRelatedPosts } from "../controllers/blogControllers";

const router = express.Router();

router.get("/posts", listPublishedPosts);
router.get("/posts/:slug", getPostBySlug);
router.get("/posts/:id/related", getRelatedPosts);

export default router;
