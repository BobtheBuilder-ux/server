ALTER TABLE "Property" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "Property" ADD CONSTRAINT "Property_uuid_unique" UNIQUE("uuid");