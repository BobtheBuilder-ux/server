-- Fix jobId column type in JobApplication table
ALTER TABLE "JobApplication" ALTER COLUMN "jobId" SET DATA TYPE uuid USING "jobId"::uuid;