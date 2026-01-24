"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenewalInteractionService = void 0;
const database_1 = require("../utils/database");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../db/schema");
const smsNotificationService_1 = require("./smsNotificationService");
const landlordNotificationService_1 = require("./landlordNotificationService");
class RenewalInteractionService {
    constructor() {
        this.smsService = new smsNotificationService_1.SMSNotificationService();
        this.landlordService = new landlordNotificationService_1.LandlordNotificationService();
    }
    async initiateRenewalRequest(interactionData) {
        try {
            const lease = await database_1.db.select()
                .from(schema_1.leases)
                .where((0, drizzle_orm_1.eq)(schema_1.leases.id, parseInt(interactionData.leaseId)))
                .limit(1);
            if (!lease || lease.length === 0) {
                throw new Error(`Lease not found with ID: ${interactionData.leaseId}`);
            }
            const leaseData = lease[0];
            const renewalRequest = await database_1.db.insert(schema_1.renewalRequests).values({
                leaseId: parseInt(interactionData.leaseId),
                tenantId: parseInt(interactionData.tenantId),
                landlordId: parseInt(interactionData.landlordId),
                propertyId: leaseData.propertyId,
                status: 'Pending',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }).returning({ id: schema_1.renewalRequests.id });
            const renewalRequestId = renewalRequest[0].id;
            const tenantResult = await database_1.db
                .select()
                .from(schema_1.tenants)
                .where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, interactionData.tenantId))
                .limit(1);
            if (!tenantResult.length) {
                throw new Error(`Tenant not found: ${interactionData.tenantId}`);
            }
            const tenant = tenantResult[0];
            const renewalMessage = this.formatRenewalRequestMessage(interactionData, renewalRequestId.toString());
            const smsResult = await this.smsService.sendSMS(tenant.phoneNumber, renewalMessage);
            await database_1.db.insert(schema_1.smsMessages).values({
                messageId: smsResult.messageId?.toString(),
                recipientPhone: tenant.phoneNumber,
                recipientId: interactionData.tenantId,
                recipientType: 'tenant',
                messageType: 'SMS',
                category: 'RenewalRequest',
                content: renewalMessage,
                status: smsResult.success ? 'Sent' : 'Failed',
                termiiResponse: smsResult,
                relatedId: parseInt(interactionData.leaseId),
                relatedType: 'lease',
                createdAt: new Date()
            });
            console.log(`Renewal request initiated for lease ${interactionData.leaseId}, request ID: ${renewalRequestId}`);
            return renewalRequestId.toString();
        }
        catch (error) {
            console.error('Error initiating renewal request:', error);
            throw error;
        }
    }
    async processRenewalResponse(renewalRequestId, response, tenantPhone, additionalNotes) {
        try {
            const renewalResult = await database_1.db
                .select({
                renewal: schema_1.renewalRequests,
                lease: schema_1.leases,
                property: schema_1.properties,
                tenant: schema_1.tenants,
                landlord: schema_1.landlords,
                location: schema_1.locations
            })
                .from(schema_1.renewalRequests)
                .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.renewalRequests.leaseId, schema_1.leases.id))
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .where((0, drizzle_orm_1.eq)(schema_1.renewalRequests.id, parseInt(renewalRequestId)))
                .limit(1);
            if (!renewalResult.length) {
                throw new Error(`Renewal request not found: ${renewalRequestId}`);
            }
            const { renewal, lease, property, tenant, landlord, location } = renewalResult[0];
            if (!renewal || !lease || !property || !tenant || !landlord) {
                throw new Error('Incomplete renewal request data');
            }
            await database_1.db
                .update(schema_1.renewalRequests)
                .set({
                status: response === 'YES' ? 'Accepted' : 'Declined',
                responseReceivedAt: new Date(),
                tenantResponse: response
            })
                .where((0, drizzle_orm_1.eq)(schema_1.renewalRequests.id, parseInt(renewalRequestId)));
            await database_1.db.insert(schema_1.messageResponses).values({
                messageId: 0,
                responseText: response,
                responsePhone: tenantPhone,
                status: 'Processed',
                processedAt: new Date(),
                isValid: true
            });
            await this.sendTenantConfirmation(tenant, property, response, location?.address);
            await this.notifyLandlordOfResponse(landlord, tenant, property, response, location?.address);
            if (response === 'YES') {
                await this.initiateLeaseRenewal(lease.id.toString(), lease.rent);
            }
            console.log(`Processed renewal response: ${response} for request ${renewalRequestId}`);
        }
        catch (error) {
            console.error('Error processing renewal response:', error);
            throw error;
        }
    }
    async sendRenewalReminders() {
        try {
            const pendingRenewals = await database_1.db
                .select({
                renewal: schema_1.renewalRequests,
                lease: schema_1.leases,
                property: schema_1.properties,
                tenant: schema_1.tenants,
                location: schema_1.locations
            })
                .from(schema_1.renewalRequests)
                .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.renewalRequests.leaseId, schema_1.leases.id))
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.renewalRequests.status, 'Pending')));
            for (const renewal of pendingRenewals) {
                if (!renewal.tenant || !renewal.property)
                    continue;
                const daysUntilExpiry = Math.ceil((new Date(renewal.renewal.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry <= 2 && daysUntilExpiry > 0) {
                    const reminderMessage = `RENEWAL REMINDER\n\nDear ${renewal.tenant.name},\n\nYour lease renewal request for ${renewal.property.name} expires in ${daysUntilExpiry} day(s).\n\nPlease reply:\n• YES to renew\n• NO to decline\n\nHomematch`;
                    await this.smsService.sendSMS(renewal.tenant.phoneNumber, reminderMessage);
                }
            }
            console.log(`Sent renewal reminders for ${pendingRenewals.length} pending requests`);
        }
        catch (error) {
            console.error('Error sending renewal reminders:', error);
            throw error;
        }
    }
    formatRenewalRequestMessage(data, requestId) {
        const rentChange = data.newRentAmount && data.newRentAmount !== data.currentRent
            ? `\nNew Rent: ₦${data.newRentAmount.toLocaleString()}/year`
            : '';
        return `🏠 LEASE RENEWAL REQUEST\n\nDear Tenant,\n\nYour lease for ${data.propertyName} (${data.propertyAddress}) expires on ${data.leaseEndDate.toLocaleDateString()}.\n\nCurrent Rent: ₦${data.currentRent.toLocaleString()}/year${rentChange}\n\nWould you like to renew your lease?\n\nReply:\n• YES to renew\n• NO to decline\n\nRequest expires in 7 days.\n\nRef: ${requestId}\nHomematch`;
    }
    async sendTenantConfirmation(tenant, property, response, propertyAddress) {
        const message = response === 'YES'
            ? `✅ RENEWAL CONFIRMED\n\nDear ${tenant.name},\n\nThank you for confirming your lease renewal for ${property.name}.\n\nNext steps:\n• Landlord will contact you with renewal documents\n• New lease terms will be finalized\n• Payment schedule will be updated\n\nHomematch`
            : `❌ RENEWAL DECLINED\n\nDear ${tenant.name},\n\nWe've received your decision to decline the lease renewal for ${property.name}.\n\nPlease ensure you:\n• Plan your move-out by the lease end date\n• Schedule property inspection\n• Arrange deposit refund process\n\nThank you for being our tenant.\n\nHomematch`;
        await this.smsService.sendSMS(tenant.phoneNumber, message);
    }
    async notifyLandlordOfResponse(landlord, tenant, property, response, propertyAddress) {
        const updateData = {
            landlordId: landlord.cognitoId,
            propertyName: property.name,
            propertyAddress: propertyAddress || 'Address not available',
            updateType: 'lease_renewal',
            tenantName: tenant.name,
            details: response === 'YES'
                ? `${tenant.name} has ACCEPTED the lease renewal. Please prepare renewal documents.`
                : `${tenant.name} has DECLINED the lease renewal. Property will be available for new tenants.`
        };
        await this.landlordService.sendPropertyUpdate(updateData);
    }
    async initiateLeaseRenewal(leaseId, newRentAmount) {
        try {
            console.log(`Initiating lease renewal for lease ${leaseId} with rent ₦${newRentAmount}`);
        }
        catch (error) {
            console.error('Error initiating lease renewal:', error);
            throw error;
        }
    }
    async getRenewalStats() {
        try {
            const stats = await database_1.db
                .select({
                status: schema_1.renewalRequests.status
            })
                .from(schema_1.renewalRequests);
            const result = {
                pending: 0,
                accepted: 0,
                declined: 0,
                expired: 0
            };
            for (const stat of stats) {
                switch (stat.status) {
                    case 'Pending':
                        result.pending++;
                        break;
                    case 'Accepted':
                        result.accepted++;
                        break;
                    case 'Declined':
                        result.declined++;
                        break;
                    case 'Expired':
                        result.expired++;
                        break;
                }
            }
            return result;
        }
        catch (error) {
            console.error('Error getting renewal stats:', error);
            throw error;
        }
    }
}
exports.RenewalInteractionService = RenewalInteractionService;
