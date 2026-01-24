-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Add a temporary UUID column to jobs table (if it doesn't exist)
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "temp_uuid_id" uuid DEFAULT gen_random_uuid();

-- Step 2: Update all existing jobs with new UUIDs (only if NULL)
UPDATE "Job" SET "temp_uuid_id" = gen_random_uuid() WHERE "temp_uuid_id" IS NULL;

-- Step 3: Add a temporary text column to job applications (if it doesn't exist)
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "temp_job_uuid" text;

-- Step 4: Update job applications to reference the new UUIDs safely (only if NULL)
DO $$ BEGIN
  UPDATE "JobApplication" 
  SET "temp_job_uuid" = (
      SELECT "temp_uuid_id"::text 
      FROM "Job" 
      WHERE "Job"."id"::text = "JobApplication"."jobId"::text
  )
  WHERE "temp_job_uuid" IS NULL;
EXCEPTION WHEN others THEN null;
END $$;

-- Step 5: Drop the old foreign key constraints and columns (safely)
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

-- Step 6: Rename the temporary columns to their final names (safely)
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

-- Step 7: Add primary key constraint back to jobs table (safely)
DO $$ BEGIN
  ALTER TABLE "Job" ADD PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Step 8: Set default for new job IDs
ALTER TABLE "Job" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Step 9: Add NOT NULL constraint to jobId in JobApplication
ALTER TABLE "JobApplication" ALTER COLUMN "jobId" SET NOT NULL;