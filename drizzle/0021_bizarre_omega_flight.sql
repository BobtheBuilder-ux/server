DO $$ BEGIN
    CREATE TYPE "public"."BlogPostStatus" AS ENUM('Draft', 'Published', 'Scheduled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminUserId" text NOT NULL,
	"action" varchar(50) NOT NULL,
	"targetUserId" text,
	"details" json,
	"ipAddress" varchar(45),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BlogCategory" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "BlogCategory_name_unique" UNIQUE("name"),
	CONSTRAINT "BlogCategory_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BlogPostTag" (
	"postId" integer NOT NULL,
	"tagId" integer NOT NULL,
	CONSTRAINT "BlogPostTag_postId_tagId_unique" UNIQUE("postId","tagId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BlogPost" (
	"id" serial PRIMARY KEY NOT NULL,
	"authorUserId" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"excerpt" varchar(300),
	"contentHtml" text NOT NULL,
	"featuredImageUrl" text,
	"featuredImageAlt" varchar(160),
	"status" "BlogPostStatus" DEFAULT 'Draft' NOT NULL,
	"publishedAt" timestamp,
	"scheduledFor" timestamp,
	"metaTitle" varchar(70),
	"metaDescription" varchar(160),
	"ogTitle" varchar(100),
	"ogDescription" varchar(200),
	"ogImageUrl" text,
	"categoryId" integer,
	"readingTimeMinutes" integer DEFAULT 1 NOT NULL,
	"internalLinks" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "BlogPost_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BlogTag" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "BlogTag_name_unique" UNIQUE("name"),
	CONSTRAINT "BlogTag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Blogger" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text,
	"displayName" varchar(255) NOT NULL,
	"bio" text,
	"avatarUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Blogger_userId_unique" UNIQUE("userId")
);
