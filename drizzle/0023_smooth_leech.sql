ALTER TABLE "RealEstateCompany" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "SaleListing" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "RealEstateCompany" ADD CONSTRAINT "RealEstateCompany_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "SaleListing" ADD CONSTRAINT "SaleListing_uuid_unique" UNIQUE("uuid");