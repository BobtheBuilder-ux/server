ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationToken" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationTokenExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationResendCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationLastResendAt" timestamp;
