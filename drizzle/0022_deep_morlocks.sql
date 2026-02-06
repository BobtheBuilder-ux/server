CREATE TABLE "RealEstateCompany" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"companyName" varchar(255) NOT NULL,
	"licenseNumber" varchar(100) NOT NULL,
	"logoUrl" text,
	"address" text,
	"phoneNumber" varchar(20),
	"email" varchar(255) NOT NULL,
	"website" varchar(255),
	"description" text,
	"isVerified" boolean DEFAULT false NOT NULL,
	"verificationStatus" varchar(50) DEFAULT 'Pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "RealEstateCompany_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN "realEstateCompanyId" integer;