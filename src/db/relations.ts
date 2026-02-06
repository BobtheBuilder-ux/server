import { relations } from 'drizzle-orm';
import {
  users,
  accounts,
  sessions,
  verifications,
  landlords,
  tenants,
  agents,
  admins,
  properties,
  locations,
  applications,
  leases,
  payments,
  inspections,
  inspectionLimits,
  tasks,
  agentProperties,
  landlordRegistrationCodes,
  agentRegistrationCodes,
  withdrawals,
  jobs,
  jobApplications,
  jobApplicationRatings,
  tenantFavorites,
  tenantProperties,
  smsMessages,
  messageResponses,
  messageAuditLog,
  renewalRequests,
  bloggers,
  blogPosts,
  blogCategories,
  blogTags,
  blogPostTags,
  realEstateCompanies,
  saleListings,
} from './schema';

// Real Estate Company relations
export const realEstateCompaniesRelations = relations(realEstateCompanies, ({ one, many }) => ({
  user: one(users, {
    fields: [realEstateCompanies.userId],
    references: [users.id],
  }),
  listings: many(saleListings),
}));

// Sale Listing relations
export const saleListingsRelations = relations(saleListings, ({ one }) => ({
  company: one(realEstateCompanies, {
    fields: [saleListings.realEstateCompanyId],
    references: [realEstateCompanies.id],
  }),
}));

// User relations
export const usersRelations = relations(users, ({ one, many }) => ({
  adminProfile: one(admins, {
    fields: [users.id],
    references: [admins.userId],
  }),
  agentProfile: one(agents, {
    fields: [users.id],
    references: [agents.userId],
  }),
  landlordProfile: one(landlords, {
    fields: [users.id],
    references: [landlords.userId],
  }),
  tenantProfile: one(tenants, {
    fields: [users.id],
    references: [tenants.userId],
  }),
  bloggerProfile: one(bloggers, {
    fields: [users.id],
    references: [bloggers.userId],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  verifications: many(verifications),
}));

// Account relations
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Session relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Verification relations
export const verificationsRelations = relations(verifications, ({ one }) => ({
  user: one(users, {
    fields: [verifications.userId],
    references: [users.id],
  }),
}));

// Landlord relations
export const landlordsRelations = relations(landlords, ({ one, many }) => ({
  user: one(users, {
    fields: [landlords.userId],
    references: [users.id],
  }),
  registrationCode: one(landlordRegistrationCodes, {
    fields: [landlords.registrationCodeId],
    references: [landlordRegistrationCodes.id],
  }),
  createdByAgent: one(agents, {
    fields: [landlords.createdByAgentId],
    references: [agents.id],
  }),
  managedProperties: many(properties),
  withdrawals: many(withdrawals),
}));

// Tenant relations
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  user: one(users, {
    fields: [tenants.userId],
    references: [users.id],
  }),
  applications: many(applications),
  inspections: many(inspections),
  inspectionLimit: one(inspectionLimits, {
    fields: [tenants.cognitoId],
    references: [inspectionLimits.tenantCognitoId],
  }),
  leases: many(leases),
  favorites: many(tenantFavorites),
  properties: many(tenantProperties),
}));

// Agent relations
export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  registrationCode: one(agentRegistrationCodes, {
    fields: [agents.registrationCodeId],
    references: [agentRegistrationCodes.id],
  }),
  assignedProperties: many(agentProperties),
  inspections: many(inspections),
  assignedTasks: many(tasks),
}));

// Admin relations
export const adminsRelations = relations(admins, ({ one }) => ({
  user: one(users, {
    fields: [admins.userId],
    references: [users.id],
  }),
}));

// Property relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  landlord: one(landlords, {
    fields: [properties.landlordCognitoId],
    references: [landlords.cognitoId],
  }),
  location: one(locations, {
    fields: [properties.locationId],
    references: [locations.id],
  }),
  agentAssignments: many(agentProperties),
  applications: many(applications),
  inspections: many(inspections),
  leases: many(leases),
  favoritedBy: many(tenantFavorites),
  tenants: many(tenantProperties),
}));

// Location relations
export const locationsRelations = relations(locations, ({ many }) => ({
  properties: many(properties),
}));

// Application relations
export const applicationsRelations = relations(applications, ({ one }) => ({
  property: one(properties, {
    fields: [applications.propertyId],
    references: [properties.id],
  }),
  tenant: one(tenants, {
    fields: [applications.tenantCognitoId],
    references: [tenants.cognitoId],
  }),
  lease: one(leases, {
    fields: [applications.leaseId],
    references: [leases.id],
  }),
}));

// Lease relations
export const leasesRelations = relations(leases, ({ one, many }) => ({
  property: one(properties, {
    fields: [leases.propertyId],
    references: [properties.id],
  }),
  tenant: one(tenants, {
    fields: [leases.tenantCognitoId],
    references: [tenants.cognitoId],
  }),
  application: one(applications, {
    fields: [leases.id],
    references: [applications.leaseId],
  }),
  payments: many(payments),
}));

// Payment relations
export const paymentsRelations = relations(payments, ({ one }) => ({
  lease: one(leases, {
    fields: [payments.leaseId],
    references: [leases.id],
  }),
}));

// Inspection relations
export const inspectionsRelations = relations(inspections, ({ one }) => ({
  property: one(properties, {
    fields: [inspections.propertyId],
    references: [properties.id],
  }),
  tenant: one(tenants, {
    fields: [inspections.tenantCognitoId],
    references: [tenants.cognitoId],
  }),
  agent: one(agents, {
    fields: [inspections.agentId],
    references: [agents.id],
  }),
}));

// Inspection limit relations
export const inspectionLimitsRelations = relations(inspectionLimits, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inspectionLimits.tenantCognitoId],
    references: [tenants.cognitoId],
  }),
}));

// Task relations
export const tasksRelations = relations(tasks, ({ one }) => ({
  agent: one(agents, {
    fields: [tasks.agentId],
    references: [agents.id],
  }),
}));

// Agent property relations
export const agentPropertiesRelations = relations(agentProperties, ({ one }) => ({
  agent: one(agents, {
    fields: [agentProperties.agentId],
    references: [agents.id],
  }),
  property: one(properties, {
    fields: [agentProperties.propertyId],
    references: [properties.id],
  }),
}));

// Landlord registration code relations
export const landlordRegistrationCodesRelations = relations(landlordRegistrationCodes, ({ many }) => ({
  landlords: many(landlords),
}));

// Agent registration code relations
export const agentRegistrationCodesRelations = relations(agentRegistrationCodes, ({ many }) => ({
  agents: many(agents),
}));

// Withdrawal relations
export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  landlord: one(landlords, {
    fields: [withdrawals.landlordCognitoId],
    references: [landlords.cognitoId],
  }),
}));

// Job relations
export const jobsRelations = relations(jobs, ({ many }) => ({
  applications: many(jobApplications),
}));

// Job application relations
export const jobApplicationsRelations = relations(jobApplications, ({ one, many }) => ({
  job: one(jobs, {
    fields: [jobApplications.jobId],
    references: [jobs.id],
  }),
  ratings: many(jobApplicationRatings),
}));

// Job application rating relations
export const jobApplicationRatingsRelations = relations(jobApplicationRatings, ({ one }) => ({
  jobApplication: one(jobApplications, {
    fields: [jobApplicationRatings.jobApplicationId],
    references: [jobApplications.id],
  }),
}));

// Tenant favorites relations
export const tenantFavoritesRelations = relations(tenantFavorites, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantFavorites.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [tenantFavorites.propertyId],
    references: [properties.id],
  }),
}));

// Tenant properties relations
export const tenantPropertiesRelations = relations(tenantProperties, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantProperties.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [tenantProperties.propertyId],
    references: [properties.id],
  }),
}));

// Blogger relations
export const bloggersRelations = relations(bloggers, ({ one, many }) => ({
  user: one(users, {
    fields: [bloggers.userId],
    references: [users.id],
  }),
  posts: many(blogPosts),
}));

// Blog post relations
export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [blogPosts.authorUserId],
    references: [users.id],
  }),
  category: one(blogCategories, {
    fields: [blogPosts.categoryId],
    references: [blogCategories.id],
  }),
  tags: many(blogPostTags),
}));

// Blog category relations
export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
  posts: many(blogPosts),
}));

// Blog tag relations
export const blogTagsRelations = relations(blogTags, ({ many }) => ({
  postTags: many(blogPostTags),
}));

// Blog post tag relations
export const blogPostTagsRelations = relations(blogPostTags, ({ one }) => ({
  post: one(blogPosts, {
    fields: [blogPostTags.postId],
    references: [blogPosts.id],
  }),
  tag: one(blogTags, {
    fields: [blogPostTags.tagId],
    references: [blogTags.id],
  }),
}));
