CREATE TABLE IF NOT EXISTS "TenantEditAuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"landlordId" integer NOT NULL,
	"fieldName" varchar(100) NOT NULL,
	"oldValue" text,
	"newValue" text,
	"editedAt" timestamp DEFAULT now() NOT NULL,
	"editedBy" text NOT NULL,
	"isOneTimeEdit" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Landlord" ADD COLUMN IF NOT EXISTS "tenantRegistrationLink" varchar(255);--> statement-breakpoint
ALTER TABLE "Landlord" ADD COLUMN IF NOT EXISTS "linkGeneratedAt" timestamp;--> statement-breakpoint
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "houseAddress" text;--> statement-breakpoint
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "registrationSource" varchar(50) DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "registeredByLandlordId" integer;--> statement-breakpoint
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN IF EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name='TenantSurvey' AND column_name='directLandlordPreference'
) THEN ALTER TABLE "TenantSurvey" DROP COLUMN "directLandlordPreference"; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'Landlord_tenantRegistrationLink_unique'
) THEN ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_tenantRegistrationLink_unique" UNIQUE("tenantRegistrationLink"); END IF; END $$;
