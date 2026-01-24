-- Create LandlordAcquisitionStatus ENUM type with IF NOT EXISTS
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LandlordAcquisitionStatus') THEN CREATE TYPE "public"."LandlordAcquisitionStatus" AS ENUM('Pending', 'Accepted', 'Onboarded', 'FullyIn'); END IF; END $$;--> statement-breakpoint

-- Create LandlordAcquisition table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "LandlordAcquisition" (
	"id" serial PRIMARY KEY NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"phoneNumber" varchar(20) NOT NULL,
	"address" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"propertyTypes" json NOT NULL,
	"status" "LandlordAcquisitionStatus" DEFAULT 'Pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
