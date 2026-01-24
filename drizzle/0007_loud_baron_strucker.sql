-- Idempotent column addition: safely adds currentPropertyId if missing
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currentPropertyId" integer;

-- Idempotent type change: only convert jobId to uuid if not already uuid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'JobApplication'
      AND column_name = 'jobId'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE "JobApplication" ALTER COLUMN "jobId" SET DATA TYPE uuid USING "jobId"::uuid;
  END IF;
END $$;
