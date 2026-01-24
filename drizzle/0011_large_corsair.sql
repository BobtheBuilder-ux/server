-- Create ENUM types with IF NOT EXISTS for idempotency
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SaleListingStatus') THEN CREATE TYPE "public"."SaleListingStatus" AS ENUM('Pending', 'Approved', 'Rejected'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SaleListingType') THEN CREATE TYPE "public"."SaleListingType" AS ENUM('Land', 'Property'); END IF; END $$;--> statement-breakpoint

-- Add values to existing ActivityType ENUM safely
DO $$ BEGIN
  ALTER TYPE "public"."ActivityType" ADD VALUE 'SaleListingSubmitted';
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."ActivityType" ADD VALUE 'SaleListingApproved';
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."ActivityType" ADD VALUE 'SaleListingRejected';
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create SaleListingAuditLog table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "SaleListingAuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"listingId" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"actorUserId" text NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create SaleListing table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "SaleListing" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "SaleListingType" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"locationAddress" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) DEFAULT 'Nigeria' NOT NULL,
	"coordinates" text,
	"size" real,
	"sizeUnit" varchar(50) DEFAULT 'sqm',
	"price" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"features" json,
	"imageUrls" json,
	"videoUrls" json,
	"proofOfOwnershipUrl" text,
	"status" "SaleListingStatus" DEFAULT 'Pending' NOT NULL,
	"createdByUserId" text NOT NULL,
	"approvedByAdminId" integer,
	"approvedAt" timestamp,
	"rejectionReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create SaleUser table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "SaleUser" (
	"id" serial PRIMARY KEY NOT NULL,
	"cognitoId" varchar(255) NOT NULL,
	"userId" text,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20),
	"displayRoleName" varchar(100) DEFAULT 'Land/Property Sale' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "SaleUser_cognitoId_unique" UNIQUE("cognitoId"),
	CONSTRAINT "SaleUser_userId_unique" UNIQUE("userId")
);
