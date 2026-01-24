-- Add column with IF NOT EXISTS for idempotency
ALTER TABLE "SaleListing" ADD COLUMN IF NOT EXISTS "submittedByRole" varchar(20);