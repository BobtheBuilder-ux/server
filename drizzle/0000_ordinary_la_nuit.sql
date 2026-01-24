DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityType') THEN CREATE TYPE "public"."ActivityType" AS ENUM('PropertyCreated', 'PropertyUpdated', 'PropertyDeleted', 'ApplicationSubmitted', 'ApplicationApproved', 'ApplicationDenied', 'LeaseCreated', 'LeaseExpired', 'PaymentMade', 'PaymentOverdue', 'InspectionScheduled', 'InspectionCompleted', 'TenantRegistered', 'LandlordRegistered', 'AgentAssigned', 'MaintenanceRequested', 'MaintenanceCompleted', 'WithdrawalRequested', 'WithdrawalProcessed'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApplicationStatus') THEN CREATE TYPE "public"."ApplicationStatus" AS ENUM('Pending', 'Denied', 'Approved'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChildrenPreference') THEN CREATE TYPE "public"."ChildrenPreference" AS ENUM('Yes', 'No', 'Any'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExperienceLevel') THEN CREATE TYPE "public"."ExperienceLevel" AS ENUM('Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Executive'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GenderPreference') THEN CREATE TYPE "public"."GenderPreference" AS ENUM('Male', 'Female', 'Any'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InspectionStatus') THEN CREATE TYPE "public"."InspectionStatus" AS ENUM('Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobApplicationStatus') THEN CREATE TYPE "public"."JobApplicationStatus" AS ENUM('Submitted', 'UnderReview', 'Shortlisted', 'Interviewed', 'Rejected', 'Hired'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobType') THEN CREATE TYPE "public"."JobType" AS ENUM('FullTime', 'PartTime', 'Contract', 'Internship', 'Remote'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaritalPreference') THEN CREATE TYPE "public"."MaritalPreference" AS ENUM('Single', 'Married', 'Any'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPriority') THEN CREATE TYPE "public"."NotificationPriority" AS ENUM('Low', 'Medium', 'High', 'Urgent'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN CREATE TYPE "public"."NotificationType" AS ENUM('PropertyUpdate', 'ApplicationStatus', 'PaymentReminder', 'InspectionScheduled', 'LeaseExpiring', 'MaintenanceRequest', 'SystemAlert', 'Welcome', 'General'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN CREATE TYPE "public"."PaymentStatus" AS ENUM('Pending', 'Paid', 'PartiallyPaid', 'Overdue'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PropertyStatus') THEN CREATE TYPE "public"."PropertyStatus" AS ENUM('Available', 'Closed', 'UnderMaintenance', 'PendingApproval'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PropertyType') THEN CREATE TYPE "public"."PropertyType" AS ENUM('SelfContain', 'Apartment', 'Bungalow', 'Duplex'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskPriority') THEN CREATE TYPE "public"."TaskPriority" AS ENUM('Low', 'Medium', 'High', 'Urgent'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN CREATE TYPE "public"."TaskStatus" AS ENUM('Pending', 'InProgress', 'Completed', 'Cancelled'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WithdrawalStatus') THEN CREATE TYPE "public"."WithdrawalStatus" AS ENUM('Pending', 'Processing', 'Completed', 'Failed', 'Cancelled'); END IF; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Account_providerId_accountId_unique" UNIQUE("providerId","accountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ActivityFeed" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "ActivityType" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"actorId" text NOT NULL,
	"actorType" varchar(50) NOT NULL,
	"actorName" varchar(255) NOT NULL,
	"targetId" integer,
	"targetType" varchar(100),
	"metadata" json,
	"isPublic" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AdminSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"siteName" varchar(255) DEFAULT 'HomeMatch' NOT NULL,
	"siteDescription" text DEFAULT 'Find your perfect rental property' NOT NULL,
	"allowRegistration" boolean DEFAULT true NOT NULL,
	"maxPropertiesPerLandlord" integer DEFAULT 50 NOT NULL,
	"commissionRate" real DEFAULT 5 NOT NULL,
	"emailNotifications" boolean DEFAULT true NOT NULL,
	"smsNotifications" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Admin" (
	"id" serial PRIMARY KEY NOT NULL,
	"cognitoId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20),
	"userId" text,
	CONSTRAINT "Admin_cognitoId_unique" UNIQUE("cognitoId"),
	CONSTRAINT "Admin_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AgentProperty" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" integer NOT NULL,
	"propertyId" integer NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "AgentProperty_agentId_propertyId_unique" UNIQUE("agentId","propertyId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AgentRegistrationCode" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"isUsed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"usedAt" timestamp,
	"assignedBy" text,
	CONSTRAINT "AgentRegistrationCode_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Agent" (
	"id" serial PRIMARY KEY NOT NULL,
	"cognitoId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20),
	"address" text,
	"registrationCodeId" integer,
	"userId" text,
	CONSTRAINT "Agent_cognitoId_unique" UNIQUE("cognitoId"),
	CONSTRAINT "Agent_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Application" (
	"id" serial PRIMARY KEY NOT NULL,
	"applicationDate" timestamp NOT NULL,
	"status" "ApplicationStatus" NOT NULL,
	"propertyId" integer NOT NULL,
	"tenantCognitoId" varchar(255) NOT NULL,
	"paymentDeadline" timestamp,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20) NOT NULL,
	"preferredMoveInDate" timestamp,
	"desiredLeaseDuration" varchar(100),
	"gender" varchar(20),
	"dateOfBirth" timestamp,
	"nationality" varchar(100),
	"maritalStatus" varchar(50),
	"idType" varchar(50),
	"idDocumentUrl" text,
	"durationAtCurrentAddress" varchar(100),
	"employmentStatus" varchar(100),
	"occupation" varchar(100),
	"employerName" varchar(255),
	"workAddress" text,
	"monthlyIncome" real,
	"durationAtCurrentJob" varchar(100),
	"incomeProofUrl" text,
	"previousEmployerName" varchar(255),
	"previousJobTitle" varchar(255),
	"previousEmploymentDuration" varchar(100),
	"reasonForLeavingPrevJob" text,
	"numberOfOccupants" integer,
	"relationshipToOccupants" text,
	"hasPets" boolean,
	"isSmoker" boolean,
	"accessibilityNeeds" text,
	"reasonForLeaving" text,
	"consentToInformation" boolean,
	"consentToVerification" boolean,
	"consentToTenancyTerms" boolean,
	"consentToPrivacyPolicy" boolean,
	"leaseId" integer,
	CONSTRAINT "Application_leaseId_unique" UNIQUE("leaseId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "EmailSubscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"subscriptionType" varchar(100) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"subscribedAt" timestamp DEFAULT now() NOT NULL,
	"unsubscribedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EmailSubscription_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "InspectionLimit" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantCognitoId" varchar(255) NOT NULL,
	"freeInspections" integer DEFAULT 2 NOT NULL,
	"usedInspections" integer DEFAULT 0 NOT NULL,
	"hasUnlimited" boolean DEFAULT false NOT NULL,
	"unlimitedUntil" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "InspectionLimit_tenantCognitoId_unique" UNIQUE("tenantCognitoId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Inspection" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"tenantCognitoId" varchar(255) NOT NULL,
	"scheduledDate" timestamp NOT NULL,
	"status" "InspectionStatus" DEFAULT 'Pending' NOT NULL,
	"tenantName" varchar(255) NOT NULL,
	"tenantEmail" varchar(255) NOT NULL,
	"tenantPhone" varchar(20) NOT NULL,
	"preferredTime" varchar(100) NOT NULL,
	"message" text,
	"adminNotes" text,
	"agentId" integer,
	"depositPaid" boolean DEFAULT false NOT NULL,
	"depositAmount" real,
	"paymentReference" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JobApplicationRating" (
	"id" serial PRIMARY KEY NOT NULL,
	"jobApplicationId" integer NOT NULL,
	"criteriaName" varchar(255) NOT NULL,
	"score" integer NOT NULL,
	"maxScore" integer DEFAULT 10 NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"comments" text,
	"ratedBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "JobApplicationRating_jobApplicationId_criteriaName_unique" UNIQUE("jobApplicationId","criteriaName")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JobApplication" (
	"id" serial PRIMARY KEY NOT NULL,
	"jobId" integer NOT NULL,
	"applicantName" varchar(255) NOT NULL,
	"applicantEmail" varchar(255) NOT NULL,
	"applicantPhone" varchar(20),
	"resumeUrl" text NOT NULL,
	"coverLetter" text,
	"experience" text,
	"education" text,
	"skills" text,
	"portfolioUrl" text,
	"linkedinUrl" text,
	"status" "JobApplicationStatus" DEFAULT 'Submitted' NOT NULL,
	"submittedAt" timestamp DEFAULT now() NOT NULL,
	"reviewedAt" timestamp,
	"reviewedBy" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Job" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"requirements" text NOT NULL,
	"responsibilities" text NOT NULL,
	"jobType" "JobType" NOT NULL,
	"experienceLevel" "ExperienceLevel" NOT NULL,
	"salaryMin" real,
	"salaryMax" real,
	"location" varchar(255) NOT NULL,
	"department" varchar(100),
	"isActive" boolean DEFAULT true NOT NULL,
	"postedDate" timestamp DEFAULT now() NOT NULL,
	"closingDate" timestamp,
	"createdBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "LandlordRegistrationCode" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"isUsed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"usedAt" timestamp,
	CONSTRAINT "LandlordRegistrationCode_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "LandlordSurvey" (
	"id" serial PRIMARY KEY NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"propertyLocation" varchar(255) NOT NULL,
	"numberOfProperties" varchar(100) NOT NULL,
	"propertyTypes" json NOT NULL,
	"tenantManagement" json NOT NULL,
	"biggestChallenges" json NOT NULL,
	"agentIssues" varchar(100) NOT NULL,
	"platformInterest" varchar(100) NOT NULL,
	"propertyListingRating" varchar(50) NOT NULL,
	"dashboardRating" varchar(50) NOT NULL,
	"maintenanceRating" varchar(50) NOT NULL,
	"rentCollectionRating" varchar(50) NOT NULL,
	"customerSupportRating" varchar(50) NOT NULL,
	"monthlyReportRating" varchar(50) NOT NULL,
	"wishEasier" text NOT NULL,
	"launchNotification" varchar(100) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Landlord" (
	"id" serial PRIMARY KEY NOT NULL,
	"cognitoId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20) NOT NULL,
	"registrationCodeId" integer,
	"userId" text,
	"currentAddress" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postalCode" varchar(20),
	"bankName" varchar(255),
	"accountNumber" varchar(50),
	"accountName" varchar(255),
	"bankCode" varchar(20),
	"businessName" varchar(255),
	"businessType" varchar(100),
	"taxId" varchar(50),
	"dateOfBirth" timestamp,
	"nationality" varchar(100),
	"occupation" varchar(100),
	"emergencyContactName" varchar(255),
	"emergencyContactPhone" varchar(20),
	"isOnboardingComplete" boolean DEFAULT false NOT NULL,
	"onboardedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Landlord_cognitoId_unique" UNIQUE("cognitoId"),
	CONSTRAINT "Landlord_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Lease" (
	"id" serial PRIMARY KEY NOT NULL,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp NOT NULL,
	"rent" real NOT NULL,
	"deposit" real NOT NULL,
	"propertyId" integer NOT NULL,
	"tenantCognitoId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Location" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) NOT NULL,
	"postalCode" varchar(20) NOT NULL,
	"coordinates" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" "NotificationType" NOT NULL,
	"priority" "NotificationPriority" DEFAULT 'Medium' NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"recipientId" text NOT NULL,
	"recipientType" varchar(50) NOT NULL,
	"relatedId" integer,
	"relatedType" varchar(100),
	"actionUrl" text,
	"actionText" varchar(255),
	"metadata" json,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"amountDue" real NOT NULL,
	"amountPaid" real NOT NULL,
	"dueDate" timestamp NOT NULL,
	"paymentDate" timestamp NOT NULL,
	"paymentStatus" "PaymentStatus" NOT NULL,
	"leaseId" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Property" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"pricePerYear" real NOT NULL,
	"securityDeposit" real NOT NULL,
	"applicationFee" real NOT NULL,
	"photoUrls" json NOT NULL,
	"videoUrl" text,
	"amenities" text,
	"isParkingIncluded" boolean DEFAULT false NOT NULL,
	"maritalPreference" "MaritalPreference" DEFAULT 'Any' NOT NULL,
	"genderPreference" "GenderPreference" DEFAULT 'Any' NOT NULL,
	"childrenPreference" "ChildrenPreference" DEFAULT 'Any' NOT NULL,
	"beds" integer NOT NULL,
	"baths" real NOT NULL,
	"squareFeet" integer NOT NULL,
	"propertyType" "PropertyType" NOT NULL,
	"status" "PropertyStatus" DEFAULT 'Available' NOT NULL,
	"postedDate" timestamp DEFAULT now() NOT NULL,
	"locationId" integer NOT NULL,
	"landlordCognitoId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "Session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spatial_ref_sys" (
	"srid" integer PRIMARY KEY NOT NULL,
	"auth_name" varchar(256),
	"auth_srid" integer,
	"srtext" varchar(2048),
	"proj4text" varchar(2048)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Task" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "TaskStatus" DEFAULT 'Pending' NOT NULL,
	"priority" "TaskPriority" DEFAULT 'Medium' NOT NULL,
	"dueDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"assignedBy" text NOT NULL,
	"agentId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantFavorites" (
	"tenantId" integer NOT NULL,
	"propertyId" integer NOT NULL,
	CONSTRAINT "TenantFavorites_tenantId_propertyId_unique" UNIQUE("tenantId","propertyId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantProperties" (
	"tenantId" integer NOT NULL,
	"propertyId" integer NOT NULL,
	CONSTRAINT "TenantProperties_tenantId_propertyId_unique" UNIQUE("tenantId","propertyId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantSurvey" (
	"id" serial PRIMARY KEY NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"currentLocation" varchar(255) NOT NULL,
	"rentingStatus" varchar(100) NOT NULL,
	"housingType" json NOT NULL,
	"frustrations" json NOT NULL,
	"scamExperience" varchar(100) NOT NULL,
	"scamDetails" text,
	"propertyListingRating" varchar(50) NOT NULL,
	"dashboardRating" varchar(50) NOT NULL,
	"maintenanceRating" varchar(50) NOT NULL,
	"rentCollectionRating" varchar(50) NOT NULL,
	"customerSupportRating" varchar(50) NOT NULL,
	"monthlyReportRating" varchar(50) NOT NULL,
	"wishEasier" text NOT NULL,
	"launchNotification" varchar(100) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Tenant" (
	"id" serial PRIMARY KEY NOT NULL,
	"cognitoId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20) NOT NULL,
	"userId" text,
	CONSTRAINT "Tenant_cognitoId_unique" UNIQUE("cognitoId"),
	CONSTRAINT "Tenant_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"name" varchar(255),
	"image" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"verificationInitiatedAt" timestamp,
	"role" varchar(50) DEFAULT 'tenant' NOT NULL,
	"phoneNumber" varchar(20),
	"isOnboardingComplete" boolean DEFAULT false NOT NULL,
	"legacyCognitoId" varchar(255),
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_legacyCognitoId_unique" UNIQUE("legacyCognitoId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" text,
	CONSTRAINT "Verification_identifier_value_unique" UNIQUE("identifier","value")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Withdrawal" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"status" "WithdrawalStatus" DEFAULT 'Pending' NOT NULL,
	"requestDate" timestamp DEFAULT now() NOT NULL,
	"processedDate" timestamp,
	"landlordCognitoId" varchar(255) NOT NULL,
	"bankName" varchar(255),
	"accountNumber" varchar(50),
	"accountName" varchar(255),
	"reference" varchar(255),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Withdrawal_reference_unique" UNIQUE("reference")
);
