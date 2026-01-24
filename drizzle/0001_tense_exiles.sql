-- Add column with IF NOT EXISTS for idempotency
ALTER TABLE "TenantSurvey" ADD COLUMN IF NOT EXISTS "directLandlordPreference" varchar(100) NOT NULL;