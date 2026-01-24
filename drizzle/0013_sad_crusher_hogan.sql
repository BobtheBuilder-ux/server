CREATE TABLE IF NOT EXISTS "SaleListingDocument" (
	"id" serial PRIMARY KEY NOT NULL,
	"listingId" integer NOT NULL,
	"docType" varchar(50) NOT NULL,
	"fileUrl" text NOT NULL,
	"otherText" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SaleSeller" (
	"id" serial PRIMARY KEY NOT NULL,
	"listingId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"isCompany" boolean DEFAULT false NOT NULL,
	"cacNumber" varchar(50),
	"address" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"idType" varchar(50) NOT NULL,
	"idNumber" varchar(100) NOT NULL,
	"idFileUrl" text,
	"bankName" varchar(255) NOT NULL,
	"accountNumber" varchar(20) NOT NULL,
	"accountName" varchar(255) NOT NULL,
	"signatureUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SaleVerification" (
	"id" serial PRIMARY KEY NOT NULL,
	"listingId" integer NOT NULL,
	"verifiedByUserId" text NOT NULL,
	"verificationDate" timestamp DEFAULT now() NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "propertyType" varchar(50);--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "lga" varchar(100);--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "street" varchar(255);--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "plotSizeSqm" integer;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "numberOfPlots" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "roadAccess" boolean;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "roadAccessNotes" text;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "electricityAvailable" boolean;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "landConditions" json;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "surveyPlanNumber" varchar(100);--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "priceNegotiable" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "agreedSellingPrice" integer;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "depositRequired" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "depositAmount" integer;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "paymentOptions" json;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "installmentTerms" text;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "additionalFees" json;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "paymentInstructions" text;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "inspectionAllowed" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "inspectionDays" json;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "inspectionTimeWindow" varchar(100);--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "inspectionContactPerson" varchar(255);--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "inspectionNotes" text;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "declarationSignedAt" timestamp;--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "declarationSignatureUrl" text;