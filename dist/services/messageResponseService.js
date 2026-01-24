"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageResponseService = exports.NotificationType = void 0;
const index_1 = require("../db/index");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../db/schema");
const smsNotificationService_1 = require("./smsNotificationService");
const renewalInteractionService_1 = require("./renewalInteractionService");
const notificationService_1 = require("./notificationService");
var NotificationType;
(function (NotificationType) {
    NotificationType["RENT_PAYMENT"] = "rent_payment";
    NotificationType["RENEWAL_RESPONSE"] = "renewal_response";
    NotificationType["INVALID_RESPONSE"] = "invalid_response";
    NotificationType["UNMATCHED_RESPONSE"] = "unmatched_response";
    NotificationType["SYSTEM_ERROR"] = "system_error";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
class MessageResponseService {
    constructor() {
        this.smsService = new smsNotificationService_1.SMSNotificationService();
        this.renewalService = new renewalInteractionService_1.RenewalInteractionService();
        this.notificationService = new notificationService_1.NotificationService();
    }
    async getAdminUsers() {
        try {
            const adminUsers = await index_1.db.select({
                cognitoId: schema_1.admins.cognitoId
            }).from(schema_1.admins);
            return adminUsers.map(admin => admin.cognitoId);
        }
        catch (error) {
            console.error('Error fetching admin users:', error);
            return [];
        }
    }
    async routeNotification(notificationType, notificationData, landlordId) {
        try {
            if (notificationType === NotificationType.RENT_PAYMENT ||
                notificationType === NotificationType.RENEWAL_RESPONSE) {
                if (landlordId) {
                    await this.notificationService.createNotification({
                        title: notificationData.title,
                        message: notificationData.message,
                        type: notificationService_1.NotificationType.PaymentReminder,
                        priority: notificationService_1.NotificationPriority.High,
                        recipientId: landlordId,
                        recipientType: 'landlord',
                        relatedId: notificationData.relatedId,
                        relatedType: notificationData.relatedType,
                        metadata: notificationData.metadata
                    });
                    console.log(`Notification routed to landlord: ${landlordId}`);
                }
                else {
                    console.warn('Landlord ID not provided for rent payment notification, routing to admin');
                    await this.routeToAdmin(notificationData);
                }
            }
            else {
                await this.routeToAdmin(notificationData);
            }
        }
        catch (error) {
            console.error('Error routing notification:', error);
        }
    }
    async routeToAdmin(notificationData) {
        try {
            const adminUsers = await this.getAdminUsers();
            const notificationPromises = adminUsers.map(adminId => this.notificationService.createNotification({
                title: notificationData.title,
                message: notificationData.message,
                type: notificationService_1.NotificationType.SystemAlert,
                priority: notificationService_1.NotificationPriority.Medium,
                recipientId: adminId,
                recipientType: 'admin',
                relatedId: notificationData.relatedId,
                relatedType: notificationData.relatedType,
                metadata: notificationData.metadata
            }));
            await Promise.all(notificationPromises);
            console.log(`Notification routed to ${adminUsers.length} admin users`);
        }
        catch (error) {
            console.error('Error routing to admin:', error);
        }
    }
    async processIncomingResponse(incomingMessage) {
        try {
            const { from: phoneNumber, message: responseText, timestamp = new Date() } = incomingMessage;
            const normalizedResponse = this.normalizeResponse(responseText);
            const pendingRequest = await this.findPendingRenewalRequest(phoneNumber);
            if (!pendingRequest) {
                await this.logUnmatchedResponse(phoneNumber, responseText, timestamp);
                await this.routeNotification(NotificationType.UNMATCHED_RESPONSE, {
                    title: 'Unmatched SMS Response',
                    message: `Received SMS response from ${phoneNumber} with no pending renewal request: "${responseText}"`,
                    metadata: { phoneNumber, responseText, timestamp },
                    relatedType: 'sms_response'
                });
                return {
                    success: true,
                    action: 'no_pending_request',
                    message: 'No pending renewal request found for this number'
                };
            }
            if (!this.isValidResponse(normalizedResponse)) {
                await this.logInvalidResponse(pendingRequest.messageId, phoneNumber, responseText, timestamp);
                await this.sendClarificationMessage(phoneNumber, pendingRequest.tenantName);
                await this.routeNotification(NotificationType.INVALID_RESPONSE, {
                    title: 'Invalid SMS Response',
                    message: `Invalid response received from ${pendingRequest.tenantName} (${phoneNumber}): "${responseText}"`,
                    metadata: {
                        phoneNumber,
                        responseText,
                        tenantName: pendingRequest.tenantName,
                        propertyAddress: pendingRequest.propertyAddress,
                        timestamp
                    },
                    relatedId: pendingRequest.renewalRequestId,
                    relatedType: 'renewal_request'
                });
                return {
                    success: true,
                    action: 'invalid_response',
                    message: 'Invalid response received, clarification sent'
                };
            }
            const [savedResponse] = await index_1.db.insert(schema_1.messageResponses).values({
                messageId: pendingRequest.messageId,
                responseText: normalizedResponse,
                responsePhone: phoneNumber,
                status: 'Received',
                isValid: true,
                createdAt: timestamp
            }).returning();
            const processingResult = await this.processRenewalResponse(pendingRequest.renewalRequestId, normalizedResponse, savedResponse.id, pendingRequest);
            await index_1.db.update(schema_1.messageResponses)
                .set({
                status: 'Processed',
                processedAt: new Date(),
                processingResult
            })
                .where((0, drizzle_orm_1.eq)(schema_1.messageResponses.id, savedResponse.id));
            await this.logResponseAction(savedResponse.id, 'processed', {
                renewalRequestId: pendingRequest.renewalRequestId,
                response: normalizedResponse,
                result: processingResult
            });
            return {
                success: true,
                action: normalizedResponse === 'YES' ? 'renewal_accepted' : 'renewal_declined',
                message: processingResult.message,
                renewalRequestId: pendingRequest.renewalRequestId
            };
        }
        catch (error) {
            console.error('Error processing incoming response:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async findPendingRenewalRequest(phoneNumber) {
        try {
            const result = await index_1.db
                .select({
                messageId: schema_1.smsMessages.id,
                renewalRequestId: schema_1.renewalRequests.id,
                tenantName: schema_1.tenants.name,
                propertyAddress: schema_1.properties.name,
                expiresAt: schema_1.renewalRequests.expiresAt
            })
                .from(schema_1.smsMessages)
                .innerJoin(schema_1.renewalRequests, (0, drizzle_orm_1.eq)(schema_1.smsMessages.id, schema_1.renewalRequests.messageId))
                .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.renewalRequests.tenantId, schema_1.tenants.id))
                .innerJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.renewalRequests.propertyId, schema_1.properties.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.smsMessages.recipientPhone, phoneNumber), (0, drizzle_orm_1.eq)(schema_1.smsMessages.category, 'RenewalRequest'), (0, drizzle_orm_1.eq)(schema_1.renewalRequests.status, 'Pending'), (0, drizzle_orm_1.isNull)(schema_1.renewalRequests.responseId)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.smsMessages.createdAt))
                .limit(1);
            if (result.length === 0) {
                return null;
            }
            const request = result[0];
            if (new Date() > request.expiresAt) {
                await index_1.db.update(schema_1.renewalRequests)
                    .set({ status: 'Expired' })
                    .where((0, drizzle_orm_1.eq)(schema_1.renewalRequests.id, request.renewalRequestId));
                return null;
            }
            return request;
        }
        catch (error) {
            console.error('Error finding pending renewal request:', error);
            return null;
        }
    }
    async processRenewalResponse(renewalRequestId, response, responseId, pendingRequest) {
        try {
            await this.renewalService.processRenewalResponse(renewalRequestId.toString(), response, '', '');
            const action = response === 'YES' ? 'lease_renewal_accepted' : 'lease_renewal_declined';
            const message = response === 'YES'
                ? 'Lease renewal accepted successfully'
                : 'Lease renewal declined';
            await this.routeNotification(NotificationType.RENEWAL_RESPONSE, {
                title: `Lease Renewal ${response === 'YES' ? 'Accepted' : 'Declined'}`,
                message: `${pendingRequest.tenantName} has ${response === 'YES' ? 'accepted' : 'declined'} the lease renewal for ${pendingRequest.propertyAddress}`,
                metadata: {
                    tenantName: pendingRequest.tenantName,
                    propertyAddress: pendingRequest.propertyAddress,
                    response,
                    responseId
                },
                relatedId: renewalRequestId,
                relatedType: 'renewal_request'
            }, pendingRequest.landlordId);
            return { success: true, message, action };
        }
        catch (error) {
            console.error('Error processing renewal response:', error);
            await this.routeNotification(NotificationType.SYSTEM_ERROR, {
                title: 'Renewal Response Processing Error',
                message: `Failed to process renewal response for request ${renewalRequestId}: ${error}`,
                metadata: { renewalRequestId, response, error: String(error) },
                relatedId: renewalRequestId,
                relatedType: 'renewal_request'
            });
            return {
                success: false,
                message: 'Failed to process response',
                action: 'processing_failed'
            };
        }
    }
    async sendResponseConfirmation(tenantPhone, tenantName, response, propertyAddress) {
        try {
            const message = response === 'YES'
                ? `Dear ${tenantName}, thank you for accepting the lease renewal for ${propertyAddress}. Your landlord will contact you with next steps. - HomeMatch`
                : `Dear ${tenantName}, we've received your decision to decline the lease renewal for ${propertyAddress}. Your landlord has been notified. - HomeMatch`;
            await this.smsService.sendSMS(tenantPhone, message);
        }
        catch (error) {
            console.error('Error sending response confirmation:', error);
        }
    }
    async notifyLandlordOfResponse(landlordPhone, landlordName, tenantName, propertyAddress, response) {
        try {
            const message = response === 'YES'
                ? `Dear ${landlordName}, ${tenantName} has ACCEPTED the lease renewal for ${propertyAddress}. Please proceed with renewal documentation. - HomeMatch`
                : `Dear ${landlordName}, ${tenantName} has DECLINED the lease renewal for ${propertyAddress}. You may need to find a new tenant. - HomeMatch`;
            await this.smsService.sendSMS(landlordPhone, message);
        }
        catch (error) {
            console.error('Error notifying landlord:', error);
        }
    }
    async sendClarificationMessage(phoneNumber, tenantName) {
        try {
            const message = `Dear ${tenantName}, we didn't understand your response. Please reply with "YES" to accept the lease renewal or "NO" to decline. - HomeMatch`;
            await this.smsService.sendSMS(phoneNumber, message);
        }
        catch (error) {
            console.error('Error sending clarification message:', error);
        }
    }
    normalizeResponse(responseText) {
        const cleaned = responseText.trim().toUpperCase();
        if (['YES', 'Y', 'ACCEPT', 'OK', 'OKAY', 'AGREE', '1'].includes(cleaned)) {
            return 'YES';
        }
        if (['NO', 'N', 'DECLINE', 'REJECT', 'DISAGREE', '0'].includes(cleaned)) {
            return 'NO';
        }
        return cleaned;
    }
    isValidResponse(response) {
        return ['YES', 'NO'].includes(response);
    }
    async logUnmatchedResponse(phoneNumber, responseText, timestamp) {
        try {
            await index_1.db.insert(schema_1.messageResponses).values({
                messageId: 0,
                responseText,
                responsePhone: phoneNumber,
                status: 'Received',
                isValid: false,
                createdAt: timestamp,
                errorMessage: 'No pending renewal request found'
            });
        }
        catch (error) {
            console.error('Error logging unmatched response:', error);
        }
    }
    async logInvalidResponse(messageId, phoneNumber, responseText, timestamp) {
        try {
            await index_1.db.insert(schema_1.messageResponses).values({
                messageId,
                responseText,
                responsePhone: phoneNumber,
                status: 'Received',
                isValid: false,
                createdAt: timestamp,
                errorMessage: 'Invalid response format'
            });
        }
        catch (error) {
            console.error('Error logging invalid response:', error);
        }
    }
    async logResponseAction(responseId, action, details, performedBy = 'system') {
        try {
            await index_1.db.insert(schema_1.messageAuditLog).values({
                responseId,
                action,
                details,
                performedBy,
                createdAt: new Date()
            });
        }
        catch (error) {
            console.error('Error logging response action:', error);
        }
    }
    async getResponseStats(dateFrom, dateTo) {
        try {
            return {
                totalResponses: 0,
                validResponses: 0,
                acceptedRenewals: 0,
                declinedRenewals: 0,
                invalidResponses: 0
            };
        }
        catch (error) {
            console.error('Error getting response stats:', error);
            return null;
        }
    }
    async cleanupExpiredRequests() {
        try {
            const result = await index_1.db.update(schema_1.renewalRequests)
                .set({ status: 'Expired' })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.renewalRequests.status, 'Pending')));
            return { expired: 0 };
        }
        catch (error) {
            console.error('Error cleaning up expired requests:', error);
            return { expired: 0 };
        }
    }
}
exports.MessageResponseService = MessageResponseService;
