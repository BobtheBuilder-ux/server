-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add temporary UUID column with IF NOT EXISTS
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "temp_uuid_id" uuid DEFAULT gen_random_uuid();

-- Update jobs with UUIDs (only if NULL)
UPDATE "Job" SET "temp_uuid_id" = gen_random_uuid() WHERE "temp_uuid_id" IS NULL;

-- Add temporary text column with IF NOT EXISTS
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "temp_job_uuid" text;

-- Update job applications with safe exception handling
DO $$ BEGIN
  UPDATE "JobApplication" SET "temp_job_uuid" = (
    SELECT "temp_uuid_id"::text FROM "Job" 
    WHERE "Job"."id"::text = "JobApplication"."jobId"::text
  )
  WHERE "temp_job_uuid" IS NULL;
EXCEPTION WHEN others THEN null;
END $$;

-- Drop columns safely
DO $$ BEGIN
  BEGIN
    ALTER TABLE "JobApplication" DROP COLUMN "jobId";
  EXCEPTION WHEN undefined_column THEN null;
  END;
  BEGIN
    ALTER TABLE "Job" DROP COLUMN "id";
  EXCEPTION WHEN undefined_column THEN null;
  END;
END $$;

-- Rename columns safely
DO $$ BEGIN
  BEGIN
    ALTER TABLE "Job" RENAME COLUMN "temp_uuid_id" TO "id";
  EXCEPTION WHEN duplicate_column THEN null;
  END;
  BEGIN
    ALTER TABLE "JobApplication" RENAME COLUMN "temp_job_uuid" TO "jobId";
  EXCEPTION WHEN duplicate_column THEN null;
  END;
END $$;

-- Add primary key constraint safely
DO $$ BEGIN
  ALTER TABLE "Job" ADD PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Set default for new job IDs
ALTER TABLE "Job" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Add NOT NULL constraint to jobId
ALTER TABLE "JobApplication" ALTER COLUMN "jobId" SET NOT NULL;
