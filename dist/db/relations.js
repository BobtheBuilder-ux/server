"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantPropertiesRelations = exports.tenantFavoritesRelations = exports.jobApplicationRatingsRelations = exports.jobApplicationsRelations = exports.jobsRelations = exports.withdrawalsRelations = exports.agentRegistrationCodesRelations = exports.landlordRegistrationCodesRelations = exports.agentPropertiesRelations = exports.tasksRelations = exports.inspectionLimitsRelations = exports.inspectionsRelations = exports.paymentsRelations = exports.leasesRelations = exports.applicationsRelations = exports.locationsRelations = exports.propertiesRelations = exports.adminsRelations = exports.agentsRelations = exports.tenantsRelations = exports.landlordsRelations = exports.verificationsRelations = exports.sessionsRelations = exports.accountsRelations = exports.usersRelations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("./schema");
exports.usersRelations = (0, drizzle_orm_1.relations)(schema_1.users, ({ one, many }) => ({
    adminProfile: one(schema_1.admins, {
        fields: [schema_1.users.id],
        references: [schema_1.admins.userId],
    }),
    agentProfile: one(schema_1.agents, {
        fields: [schema_1.users.id],
        references: [schema_1.agents.userId],
    }),
    landlordProfile: one(schema_1.landlords, {
        fields: [schema_1.users.id],
        references: [schema_1.landlords.userId],
    }),
    tenantProfile: one(schema_1.tenants, {
        fields: [schema_1.users.id],
        references: [schema_1.tenants.userId],
    }),
    accounts: many(schema_1.accounts),
    sessions: many(schema_1.sessions),
    verifications: many(schema_1.verifications),
}));
exports.accountsRelations = (0, drizzle_orm_1.relations)(schema_1.accounts, ({ one }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.accounts.userId],
        references: [schema_1.users.id],
    }),
}));
exports.sessionsRelations = (0, drizzle_orm_1.relations)(schema_1.sessions, ({ one }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.sessions.userId],
        references: [schema_1.users.id],
    }),
}));
exports.verificationsRelations = (0, drizzle_orm_1.relations)(schema_1.verifications, ({ one }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.verifications.userId],
        references: [schema_1.users.id],
    }),
}));
exports.landlordsRelations = (0, drizzle_orm_1.relations)(schema_1.landlords, ({ one, many }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.landlords.userId],
        references: [schema_1.users.id],
    }),
    registrationCode: one(schema_1.landlordRegistrationCodes, {
        fields: [schema_1.landlords.registrationCodeId],
        references: [schema_1.landlordRegistrationCodes.id],
    }),
    managedProperties: many(schema_1.properties),
    withdrawals: many(schema_1.withdrawals),
}));
exports.tenantsRelations = (0, drizzle_orm_1.relations)(schema_1.tenants, ({ one, many }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.tenants.userId],
        references: [schema_1.users.id],
    }),
    applications: many(schema_1.applications),
    inspections: many(schema_1.inspections),
    inspectionLimit: one(schema_1.inspectionLimits, {
        fields: [schema_1.tenants.cognitoId],
        references: [schema_1.inspectionLimits.tenantCognitoId],
    }),
    leases: many(schema_1.leases),
    favorites: many(schema_1.tenantFavorites),
    properties: many(schema_1.tenantProperties),
}));
exports.agentsRelations = (0, drizzle_orm_1.relations)(schema_1.agents, ({ one, many }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.agents.userId],
        references: [schema_1.users.id],
    }),
    registrationCode: one(schema_1.agentRegistrationCodes, {
        fields: [schema_1.agents.registrationCodeId],
        references: [schema_1.agentRegistrationCodes.id],
    }),
    assignedProperties: many(schema_1.agentProperties),
    inspections: many(schema_1.inspections),
    assignedTasks: many(schema_1.tasks),
}));
exports.adminsRelations = (0, drizzle_orm_1.relations)(schema_1.admins, ({ one }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.admins.userId],
        references: [schema_1.users.id],
    }),
}));
exports.propertiesRelations = (0, drizzle_orm_1.relations)(schema_1.properties, ({ one, many }) => ({
    landlord: one(schema_1.landlords, {
        fields: [schema_1.properties.landlordCognitoId],
        references: [schema_1.landlords.cognitoId],
    }),
    location: one(schema_1.locations, {
        fields: [schema_1.properties.locationId],
        references: [schema_1.locations.id],
    }),
    agentAssignments: many(schema_1.agentProperties),
    applications: many(schema_1.applications),
    inspections: many(schema_1.inspections),
    leases: many(schema_1.leases),
    favoritedBy: many(schema_1.tenantFavorites),
    tenants: many(schema_1.tenantProperties),
}));
exports.locationsRelations = (0, drizzle_orm_1.relations)(schema_1.locations, ({ many }) => ({
    properties: many(schema_1.properties),
}));
exports.applicationsRelations = (0, drizzle_orm_1.relations)(schema_1.applications, ({ one }) => ({
    property: one(schema_1.properties, {
        fields: [schema_1.applications.propertyId],
        references: [schema_1.properties.id],
    }),
    tenant: one(schema_1.tenants, {
        fields: [schema_1.applications.tenantCognitoId],
        references: [schema_1.tenants.cognitoId],
    }),
    lease: one(schema_1.leases, {
        fields: [schema_1.applications.leaseId],
        references: [schema_1.leases.id],
    }),
}));
exports.leasesRelations = (0, drizzle_orm_1.relations)(schema_1.leases, ({ one, many }) => ({
    property: one(schema_1.properties, {
        fields: [schema_1.leases.propertyId],
        references: [schema_1.properties.id],
    }),
    tenant: one(schema_1.tenants, {
        fields: [schema_1.leases.tenantCognitoId],
        references: [schema_1.tenants.cognitoId],
    }),
    application: one(schema_1.applications, {
        fields: [schema_1.leases.id],
        references: [schema_1.applications.leaseId],
    }),
    payments: many(schema_1.payments),
}));
exports.paymentsRelations = (0, drizzle_orm_1.relations)(schema_1.payments, ({ one }) => ({
    lease: one(schema_1.leases, {
        fields: [schema_1.payments.leaseId],
        references: [schema_1.leases.id],
    }),
}));
exports.inspectionsRelations = (0, drizzle_orm_1.relations)(schema_1.inspections, ({ one }) => ({
    property: one(schema_1.properties, {
        fields: [schema_1.inspections.propertyId],
        references: [schema_1.properties.id],
    }),
    tenant: one(schema_1.tenants, {
        fields: [schema_1.inspections.tenantCognitoId],
        references: [schema_1.tenants.cognitoId],
    }),
    agent: one(schema_1.agents, {
        fields: [schema_1.inspections.agentId],
        references: [schema_1.agents.id],
    }),
}));
exports.inspectionLimitsRelations = (0, drizzle_orm_1.relations)(schema_1.inspectionLimits, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.inspectionLimits.tenantCognitoId],
        references: [schema_1.tenants.cognitoId],
    }),
}));
exports.tasksRelations = (0, drizzle_orm_1.relations)(schema_1.tasks, ({ one }) => ({
    agent: one(schema_1.agents, {
        fields: [schema_1.tasks.agentId],
        references: [schema_1.agents.id],
    }),
}));
exports.agentPropertiesRelations = (0, drizzle_orm_1.relations)(schema_1.agentProperties, ({ one }) => ({
    agent: one(schema_1.agents, {
        fields: [schema_1.agentProperties.agentId],
        references: [schema_1.agents.id],
    }),
    property: one(schema_1.properties, {
        fields: [schema_1.agentProperties.propertyId],
        references: [schema_1.properties.id],
    }),
}));
exports.landlordRegistrationCodesRelations = (0, drizzle_orm_1.relations)(schema_1.landlordRegistrationCodes, ({ many }) => ({
    landlords: many(schema_1.landlords),
}));
exports.agentRegistrationCodesRelations = (0, drizzle_orm_1.relations)(schema_1.agentRegistrationCodes, ({ many }) => ({
    agents: many(schema_1.agents),
}));
exports.withdrawalsRelations = (0, drizzle_orm_1.relations)(schema_1.withdrawals, ({ one }) => ({
    landlord: one(schema_1.landlords, {
        fields: [schema_1.withdrawals.landlordCognitoId],
        references: [schema_1.landlords.cognitoId],
    }),
}));
exports.jobsRelations = (0, drizzle_orm_1.relations)(schema_1.jobs, ({ many }) => ({
    applications: many(schema_1.jobApplications),
}));
exports.jobApplicationsRelations = (0, drizzle_orm_1.relations)(schema_1.jobApplications, ({ one, many }) => ({
    job: one(schema_1.jobs, {
        fields: [schema_1.jobApplications.jobId],
        references: [schema_1.jobs.id],
    }),
    ratings: many(schema_1.jobApplicationRatings),
}));
exports.jobApplicationRatingsRelations = (0, drizzle_orm_1.relations)(schema_1.jobApplicationRatings, ({ one }) => ({
    jobApplication: one(schema_1.jobApplications, {
        fields: [schema_1.jobApplicationRatings.jobApplicationId],
        references: [schema_1.jobApplications.id],
    }),
}));
exports.tenantFavoritesRelations = (0, drizzle_orm_1.relations)(schema_1.tenantFavorites, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.tenantFavorites.tenantId],
        references: [schema_1.tenants.id],
    }),
    property: one(schema_1.properties, {
        fields: [schema_1.tenantFavorites.propertyId],
        references: [schema_1.properties.id],
    }),
}));
exports.tenantPropertiesRelations = (0, drizzle_orm_1.relations)(schema_1.tenantProperties, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.tenantProperties.tenantId],
        references: [schema_1.tenants.id],
    }),
    property: one(schema_1.properties, {
        fields: [schema_1.tenantProperties.propertyId],
        references: [schema_1.properties.id],
    }),
}));
