import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  json,
  pgEnum,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums
export const propertyTypeEnum = pgEnum('PropertyType', ['SelfContain', 'Apartment', 'Bungalow', 'Duplex']);
export const applicationStatusEnum = pgEnum('ApplicationStatus', ['Pending', 'Denied', 'Approved']);
export const paymentStatusEnum = pgEnum('PaymentStatus', ['Pending', 'Paid', 'PartiallyPaid', 'Overdue']);
export const propertyStatusEnum = pgEnum('PropertyStatus', ['Available', 'Closed', 'UnderMaintenance', 'PendingApproval']);
export const withdrawalStatusEnum = pgEnum('WithdrawalStatus', ['Pending', 'Processing', 'Completed', 'Failed', 'Cancelled']);
export const maritalPreferenceEnum = pgEnum('MaritalPreference', ['Single', 'Married', 'Any']);
export const genderPreferenceEnum = pgEnum('GenderPreference', ['Male', 'Female', 'Any']);
export const childrenPreferenceEnum = pgEnum('ChildrenPreference', ['Yes', 'No', 'Any']);
export const taskStatusEnum = pgEnum('TaskStatus', ['Pending', 'InProgress', 'Completed', 'Cancelled']);
export const taskPriorityEnum = pgEnum('TaskPriority', ['Low', 'Medium', 'High', 'Urgent']);
export const inspectionStatusEnum = pgEnum('InspectionStatus', ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled']);
export const jobTypeEnum = pgEnum('JobType', ['FullTime', 'PartTime', 'Contract', 'Internship', 'Remote']);
export const jobApplicationStatusEnum = pgEnum('JobApplicationStatus', ['Submitted', 'UnderReview', 'Shortlisted', 'Interviewed', 'Rejected', 'Hired']);
export const experienceLevelEnum = pgEnum('ExperienceLevel', ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Executive']);
export const notificationTypeEnum = pgEnum('NotificationType', ['PropertyUpdate', 'ApplicationStatus', 'PaymentReminder', 'InspectionScheduled', 'LeaseExpiring', 'MaintenanceRequest', 'SystemAlert', 'Welcome', 'General']);
export const notificationPriorityEnum = pgEnum('NotificationPriority', ['Low', 'Medium', 'High', 'Urgent']);
export const activityTypeEnum = pgEnum('ActivityType', ['PropertyCreated', 'PropertyUpdated', 'PropertyDeleted', 'ApplicationSubmitted', 'ApplicationApproved', 'ApplicationDenied', 'LeaseCreated', 'LeaseExpired', 'PaymentMade', 'PaymentOverdue', 'InspectionScheduled', 'InspectionCompleted', 'TenantRegistered', 'LandlordRegistered', 'AgentAssigned', 'MaintenanceRequested', 'MaintenanceCompleted', 'WithdrawalRequested', 'WithdrawalProcessed', 'SaleListingSubmitted', 'SaleListingApproved', 'SaleListingRejected']);

// Sale Listings enums
export const saleListingTypeEnum = pgEnum('SaleListingType', ['Land', 'Property']);
export const saleListingStatusEnum = pgEnum('SaleListingStatus', ['Pending', 'Approved', 'Rejected']);
export const landlordAcquisitionStatusEnum = pgEnum('LandlordAcquisitionStatus', ['Pending', 'Accepted', 'Onboarded', 'FullyIn']);

// SMS/WhatsApp messaging enums
export const messageTypeEnum = pgEnum('MessageType', ['SMS', 'WhatsApp']);
export const messageStatusEnum = pgEnum('MessageStatus', ['Pending', 'Sent', 'Delivered', 'Failed', 'Read']);
export const messageCategoryEnum = pgEnum('MessageCategory', ['RentReminder', 'PaymentConfirmation', 'LandlordAlert', 'RenewalRequest', 'General']);
export const responseStatusEnum = pgEnum('ResponseStatus', ['Pending', 'Received', 'Processed', 'Expired']);

// Tables
export const users = pgTable('User', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  password: text('password'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  verificationInitiatedAt: timestamp('verificationInitiatedAt'),
  verificationToken: text('verificationToken'),
  verificationTokenExpiresAt: timestamp('verificationTokenExpiresAt'),
  verificationResendCount: integer('verificationResendCount').default(0).notNull(),
  verificationLastResendAt: timestamp('verificationLastResendAt'),
  role: varchar('role', { length: 50 }).default('tenant').notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }),
  isOnboardingComplete: boolean('isOnboardingComplete').default(false).notNull(),
  legacyCognitoId: varchar('legacyCognitoId', { length: 255 }).unique(),
  banned: boolean('banned').default(false),
  banReason: text('banReason'),
  banExpires: timestamp('banExpires'),
});

export const accounts = pgTable('Account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  idToken: text('idToken'),
  password: text('password'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  providerAccountUnique: unique().on(table.providerId, table.accountId),
}));

export const sessions = pgTable('Session', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: varchar('ipAddress', { length: 45 }),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  impersonatedBy: text('impersonatedBy'),
});

export const verifications = pgTable('Verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  userId: text('userId'),
}, (table) => ({
  identifierValueUnique: unique().on(table.identifier, table.value),
}));

export const locations = pgTable('Location', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
  postalCode: varchar('postalCode', { length: 20 }).notNull(),
  coordinates: text('coordinates'), // Using text for geography type
});

export const landlordRegistrationCodes = pgTable('LandlordRegistrationCode', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  isUsed: boolean('isUsed').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  usedAt: timestamp('usedAt'),
});

export const agentRegistrationCodes = pgTable('AgentRegistrationCode', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  isUsed: boolean('isUsed').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  usedAt: timestamp('usedAt'),
  assignedBy: text('assignedBy'),
});

export const landlords = pgTable('Landlord', {
  id: serial('id').primaryKey(),
  cognitoId: varchar('cognitoId', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }),
  registrationCodeId: integer('registrationCodeId'),
  userId: text('userId').unique(),
  currentAddress: text('currentAddress'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postalCode', { length: 20 }),
  bankName: varchar('bankName', { length: 255 }),
  accountNumber: varchar('accountNumber', { length: 50 }),
  accountName: varchar('accountName', { length: 255 }),
  bankCode: varchar('bankCode', { length: 20 }),
  businessName: varchar('businessName', { length: 255 }),
  businessType: varchar('businessType', { length: 100 }),
  taxId: varchar('taxId', { length: 50 }),
  dateOfBirth: timestamp('dateOfBirth'),
  nationality: varchar('nationality', { length: 100 }),
  occupation: varchar('occupation', { length: 100 }),
  emergencyContactName: varchar('emergencyContactName', { length: 255 }),
  emergencyContactPhone: varchar('emergencyContactPhone', { length: 20 }),
  isOnboardingComplete: boolean('isOnboardingComplete').default(false).notNull(),
  onboardedAt: timestamp('onboardedAt'),
  tenantRegistrationLink: varchar('tenantRegistrationLink', { length: 255 }).unique(), // Unique shareable link
  linkGeneratedAt: timestamp('linkGeneratedAt'), // When the link was generated
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const tenants = pgTable('Tenant', {
  id: serial('id').primaryKey(),
  cognitoId: varchar('cognitoId', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }).notNull(),
  userId: text('userId').unique(),
  houseAddress: text('houseAddress'), // New field for house address
  registrationSource: varchar('registrationSource', { length: 50 }).default('direct').notNull(), // 'direct' or 'landlord_link'
  registeredByLandlordId: integer('registeredByLandlordId'), // Reference to landlord who registered this tenant
  currentPropertyId: integer('currentPropertyId'), // Reference to the property the tenant is currently associated with
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const agents = pgTable('Agent', {
  id: serial('id').primaryKey(),
  cognitoId: varchar('cognitoId', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }),
  address: text('address'),
  registrationCodeId: integer('registrationCodeId'),
  userId: text('userId').unique(),
});

export const admins = pgTable('Admin', {
  id: serial('id').primaryKey(),
  cognitoId: varchar('cognitoId', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }),
  userId: text('userId').unique(),
});

// Land/Property Sale user profile (role-specific)
export const saleUsers = pgTable('SaleUser', {
  id: serial('id').primaryKey(),
  cognitoId: varchar('cognitoId', { length: 255 }).notNull().unique(),
  userId: text('userId').unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }),
  displayRoleName: varchar('displayRoleName', { length: 100 }).default('Land/Property Sale').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Sale listings table for land and properties
export const saleListings = pgTable('SaleListing', {
  id: serial('id').primaryKey(),
  type: saleListingTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  locationAddress: text('locationAddress').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  country: varchar('country', { length: 100 }).default('Nigeria').notNull(),
  // Optional coordinates as text (GeoJSON string)
  coordinates: text('coordinates'),
  size: real('size'), // e.g., square meters or plot size
  sizeUnit: varchar('sizeUnit', { length: 50 }).default('sqm'),
  price: integer('price').notNull(), // Price in Nigerian Naira
  currency: varchar('currency', { length: 10 }).default('NGN').notNull(),
  features: json('features'),
  imageUrls: json('imageUrls'), // array of strings
  videoUrls: json('videoUrls'), // array of strings
  proofOfOwnershipUrl: text('proofOfOwnershipUrl'), // document URL
  status: saleListingStatusEnum('status').default('Pending').notNull(),
  createdByUserId: text('createdByUserId').notNull(),
  approvedByAdminId: integer('approvedByAdminId'),
  approvedAt: timestamp('approvedAt'),
  rejectionReason: text('rejectionReason'),
  submittedByRole: varchar('submittedByRole', { length: 20 }),
  // Extended fields for comprehensive land/property sale
  propertyType: varchar('propertyType', { length: 50 }), // Land/Residential/Commercial/Mixed-use
  lga: varchar('lga', { length: 100 }),
  street: varchar('street', { length: 255 }),
  plotSizeSqm: integer('plotSizeSqm'),
  numberOfPlots: integer('numberOfPlots').default(1),
  roadAccess: boolean('roadAccess'),
  roadAccessNotes: text('roadAccessNotes'),
  electricityAvailable: boolean('electricityAvailable'),
  landConditions: json('landConditions'), // [Dry, Wet, Fenced, Corner Piece, Bare]
  surveyPlanNumber: varchar('surveyPlanNumber', { length: 100 }),
  priceNegotiable: boolean('priceNegotiable').default(false),
  agreedSellingPrice: integer('agreedSellingPrice'),
  depositRequired: boolean('depositRequired').default(false),
  depositAmount: integer('depositAmount'),
  paymentOptions: json('paymentOptions'), // ['Outright','Flexible','Installment']
  installmentTerms: text('installmentTerms'),
  additionalFees: json('additionalFees'), // [{ name, amount }]
  paymentInstructions: text('paymentInstructions'),
  inspectionAllowed: boolean('inspectionAllowed').default(true),
  inspectionDays: json('inspectionDays'),
  inspectionTimeWindow: varchar('inspectionTimeWindow', { length: 100 }),
  inspectionContactPerson: varchar('inspectionContactPerson', { length: 255 }),
  inspectionNotes: text('inspectionNotes'),
  declarationSignedAt: timestamp('declarationSignedAt'),
  declarationSignatureUrl: text('declarationSignatureUrl'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Audit log for sale listing activities
export const saleListingAuditLog = pgTable('SaleListingAuditLog', {
  id: serial('id').primaryKey(),
  listingId: integer('listingId').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  actorUserId: text('actorUserId').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Title and supporting documents for sale listings
export const saleListingDocuments = pgTable('SaleListingDocument', {
  id: serial('id').primaryKey(),
  listingId: integer('listingId').notNull(),
  docType: varchar('docType', { length: 50 }).notNull(), // C_OF_O, GOVERNORS_CONSENT, GAZETTE, EXCISION, DEED_OF_ASSIGNMENT, SURVEY, REGISTERED_SURVEY, OTHER, SURVEY_PLAN, SUPPORTING
  fileUrl: text('fileUrl').notNull(),
  otherText: text('otherText'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Seller information captured per listing
export const saleSellers = pgTable('SaleSeller', {
  id: serial('id').primaryKey(),
  listingId: integer('listingId').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  isCompany: boolean('isCompany').default(false).notNull(),
  cacNumber: varchar('cacNumber', { length: 50 }),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  idType: varchar('idType', { length: 50 }).notNull(),
  idNumber: varchar('idNumber', { length: 100 }).notNull(),
  idFileUrl: text('idFileUrl'),
  bankName: varchar('bankName', { length: 255 }).notNull(),
  accountNumber: varchar('accountNumber', { length: 20 }).notNull(),
  accountName: varchar('accountName', { length: 255 }).notNull(),
  signatureUrl: text('signatureUrl'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Admin verification outcome and supporting documents
export const saleVerifications = pgTable('SaleVerification', {
  id: serial('id').primaryKey(),
  listingId: integer('listingId').notNull(),
  verifiedByUserId: text('verifiedByUserId').notNull(),
  verificationDate: timestamp('verificationDate').defaultNow().notNull(),
  outcome: varchar('outcome', { length: 50 }).notNull(), // Genuine, UnderInvestigation, Disputed
  notes: text('notes'),
});

export const properties = pgTable('Property', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  pricePerYear: real('pricePerYear').notNull(),
  serviceCharge: real('serviceCharge').default(0).notNull(),
  securityDeposit: real('securityDeposit').notNull(),
  applicationFee: real('applicationFee').notNull(),
  photoUrls: json('photoUrls').$type<string[]>().notNull(),
  videoUrl: text('videoUrl'),
  amenities: text('amenities'),
  isParkingIncluded: boolean('isParkingIncluded').default(false).notNull(),
  maritalPreference: maritalPreferenceEnum('maritalPreference').default('Any').notNull(),
  genderPreference: genderPreferenceEnum('genderPreference').default('Any').notNull(),
  childrenPreference: childrenPreferenceEnum('childrenPreference').default('Any').notNull(),
  beds: integer('beds').notNull(),
  baths: real('baths').notNull(),
  squareFeet: integer('squareFeet').notNull(),
  propertyType: propertyTypeEnum('propertyType').notNull(),
  status: propertyStatusEnum('status').default('Available').notNull(),
  postedDate: timestamp('postedDate').defaultNow().notNull(),
  locationId: integer('locationId').notNull(),
  landlordCognitoId: varchar('landlordCognitoId', { length: 255 }).notNull(),
  availableUnits: integer('availableUnits').default(1).notNull(),
});

export const tasks = pgTable('Task', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('Pending').notNull(),
  priority: taskPriorityEnum('priority').default('Medium').notNull(),
  dueDate: timestamp('dueDate'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  assignedBy: text('assignedBy').notNull(),
  agentId: integer('agentId').notNull(),
});

export const agentProperties = pgTable('AgentProperty', {
  id: serial('id').primaryKey(),
  agentId: integer('agentId').notNull(),
  propertyId: integer('propertyId').notNull(),
  assignedAt: timestamp('assignedAt').defaultNow().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  agentPropertyUnique: unique().on(table.agentId, table.propertyId),
}));

export const applications = pgTable('Application', {
  id: serial('id').primaryKey(),
  applicationDate: timestamp('applicationDate').notNull(),
  status: applicationStatusEnum('status').notNull(),
  propertyId: integer('propertyId').notNull(),
  tenantCognitoId: varchar('tenantCognitoId', { length: 255 }).notNull(),
  paymentDeadline: timestamp('paymentDeadline'),
  keyDeliveryType: text('keyDeliveryType'),
  keyDeliveryInstructions: text('keyDeliveryInstructions'),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }).notNull(),
  preferredMoveInDate: timestamp('preferredMoveInDate'),
  gender: varchar('gender', { length: 20 }),
  dateOfBirth: timestamp('dateOfBirth'),
  nationality: varchar('nationality', { length: 100 }),
  maritalStatus: varchar('maritalStatus', { length: 50 }),
  idType: varchar('idType', { length: 50 }),
  idDocumentUrl: text('idDocumentUrl'),
  durationAtCurrentAddress: varchar('durationAtCurrentAddress', { length: 100 }),
  employmentStatus: varchar('employmentStatus', { length: 100 }),
  occupation: varchar('occupation', { length: 100 }),
  employerName: varchar('employerName', { length: 255 }),
  workAddress: text('workAddress'),
  monthlyIncome: real('monthlyIncome'),
  durationAtCurrentJob: varchar('durationAtCurrentJob', { length: 100 }),
  incomeProofUrl: text('incomeProofUrl'),
  previousEmployerName: varchar('previousEmployerName', { length: 255 }),
  previousJobTitle: varchar('previousJobTitle', { length: 255 }),
  previousEmploymentDuration: varchar('previousEmploymentDuration', { length: 100 }),
  reasonForLeavingPrevJob: text('reasonForLeavingPrevJob'),
  numberOfOccupants: integer('numberOfOccupants'),
  relationshipToOccupants: text('relationshipToOccupants'),
  hasPets: boolean('hasPets'),
  isSmoker: boolean('isSmoker'),
  accessibilityNeeds: text('accessibilityNeeds'),
  reasonForLeaving: text('reasonForLeaving'),
  consentToInformation: boolean('consentToInformation'),
  consentToVerification: boolean('consentToVerification'),
  consentToTenancyTerms: boolean('consentToTenancyTerms'),
  consentToPrivacyPolicy: boolean('consentToPrivacyPolicy'),
  leaseId: integer('leaseId').unique(),
});

export const leases = pgTable('Lease', {
  id: serial('id').primaryKey(),
  startDate: timestamp('startDate').notNull(),
  endDate: timestamp('endDate').notNull(),
  rent: real('rent').notNull(),
  deposit: real('deposit').notNull(),
  propertyId: integer('propertyId').notNull(),
  tenantCognitoId: varchar('tenantCognitoId', { length: 255 }).notNull(),
});

export const payments = pgTable('Payment', {
  id: serial('id').primaryKey(),
  amountDue: real('amountDue').notNull(),
  amountPaid: real('amountPaid').notNull(),
  dueDate: timestamp('dueDate').notNull(),
  paymentDate: timestamp('paymentDate').notNull(),
  paymentStatus: paymentStatusEnum('paymentStatus').notNull(),
  paystackReference: text('paystackReference'),
  leaseId: integer('leaseId'),
  applicationId: integer('applicationId'),
});

// Continue with remaining tables...
export const adminSettings = pgTable('AdminSettings', {
  id: serial('id').primaryKey(),
  siteName: varchar('siteName', { length: 255 }).default('HomeMatch').notNull(),
  siteDescription: text('siteDescription').default('Find your perfect rental property').notNull(),
  allowRegistration: boolean('allowRegistration').default(true).notNull(),
  maxPropertiesPerLandlord: integer('maxPropertiesPerLandlord').default(50).notNull(),
  commissionRate: real('commissionRate').default(5.0).notNull(),
  emailNotifications: boolean('emailNotifications').default(true).notNull(),
  smsNotifications: boolean('smsNotifications').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const tenantSurveys = pgTable('TenantSurvey', {
  id: serial('id').primaryKey(),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  currentLocation: varchar('currentLocation', { length: 255 }).notNull(),
  rentingStatus: varchar('rentingStatus', { length: 100 }).notNull(),
  housingType: json('housingType').$type<string[]>().notNull(),
  frustrations: json('frustrations').$type<string[]>().notNull(),
  scamExperience: varchar('scamExperience', { length: 100 }).notNull(),
  scamDetails: text('scamDetails'),
  propertyListingRating: varchar('propertyListingRating', { length: 50 }).notNull(),
  dashboardRating: varchar('dashboardRating', { length: 50 }).notNull(),
  maintenanceRating: varchar('maintenanceRating', { length: 50 }).notNull(),
  rentCollectionRating: varchar('rentCollectionRating', { length: 50 }).notNull(),
  customerSupportRating: varchar('customerSupportRating', { length: 50 }).notNull(),
  monthlyReportRating: varchar('monthlyReportRating', { length: 50 }).notNull(),
  wishEasier: text('wishEasier').notNull(),
  launchNotification: varchar('launchNotification', { length: 100 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const landlordSurveys = pgTable('LandlordSurvey', {
  id: serial('id').primaryKey(),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  propertyLocation: varchar('propertyLocation', { length: 255 }).notNull(),
  numberOfProperties: varchar('numberOfProperties', { length: 100 }).notNull(),
  propertyTypes: json('propertyTypes').$type<string[]>().notNull(),
  tenantManagement: json('tenantManagement').$type<string[]>().notNull(),
  biggestChallenges: json('biggestChallenges').$type<string[]>().notNull(),
  agentIssues: varchar('agentIssues', { length: 100 }).notNull(),
  platformInterest: varchar('platformInterest', { length: 100 }).notNull(),
  propertyListingRating: varchar('propertyListingRating', { length: 50 }).notNull(),
  dashboardRating: varchar('dashboardRating', { length: 50 }).notNull(),
  maintenanceRating: varchar('maintenanceRating', { length: 50 }).notNull(),
  rentCollectionRating: varchar('rentCollectionRating', { length: 50 }).notNull(),
  customerSupportRating: varchar('customerSupportRating', { length: 50 }).notNull(),
  monthlyReportRating: varchar('monthlyReportRating', { length: 50 }).notNull(),
  wishEasier: text('wishEasier').notNull(),
  launchNotification: varchar('launchNotification', { length: 100 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const emailSubscriptions = pgTable('EmailSubscription', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  subscriptionType: varchar('subscriptionType', { length: 100 }).notNull(),
  isActive: boolean('isActive').default(true).notNull(),
  subscribedAt: timestamp('subscribedAt').defaultNow().notNull(),
  unsubscribedAt: timestamp('unsubscribedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const inspections = pgTable('Inspection', {
  id: serial('id').primaryKey(),
  propertyId: integer('propertyId').notNull(),
  tenantCognitoId: varchar('tenantCognitoId', { length: 255 }).notNull(),
  scheduledDate: timestamp('scheduledDate').notNull(),
  status: inspectionStatusEnum('status').default('Pending').notNull(),
  tenantName: varchar('tenantName', { length: 255 }).notNull(),
  tenantEmail: varchar('tenantEmail', { length: 255 }).notNull(),
  tenantPhone: varchar('tenantPhone', { length: 20 }).notNull(),
  preferredTime: varchar('preferredTime', { length: 100 }).notNull(),
  message: text('message'),
  adminNotes: text('adminNotes'),
  agentId: integer('agentId'),
  depositPaid: boolean('depositPaid').default(false).notNull(),
  depositAmount: real('depositAmount'),
  paymentReference: varchar('paymentReference', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const inspectionLimits = pgTable('InspectionLimit', {
  id: serial('id').primaryKey(),
  tenantCognitoId: varchar('tenantCognitoId', { length: 255 }).notNull().unique(),
  freeInspections: integer('freeInspections').default(2).notNull(),
  usedInspections: integer('usedInspections').default(0).notNull(),
  hasUnlimited: boolean('hasUnlimited').default(false).notNull(),
  unlimitedUntil: timestamp('unlimitedUntil'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const withdrawals = pgTable('Withdrawal', {
  id: serial('id').primaryKey(),
  amount: real('amount').notNull(),
  status: withdrawalStatusEnum('status').default('Pending').notNull(),
  requestDate: timestamp('requestDate').defaultNow().notNull(),
  processedDate: timestamp('processedDate'),
  landlordCognitoId: varchar('landlordCognitoId', { length: 255 }).notNull(),
  bankName: varchar('bankName', { length: 255 }),
  accountNumber: varchar('accountNumber', { length: 50 }),
  accountName: varchar('accountName', { length: 255 }),
  reference: varchar('reference', { length: 255 }).unique(),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Landlord acquisition intake records
export const landlordAcquisitions = pgTable('LandlordAcquisition', {
  id: serial('id').primaryKey(),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  phoneNumber: varchar('phoneNumber', { length: 20 }).notNull(),
  address: text('address').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  propertyTypes: json('propertyTypes').$type<string[]>().notNull(),
  status: landlordAcquisitionStatusEnum('status').default('Pending').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const jobs = pgTable('Job', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  requirements: text('requirements').notNull(),
  responsibilities: text('responsibilities').notNull(),
  jobType: jobTypeEnum('jobType').notNull(),
  experienceLevel: experienceLevelEnum('experienceLevel').notNull(),
  salaryMin: real('salaryMin'),
  salaryMax: real('salaryMax'),
  location: varchar('location', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }),
  isActive: boolean('isActive').default(true).notNull(),
  postedDate: timestamp('postedDate').defaultNow().notNull(),
  closingDate: timestamp('closingDate'),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const jobApplications = pgTable('JobApplication', {
  id: serial('id').primaryKey(),
  jobId: uuid('jobId').notNull(),
  applicantName: varchar('applicantName', { length: 255 }).notNull(),
  applicantEmail: varchar('applicantEmail', { length: 255 }).notNull(),
  applicantPhone: varchar('applicantPhone', { length: 20 }),
  resumeUrl: text('resumeUrl').notNull(),
  coverLetter: text('coverLetter'),
  experience: text('experience'),
  education: text('education'),
  skills: text('skills'),
  portfolioUrl: text('portfolioUrl'),
  linkedinUrl: text('linkedinUrl'),
  status: jobApplicationStatusEnum('status').default('Submitted').notNull(),
  submittedAt: timestamp('submittedAt').defaultNow().notNull(),
  reviewedAt: timestamp('reviewedAt'),
  reviewedBy: text('reviewedBy'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const jobApplicationRatings = pgTable('JobApplicationRating', {
  id: serial('id').primaryKey(),
  jobApplicationId: integer('jobApplicationId').notNull(),
  criteriaName: varchar('criteriaName', { length: 255 }).notNull(),
  score: integer('score').notNull(),
  maxScore: integer('maxScore').default(10).notNull(),
  weight: real('weight').default(1.0).notNull(),
  comments: text('comments'),
  ratedBy: text('ratedBy').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  jobApplicationCriteriaUnique: unique().on(table.jobApplicationId, table.criteriaName),
}));

export const notifications = pgTable('Notification', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: notificationTypeEnum('type').notNull(),
  priority: notificationPriorityEnum('priority').default('Medium').notNull(),
  isRead: boolean('isRead').default(false).notNull(),
  recipientId: text('recipientId').notNull(),
  recipientType: varchar('recipientType', { length: 50 }).notNull(),
  relatedId: integer('relatedId'),
  relatedType: varchar('relatedType', { length: 100 }),
  actionUrl: text('actionUrl'),
  actionText: varchar('actionText', { length: 255 }),
  metadata: json('metadata'),
  expiresAt: timestamp('expiresAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const activityFeeds = pgTable('ActivityFeed', {
  id: serial('id').primaryKey(),
  type: activityTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  actorId: text('actorId').notNull(),
  actorType: varchar('actorType', { length: 50 }).notNull(),
  actorName: varchar('actorName', { length: 255 }).notNull(),
  targetId: integer('targetId'),
  targetType: varchar('targetType', { length: 100 }),
  metadata: json('metadata'),
  isPublic: boolean('isPublic').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Audit log table for tracking landlord edits
export const tenantEditAuditLog = pgTable('TenantEditAuditLog', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenantId').notNull(),
  landlordId: integer('landlordId').notNull(),
  fieldName: varchar('fieldName', { length: 100 }).notNull(),
  oldValue: text('oldValue'),
  newValue: text('newValue'),
  editedAt: timestamp('editedAt').defaultNow().notNull(),
  editedBy: text('editedBy').notNull(), // User ID of the landlord who made the edit
  isOneTimeEdit: boolean('isOneTimeEdit').default(true).notNull(),
});

// Many-to-many relationship tables
export const tenantFavorites = pgTable('TenantFavorites', {
  tenantId: integer('tenantId').notNull(),
  propertyId: integer('propertyId').notNull(),
}, (table) => ({
  pk: unique().on(table.tenantId, table.propertyId),
}));

export const tenantProperties = pgTable('TenantProperties', {
  tenantId: integer('tenantId').notNull(),
  propertyId: integer('propertyId').notNull(),
}, (table) => ({
  pk: unique().on(table.tenantId, table.propertyId),
}));

// Spatial reference system table (for PostGIS)
export const spatialRefSys = pgTable('spatial_ref_sys', {
  srid: integer('srid').primaryKey(),
  authName: varchar('auth_name', { length: 256 }),
  authSrid: integer('auth_srid'),
  srtext: varchar('srtext', { length: 2048 }),
  proj4text: varchar('proj4text', { length: 2048 }),
});

// SMS/WhatsApp messaging tables
export const smsMessages = pgTable('SMSMessage', {
  id: serial('id').primaryKey(),
  messageId: varchar('messageId', { length: 255 }).unique(), // Termii message ID
  recipientPhone: varchar('recipientPhone', { length: 20 }).notNull(),
  recipientId: text('recipientId').notNull(), // User ID (tenant/landlord)
  recipientType: varchar('recipientType', { length: 50 }).notNull(), // 'tenant' or 'landlord'
  messageType: messageTypeEnum('messageType').notNull(),
  category: messageCategoryEnum('category').notNull(),
  content: text('content').notNull(),
  status: messageStatusEnum('status').default('Pending').notNull(),
  termiiResponse: json('termiiResponse'), // Store Termii API response
  deliveredAt: timestamp('deliveredAt'),
  readAt: timestamp('readAt'),
  failureReason: text('failureReason'),
  retryCount: integer('retryCount').default(0).notNull(),
  maxRetries: integer('maxRetries').default(3).notNull(),
  relatedId: integer('relatedId'), // Related payment, lease, etc.
  relatedType: varchar('relatedType', { length: 100 }), // 'payment', 'lease', etc.
  metadata: json('metadata'), // Additional context data
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const messageResponses = pgTable('MessageResponse', {
  id: serial('id').primaryKey(),
  messageId: integer('messageId').notNull(), // Reference to SMSMessage
  responseText: varchar('responseText', { length: 10 }).notNull(), // 'YES', 'NO', etc.
  responsePhone: varchar('responsePhone', { length: 20 }).notNull(),
  status: responseStatusEnum('status').default('Received').notNull(),
  processedAt: timestamp('processedAt'),
  processingResult: json('processingResult'), // Result of automated processing
  errorMessage: text('errorMessage'),
  isValid: boolean('isValid').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const messageAuditLog = pgTable('MessageAuditLog', {
  id: serial('id').primaryKey(),
  messageId: integer('messageId'), // Reference to SMSMessage
  responseId: integer('responseId'), // Reference to MessageResponse
  action: varchar('action', { length: 100 }).notNull(), // 'sent', 'delivered', 'response_received', 'processed', etc.
  details: json('details'), // Additional action details
  performedBy: text('performedBy'), // System or user ID
  ipAddress: varchar('ipAddress', { length: 45 }),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const renewalRequests = pgTable('RenewalRequest', {
  id: serial('id').primaryKey(),
  leaseId: integer('leaseId').notNull(),
  tenantId: integer('tenantId').notNull(),
  landlordId: integer('landlordId').notNull(),
  propertyId: integer('propertyId').notNull(),
  messageId: integer('messageId'), // Reference to the SMS message sent
  responseId: integer('responseId'), // Reference to tenant's response
  tenantResponse: varchar('tenantResponse', { length: 10 }), // 'YES' or 'NO'
  responseReceivedAt: timestamp('responseReceivedAt'),
  status: varchar('status', { length: 50 }).default('Pending').notNull(), // 'Pending', 'Accepted', 'Declined', 'Expired'
  expiresAt: timestamp('expiresAt').notNull(), // When the request expires
  processedAt: timestamp('processedAt'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Table to store rental details for landlord-registered tenants
export const landlordTenantRentals = pgTable('LandlordTenantRental', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenantId').notNull(), // Reference to tenant
  landlordId: integer('landlordId').notNull(), // Reference to landlord
  rentAmount: real('rentAmount').notNull(), // Yearly rent amount in Naira
  rentDueDate: timestamp('rentDueDate').notNull(), // Next rent due date (yearly recurring)
  leaseStartDate: timestamp('leaseStartDate'), // Lease start date
  leaseEndDate: timestamp('leaseEndDate'), // Lease end date
  paymentMethod: varchar('paymentMethod', { length: 100 }).notNull(), // Payment method for rent
  propertyAddress: text('propertyAddress').notNull(), // Address of the rental property
  isRentOverdue: boolean('isRentOverdue').default(false).notNull(), // Flag for overdue rent
  applicationFeeAdded: boolean('applicationFeeAdded').default(false).notNull(), // Flag for application fee
  securityDepositAdded: boolean('securityDepositAdded').default(false).notNull(), // Flag for security deposit
  hasBeenEditedByLandlord: boolean('hasBeenEditedByLandlord').default(false).notNull(), // One-time edit flag
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  // Ensure one rental record per tenant-landlord pair
  tenantLandlordUnique: unique().on(table.tenantId, table.landlordId),
}));

// ===================== BLOG SYSTEM =====================
export const blogPostStatusEnum = pgEnum('BlogPostStatus', ['Draft', 'Published', 'Scheduled']);

export const bloggers = pgTable('Blogger', {
  id: serial('id').primaryKey(),
  userId: text('userId').unique(),
  displayName: varchar('displayName', { length: 255 }).notNull(),
  bio: text('bio'),
  avatarUrl: text('avatarUrl'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const blogCategories = pgTable('BlogCategory', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const blogTags = pgTable('BlogTag', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const blogPosts = pgTable('BlogPost', {
  id: serial('id').primaryKey(),
  authorUserId: text('authorUserId').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 220 }).notNull().unique(),
  excerpt: varchar('excerpt', { length: 300 }),
  contentHtml: text('contentHtml').notNull(),
  featuredImageUrl: text('featuredImageUrl'),
  featuredImageAlt: varchar('featuredImageAlt', { length: 160 }),
  status: blogPostStatusEnum('status').default('Draft').notNull(),
  publishedAt: timestamp('publishedAt'),
  scheduledFor: timestamp('scheduledFor'),
  metaTitle: varchar('metaTitle', { length: 70 }),
  metaDescription: varchar('metaDescription', { length: 160 }),
  ogTitle: varchar('ogTitle', { length: 100 }),
  ogDescription: varchar('ogDescription', { length: 200 }),
  ogImageUrl: text('ogImageUrl'),
  categoryId: integer('categoryId'),
  readingTimeMinutes: integer('readingTimeMinutes').default(1).notNull(),
  internalLinks: json('internalLinks'), // array of slugs/urls referenced internally
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const blogPostTags = pgTable('BlogPostTag', {
  postId: integer('postId').notNull(),
  tagId: integer('tagId').notNull(),
}, (table) => ({
  pk: unique().on(table.postId, table.tagId),
}));

 
export const adminAuditLogs = pgTable('AdminAuditLog', {
  id: serial('id').primaryKey(),
  adminUserId: text('adminUserId').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  targetUserId: text('targetUserId'),
  details: json('details'),
  ipAddress: varchar('ipAddress', { length: 45 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
