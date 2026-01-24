-- Create enum types with IF NOT EXISTS for idempotency
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageCategory') THEN
    CREATE TYPE "public"."MessageCategory" AS ENUM('RentReminder', 'PaymentConfirmation', 'LandlordAlert', 'RenewalRequest', 'General');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageStatus') THEN
    CREATE TYPE "public"."MessageStatus" AS ENUM('Pending', 'Sent', 'Delivered', 'Failed', 'Read');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageType') THEN
    CREATE TYPE "public"."MessageType" AS ENUM('SMS', 'WhatsApp');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResponseStatus') THEN
    CREATE TYPE "public"."ResponseStatus" AS ENUM('Pending', 'Received', 'Processed', 'Expired');
  END IF;
END $$;--> statement-breakpoint
-- Create tables with IF NOT EXISTS to allow safe re-runs
CREATE TABLE IF NOT EXISTS "MessageAuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" integer,
	"responseId" integer,
	"action" varchar(100) NOT NULL,
	"details" json,
	"performedBy" text,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "MessageResponse" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" integer NOT NULL,
	"responseText" varchar(10) NOT NULL,
	"responsePhone" varchar(20) NOT NULL,
	"status" "ResponseStatus" DEFAULT 'Received' NOT NULL,
	"processedAt" timestamp,
	"processingResult" json,
	"errorMessage" text,
	"isValid" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RenewalRequest" (
	"id" serial PRIMARY KEY NOT NULL,
	"leaseId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"landlordId" integer NOT NULL,
	"propertyId" integer NOT NULL,
	"messageId" integer,
	"responseId" integer,
	"tenantResponse" varchar(10),
	"responseReceivedAt" timestamp,
	"status" varchar(50) DEFAULT 'Pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"processedAt" timestamp,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SMSMessage" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" varchar(255),
	"recipientPhone" varchar(20) NOT NULL,
	"recipientId" text NOT NULL,
	"recipientType" varchar(50) NOT NULL,
	"messageType" "MessageType" NOT NULL,
	"category" "MessageCategory" NOT NULL,
	"content" text NOT NULL,
	"status" "MessageStatus" DEFAULT 'Pending' NOT NULL,
	"termiiResponse" json,
	"deliveredAt" timestamp,
	"readAt" timestamp,
	"failureReason" text,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"maxRetries" integer DEFAULT 3 NOT NULL,
	"relatedId" integer,
	"relatedType" varchar(100),
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "SMSMessage_messageId_unique" UNIQUE("messageId")
);
