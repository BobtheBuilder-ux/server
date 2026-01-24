ALTER TABLE "LandlordTenantRental" ADD COLUMN IF NOT EXISTS "leaseStartDate" timestamp;--> statement-breakpoint
ALTER TABLE "LandlordTenantRental" ADD COLUMN IF NOT EXISTS "leaseEndDate" timestamp;