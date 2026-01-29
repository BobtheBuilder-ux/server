"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertTag = exports.upsertCategory = exports.getRelatedPosts = exports.getPostBySlug = exports.listPublishedPosts = exports.deletePost = exports.publishPost = exports.createOrUpdatePost = exports.getMyPosts = exports.adminCreateBlogger = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const betterAuthMiddleware_1 = require("../middleware/betterAuthMiddleware");
const computeReadingTime = (html) => {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = text ? text.split(" ").length : 0;
    return Math.max(1, Math.round(words / 200));
};
const adminCreateBlogger = async (req, res) => {
    try {
        const { userId, email, name, bio, avatarUrl } = req.body || {};
        let targetUserId = userId;
        if (!targetUserId && email) {
            const [existing] = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email)).limit(1);
            if (existing) {
                targetUserId = existing.id;
            }
            else {
                return res.status(400).json({ error: "User not found by email. Provide userId of an existing account." });
            }
        }
        if (!targetUserId) {
            return res.status(400).json({ error: "userId or email is required" });
        }
        await (0, betterAuthMiddleware_1.createUserProfile)(targetUserId, "blogger", { bio, avatarUrl });
        return res.json({ success: true });
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to create blogger" });
    }
};
exports.adminCreateBlogger = adminCreateBlogger;
const getMyPosts = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { page = 1, limit = 10, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const where = search
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.blogPosts.authorUserId, req.user.id), (0, drizzle_orm_1.ilike)(schema_1.blogPosts.title, `%${search}%`))
            : (0, drizzle_orm_1.eq)(schema_1.blogPosts.authorUserId, req.user.id);
        const posts = await database_1.db.select().from(schema_1.blogPosts).where(where).orderBy((0, drizzle_orm_1.desc)(schema_1.blogPosts.createdAt)).limit(Number(limit)).offset(offset);
        return res.json({ posts, pagination: { page: Number(page), limit: Number(limit) } });
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to fetch posts" });
    }
};
exports.getMyPosts = getMyPosts;
const createOrUpdatePost = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { id, title, slug, excerpt, contentHtml, featuredImageUrl, featuredImageAlt, status, scheduledFor, metaTitle, metaDescription, ogTitle, ogDescription, ogImageUrl, categoryId, tagIds, internalLinks, } = req.body;
        const readingTime = computeReadingTime(contentHtml || "");
        if (id) {
            const [existing] = await database_1.db.select().from(schema_1.blogPosts).where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, id)).limit(1);
            if (!existing || existing.authorUserId !== req.user.id)
                return res.status(403).json({ error: "Forbidden" });
            const [updated] = await database_1.db
                .update(schema_1.blogPosts)
                .set({
                title,
                slug,
                excerpt,
                contentHtml,
                featuredImageUrl,
                featuredImageAlt,
                status,
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                metaTitle,
                metaDescription,
                ogTitle,
                ogDescription,
                ogImageUrl,
                categoryId,
                readingTimeMinutes: readingTime,
                internalLinks,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, id))
                .returning();
            if (Array.isArray(tagIds)) {
                await database_1.db.delete(schema_1.blogPostTags).where((0, drizzle_orm_1.eq)(schema_1.blogPostTags.postId, id));
                for (const tagId of tagIds) {
                    await database_1.db.insert(schema_1.blogPostTags).values({ postId: id, tagId });
                }
            }
            return res.json(updated);
        }
        else {
            const [created] = await database_1.db
                .insert(schema_1.blogPosts)
                .values({
                authorUserId: req.user.id,
                title,
                slug,
                excerpt,
                contentHtml,
                featuredImageUrl,
                featuredImageAlt,
                status: status || "Draft",
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                metaTitle,
                metaDescription,
                ogTitle,
                ogDescription,
                ogImageUrl,
                categoryId,
                readingTimeMinutes: readingTime,
                internalLinks,
            })
                .returning();
            if (Array.isArray(tagIds) && created?.id) {
                for (const tagId of tagIds) {
                    await database_1.db.insert(schema_1.blogPostTags).values({ postId: created.id, tagId });
                }
            }
            return res.json(created);
        }
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to save post" });
    }
};
exports.createOrUpdatePost = createOrUpdatePost;
const publishPost = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { id } = req.params;
        const [existing] = await database_1.db.select().from(schema_1.blogPosts).where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, Number(id))).limit(1);
        if (!existing || existing.authorUserId !== req.user.id)
            return res.status(403).json({ error: "Forbidden" });
        const [updated] = await database_1.db
            .update(schema_1.blogPosts)
            .set({ status: "Published", publishedAt: new Date(), scheduledFor: null })
            .where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, Number(id)))
            .returning();
        return res.json(updated);
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to publish post" });
    }
};
exports.publishPost = publishPost;
const deletePost = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { id } = req.params;
        const [existing] = await database_1.db.select().from(schema_1.blogPosts).where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, Number(id))).limit(1);
        if (!existing || existing.authorUserId !== req.user.id)
            return res.status(403).json({ error: "Forbidden" });
        await database_1.db.delete(schema_1.blogPostTags).where((0, drizzle_orm_1.eq)(schema_1.blogPostTags.postId, Number(id)));
        await database_1.db.delete(schema_1.blogPosts).where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, Number(id)));
        return res.json({ success: true });
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to delete post" });
    }
};
exports.deletePost = deletePost;
const listPublishedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 12, search, tag, category } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let where = (0, drizzle_orm_1.eq)(schema_1.blogPosts.status, "Published");
        if (search) {
            where = (0, drizzle_orm_1.and)(where, (0, drizzle_orm_1.ilike)(schema_1.blogPosts.title, `%${search}%`));
        }
        if (category) {
            const [cat] = await database_1.db.select().from(schema_1.blogCategories).where((0, drizzle_orm_1.eq)(schema_1.blogCategories.slug, String(category))).limit(1);
            if (cat)
                where = (0, drizzle_orm_1.and)(where, (0, drizzle_orm_1.eq)(schema_1.blogPosts.categoryId, cat.id));
        }
        if (tag) {
            const [t] = await database_1.db.select().from(schema_1.blogTags).where((0, drizzle_orm_1.eq)(schema_1.blogTags.slug, String(tag))).limit(1);
            if (t) {
                const postTagRows = await database_1.db.select().from(schema_1.blogPostTags).where((0, drizzle_orm_1.eq)(schema_1.blogPostTags.tagId, t.id));
                const postIds = postTagRows.map((r) => r.postId);
                if (postIds.length) {
                    where = (0, drizzle_orm_1.and)(where, (0, drizzle_orm_1.inArray)(schema_1.blogPosts.id, postIds));
                }
            }
        }
        const posts = await database_1.db
            .select()
            .from(schema_1.blogPosts)
            .where(where)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.blogPosts.publishedAt))
            .limit(Number(limit))
            .offset(offset);
        return res.json({ posts, pagination: { page: Number(page), limit: Number(limit) } });
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to fetch posts" });
    }
};
exports.listPublishedPosts = listPublishedPosts;
const getPostBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const [post] = await database_1.db.select().from(schema_1.blogPosts).where((0, drizzle_orm_1.eq)(schema_1.blogPosts.slug, slug)).limit(1);
        if (!post || post.status !== "Published")
            return res.status(404).json({ error: "Not found" });
        return res.json(post);
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to fetch post" });
    }
};
exports.getPostBySlug = getPostBySlug;
const getRelatedPosts = async (req, res) => {
    try {
        const { id } = req.params;
        const postId = Number(id);
        const tagRows = await database_1.db.select().from(schema_1.blogPostTags).where((0, drizzle_orm_1.eq)(schema_1.blogPostTags.postId, postId));
        const tagIds = tagRows.map((r) => r.tagId);
        let related = [];
        if (tagIds.length) {
            const relatedTagRows = await database_1.db.select().from(schema_1.blogPostTags).where((0, drizzle_orm_1.inArray)(schema_1.blogPostTags.tagId, tagIds));
            const relatedPostIds = Array.from(new Set(relatedTagRows.map((r) => r.postId))).filter((pid) => pid !== postId);
            if (relatedPostIds.length) {
                related = await database_1.db
                    .select()
                    .from(schema_1.blogPosts)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.blogPosts.id, relatedPostIds), (0, drizzle_orm_1.eq)(schema_1.blogPosts.status, "Published")))
                    .limit(5);
            }
        }
        return res.json({ related });
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to fetch related posts" });
    }
};
exports.getRelatedPosts = getRelatedPosts;
const upsertCategory = async (req, res) => {
    try {
        const { id, name, slug } = req.body;
        if (id) {
            const [updated] = await database_1.db.update(schema_1.blogCategories).set({ name, slug, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.blogCategories.id, id)).returning();
            return res.json(updated);
        }
        else {
            const [created] = await database_1.db.insert(schema_1.blogCategories).values({ name, slug }).returning();
            return res.json(created);
        }
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to save category" });
    }
};
exports.upsertCategory = upsertCategory;
const upsertTag = async (req, res) => {
    try {
        const { id, name, slug } = req.body;
        if (id) {
            const [updated] = await database_1.db.update(schema_1.blogTags).set({ name, slug, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.blogTags.id, id)).returning();
            return res.json(updated);
        }
        else {
            const [created] = await database_1.db.insert(schema_1.blogTags).values({ name, slug }).returning();
            return res.json(created);
        }
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || "Failed to save tag" });
    }
};
exports.upsertTag = upsertTag;
