import { Request, Response } from "express";
import { and, eq, ilike, inArray, like, desc } from "drizzle-orm";
import { db } from "../utils/database";
import { users, bloggers, blogPosts, blogCategories, blogTags, blogPostTags } from "../db/schema";
import { createUserProfile } from "../middleware/betterAuthMiddleware";

const computeReadingTime = (html: string) => {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 200));
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await db.select().from(blogCategories).orderBy(blogCategories.name);
    return res.json(categories);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch categories" });
  }
};

export const getTags = async (req: Request, res: Response) => {
  try {
    const tags = await db.select().from(blogTags).orderBy(blogTags.name);
    return res.json(tags);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch tags" });
  }
};

export const adminCreateBlogger = async (req: Request, res: Response) => {
  try {
    const { userId, email, name, bio, avatarUrl } = req.body || {};

    let targetUserId = userId;

    if (!targetUserId && email) {
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        targetUserId = existing.id;
      } else {
        return res.status(400).json({ error: "User not found by email. Provide userId of an existing account." });
      }
    }

    if (!targetUserId) {
      return res.status(400).json({ error: "userId or email is required" });
    }

    await createUserProfile(targetUserId, "blogger", { bio, avatarUrl });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to create blogger" });
  }
};

export const getBloggerProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const [profile] = await db.select().from(bloggers).where(eq(bloggers.userId, req.user.id)).limit(1);
    
    // If profile doesn't exist but user is blogger, create one or return basic info?
    // The createUserProfile function handles creation.
    // If missing, we might want to create it on the fly?
    if (!profile) {
        // Try to create it if it doesn't exist
        await createUserProfile(req.user.id, "blogger", { displayName: req.user.name || req.user.email.split('@')[0] });
        const [newProfile] = await db.select().from(bloggers).where(eq(bloggers.userId, req.user.id)).limit(1);
        return res.json(newProfile);
    }
    
    return res.json(profile);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch profile" });
  }
};

export const getMyPosts = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { page = 1, limit = 10, search } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    const where = search
      ? and(eq(blogPosts.authorUserId, req.user.id), ilike(blogPosts.title, `%${search}%`))
      : eq(blogPosts.authorUserId, req.user.id);

    const posts = await db.select().from(blogPosts).where(where).orderBy(desc(blogPosts.createdAt)).limit(Number(limit)).offset(offset);
    return res.json({ posts, pagination: { page: Number(page), limit: Number(limit) } });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch posts" });
  }
};

export const createOrUpdatePost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const {
      id,
      title,
      slug,
      excerpt,
      contentHtml,
      featuredImageUrl,
      featuredImageAlt,
      status,
      scheduledFor,
      metaTitle,
      metaDescription,
      ogTitle,
      ogDescription,
      ogImageUrl,
      categoryId,
      tagIds,
      internalLinks,
    } = req.body;

    const readingTime = computeReadingTime(contentHtml || "");

    if (id) {
      const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
      if (!existing || existing.authorUserId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

      const [updated] = await db
        .update(blogPosts)
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
        .where(eq(blogPosts.id, id))
        .returning();

      if (Array.isArray(tagIds)) {
        // Remove existing tags and re-insert
        await db.delete(blogPostTags).where(eq(blogPostTags.postId, id));
        for (const tagId of tagIds) {
          await db.insert(blogPostTags).values({ postId: id, tagId });
        }
      }

      return res.json(updated);
    } else {
      const [created] = await db
        .insert(blogPosts)
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
          await db.insert(blogPostTags).values({ postId: created.id, tagId });
        }
      }

      return res.json(created);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save post" });
  }
};

export const publishPost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, Number(id))).limit(1);
    if (!existing || existing.authorUserId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const [updated] = await db
      .update(blogPosts)
      .set({ status: "Published", publishedAt: new Date(), scheduledFor: null })
      .where(eq(blogPosts.id, Number(id)))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to publish post" });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, Number(id))).limit(1);
    if (!existing || existing.authorUserId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    await db.delete(blogPostTags).where(eq(blogPostTags.postId, Number(id)));
    await db.delete(blogPosts).where(eq(blogPosts.id, Number(id)));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete post" });
  }
};

export const listPublishedPosts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 12, search, tag, category } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    let where: any = eq(blogPosts.status, "Published");
    if (search) {
      where = and(where, ilike(blogPosts.title, `%${search}%`));
    }
    if (category) {
      const [cat] = await db.select().from(blogCategories).where(eq(blogCategories.slug, String(category))).limit(1);
      if (cat) where = and(where, eq(blogPosts.categoryId, cat.id));
    }
    if (tag) {
      const [t] = await db.select().from(blogTags).where(eq(blogTags.slug, String(tag))).limit(1);
      if (t) {
        const postTagRows = await db.select().from(blogPostTags).where(eq(blogPostTags.tagId, t.id));
        const postIds = postTagRows.map((r) => r.postId);
        if (postIds.length) {
          where = and(where, inArray(blogPosts.id, postIds));
        }
      }
    }

    const posts = await db
      .select()
      .from(blogPosts)
      .where(where)
      .orderBy(desc(blogPosts.publishedAt))
      .limit(Number(limit))
      .offset(offset);

    return res.json({ posts, pagination: { page: Number(page), limit: Number(limit) } });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch posts" });
  }
};

export const getPostBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    if (!post || post.status !== "Published") return res.status(404).json({ error: "Not found" });
    return res.json(post);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch post" });
  }
};

export const getRelatedPosts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const postId = Number(id);
    const tagRows = await db.select().from(blogPostTags).where(eq(blogPostTags.postId, postId));
    const tagIds = tagRows.map((r) => r.tagId);

    let related: any[] = [];
    if (tagIds.length) {
      const relatedTagRows = await db.select().from(blogPostTags).where(inArray(blogPostTags.tagId, tagIds));
      const relatedPostIds = Array.from(new Set(relatedTagRows.map((r) => r.postId))).filter((pid) => pid !== postId);
      if (relatedPostIds.length) {
        related = await db
          .select()
          .from(blogPosts)
          .where(and(inArray(blogPosts.id, relatedPostIds), eq(blogPosts.status, "Published")))
          .limit(5);
      }
    }
    return res.json({ related });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to fetch related posts" });
  }
};

export const upsertCategory = async (req: Request, res: Response) => {
  try {
    const { id, name, slug } = req.body;
    if (id) {
      const [updated] = await db.update(blogCategories).set({ name, slug, updatedAt: new Date() }).where(eq(blogCategories.id, id)).returning();
      return res.json(updated);
    } else {
      const [existing] = await db.select().from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
      if (existing) {
          return res.json(existing);
      }
      const [created] = await db.insert(blogCategories).values({ name, slug }).returning();
      return res.json(created);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save category" });
  }
};

export const upsertTag = async (req: Request, res: Response) => {
  try {
    const { id, name, slug } = req.body;
    if (id) {
      const [updated] = await db.update(blogTags).set({ name, slug, updatedAt: new Date() }).where(eq(blogTags.id, id)).returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(blogTags).values({ name, slug }).returning();
      return res.json(created);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save tag" });
  }
};
