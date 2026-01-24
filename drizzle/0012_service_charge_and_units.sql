-- Add columns to Property table with IF NOT EXISTS for idempotency
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "serviceCharge" real DEFAULT 0 NOT NULL;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "availableUnits" integer DEFAULT 1 NOT NULL;