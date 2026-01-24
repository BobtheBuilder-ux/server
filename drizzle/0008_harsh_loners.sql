CREATE TABLE IF NOT EXISTS "LandlordTenantRental" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"landlordId" integer NOT NULL,
	"rentAmount" real NOT NULL,
	"rentDueDate" timestamp NOT NULL,
	"paymentMethod" varchar(100) NOT NULL,
	"propertyAddress" text NOT NULL,
	"isRentOverdue" boolean DEFAULT false NOT NULL,
	"applicationFeeAdded" boolean DEFAULT false NOT NULL,
	"securityDepositAdded" boolean DEFAULT false NOT NULL,
	"hasBeenEditedByLandlord" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "LandlordTenantRental_tenantId_landlordId_unique" UNIQUE("tenantId","landlordId")
);
