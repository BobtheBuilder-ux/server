"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSController = void 0;
const smsNotificationService_1 = require("../services/smsNotificationService");
const messageResponseService_1 = require("../services/messageResponseService");
const renewalInteractionService_1 = require("../services/renewalInteractionService");
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const sendRentReminderSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    daysBeforeDue: zod_1.z.number().min(0).max(30).optional().default(7)
});
const sendPaymentConfirmationSchema = zod_1.z.object({
    paymentId: zod_1.z.number(),
    tenantId: zod_1.z.string()
});
const sendLandlordAlertSchema = zod_1.z.object({
    paymentId: zod_1.z.number(),
    landlordId: zod_1.z.string()
});
const sendRenewalRequestSchema = zod_1.z.object({
    leaseId: zod_1.z.number(),
    tenantId: zod_1.z.string(),
    expiresInDays: zod_1.z.number().min(1).max(30).optional().default(7)
});
const termiiWebhookSchema = zod_1.z.object({
    from: zod_1.z.string(),
    message: zod_1.z.string(),
    messageId: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().optional()
});
class SMSController {
    constructor() {
        this.sendRentReminder = async (req, res) => {
            try {
                const { tenantId, daysBeforeDue } = sendRentReminderSchema.parse(req.body);
                const tenantData = await index_1.db
                    .select({
                    tenant: schema_1.tenants,
                    lease: schema_1.leases,
                    property: schema_1.properties,
                    landlord: schema_1.landlords,
                    payment: schema_1.payments
                })
                    .from(schema_1.tenants)
                    .innerJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, schema_1.leases.tenantCognitoId))
                    .innerJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                    .innerJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .leftJoin(schema_1.payments, (0, drizzle_orm_1.eq)(schema_1.leases.id, schema_1.payments.leaseId))
                    .where((0, drizzle_orm_1.eq)(schema_1.tenants.userId, tenantId))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.leases.endDate))
                    .limit(1);
                if (tenantData.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Tenant or active lease not found'
                    });
                }
                const { tenant, lease, property, landlord, payment } = tenantData[0];
                if (!tenant.phoneNumber) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tenant phone number not available'
                    });
                }
                const dueDate = payment?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const reminderData = {
                    tenantName: tenant.name,
                    propertyAddress: tenant.houseAddress || property.name,
                    rentAmount: lease.rent,
                    dueDate,
                    landlordName: landlord.name,
                    landlordPhone: landlord.phoneNumber
                };
                const result = await this.smsService.sendRentReminder(tenantId, tenant.phoneNumber, reminderData, daysBeforeDue);
                if (result.success) {
                    res.json({
                        success: true,
                        messageId: result.messageId,
                        message: 'Rent reminder sent successfully'
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: result.error
                    });
                }
            }
            catch (error) {
                console.error('Error in sendRentReminder:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.sendPaymentConfirmation = async (req, res) => {
            try {
                const { paymentId, tenantId } = sendPaymentConfirmationSchema.parse(req.body);
                const paymentData = await index_1.db
                    .select({
                    payment: schema_1.payments,
                    lease: schema_1.leases,
                    tenant: schema_1.tenants,
                    property: schema_1.properties
                })
                    .from(schema_1.payments)
                    .innerJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
                    .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                    .innerJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId), (0, drizzle_orm_1.eq)(schema_1.tenants.userId, tenantId)));
                if (paymentData.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Payment or tenant not found'
                    });
                }
                const { payment, tenant, property } = paymentData[0];
                if (!tenant.phoneNumber) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tenant phone number not available'
                    });
                }
                const confirmationData = {
                    tenantName: tenant.name,
                    propertyAddress: tenant.houseAddress || property.name,
                    amountPaid: payment.amountPaid,
                    paymentDate: payment.paymentDate,
                    remainingBalance: Math.max(0, payment.amountDue - payment.amountPaid)
                };
                const result = await this.smsService.sendPaymentConfirmation(tenantId, tenant.phoneNumber, confirmationData, paymentId);
                if (result.success) {
                    res.json({
                        success: true,
                        messageId: result.messageId,
                        message: 'Payment confirmation sent successfully'
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: result.error
                    });
                }
            }
            catch (error) {
                console.error('Error in sendPaymentConfirmation:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.sendLandlordAlert = async (req, res) => {
            try {
                const { paymentId, landlordId } = sendLandlordAlertSchema.parse(req.body);
                const paymentData = await index_1.db
                    .select({
                    payment: schema_1.payments,
                    lease: schema_1.leases,
                    tenant: schema_1.tenants,
                    property: schema_1.properties,
                    landlord: schema_1.landlords
                })
                    .from(schema_1.payments)
                    .innerJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
                    .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                    .innerJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                    .innerJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId), (0, drizzle_orm_1.eq)(schema_1.landlords.userId, landlordId)));
                if (paymentData.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Payment or landlord not found'
                    });
                }
                const { payment, tenant, property, landlord } = paymentData[0];
                if (!landlord.phoneNumber) {
                    return res.status(400).json({
                        success: false,
                        error: 'Landlord phone number not available'
                    });
                }
                const alertData = {
                    landlordName: landlord.name,
                    tenantName: tenant.name,
                    propertyAddress: tenant.houseAddress || property.name,
                    amountPaid: payment.amountPaid,
                    paymentDate: payment.paymentDate,
                    totalRent: payment.amountDue
                };
                const result = await this.smsService.sendLandlordPaymentAlert(landlordId, landlord.phoneNumber, alertData, paymentId);
                if (result.success) {
                    res.json({
                        success: true,
                        messageId: result.messageId,
                        message: 'Landlord alert sent successfully'
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: result.error
                    });
                }
            }
            catch (error) {
                console.error('Error in sendLandlordAlert:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.sendRenewalRequest = async (req, res) => {
            try {
                const { leaseId, tenantId, expiresInDays } = sendRenewalRequestSchema.parse(req.body);
                const leaseData = await index_1.db
                    .select({
                    lease: schema_1.leases,
                    tenant: schema_1.tenants,
                    property: schema_1.properties,
                    landlord: schema_1.landlords,
                    location: schema_1.locations
                })
                    .from(schema_1.leases)
                    .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                    .innerJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                    .innerJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.leases.id, leaseId), (0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, tenantId)));
                if (leaseData.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Lease or tenant not found'
                    });
                }
                const { lease, tenant, property, landlord, location } = leaseData[0];
                if (!tenant.phoneNumber) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tenant phone number not available'
                    });
                }
                const renewalData = {
                    leaseId: lease.id.toString(),
                    tenantId: tenant.cognitoId,
                    landlordId: landlord.cognitoId,
                    propertyName: property.name,
                    propertyAddress: location?.address || 'Address not available',
                    currentRent: lease.rent,
                    leaseEndDate: lease.endDate,
                    renewalTerms: 'Standard renewal terms apply',
                    newRentAmount: lease.rent
                };
                const renewalRequestId = await this.renewalService.initiateRenewalRequest(renewalData);
                res.json({
                    success: true,
                    renewalRequestId,
                    message: 'Renewal request sent successfully',
                    expiresInDays
                });
            }
            catch (error) {
                console.error('Error in sendRenewalRequest:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.handleWebhook = async (req, res) => {
            try {
                const webhookData = termiiWebhookSchema.parse(req.body);
                const incomingMessage = {
                    from: webhookData.from,
                    message: webhookData.message,
                    messageId: webhookData.messageId,
                    timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date()
                };
                const result = await this.responseService.processIncomingResponse(incomingMessage);
                if (result.success) {
                    res.json({
                        success: true,
                        action: result.action,
                        message: result.message
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: result.error
                    });
                }
            }
            catch (error) {
                console.error('Error in handleWebhook:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.getMessageHistory = async (req, res) => {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 20, category } = req.query;
                const offset = (Number(page) - 1) * Number(limit);
                let whereCondition;
                if (category) {
                    whereCondition = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.smsMessages.recipientId, userId), (0, drizzle_orm_1.eq)(schema_1.smsMessages.category, category));
                }
                else {
                    whereCondition = (0, drizzle_orm_1.eq)(schema_1.smsMessages.recipientId, userId);
                }
                const messages = await index_1.db
                    .select({
                    id: schema_1.smsMessages.id,
                    content: schema_1.smsMessages.content,
                    recipientId: schema_1.smsMessages.recipientId,
                    recipientType: schema_1.smsMessages.recipientType,
                    category: schema_1.smsMessages.category,
                    createdAt: schema_1.smsMessages.createdAt
                })
                    .from(schema_1.smsMessages)
                    .where(whereCondition)
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.smsMessages.createdAt))
                    .limit(Number(limit))
                    .offset(offset);
                res.json({
                    success: true,
                    data: messages,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: messages.length
                    }
                });
            }
            catch (error) {
                console.error('Error in getMessageHistory:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.getResponseHistory = async (req, res) => {
            try {
                const { phoneNumber } = req.params;
                const { page = 1, limit = 20 } = req.query;
                const offset = (Number(page) - 1) * Number(limit);
                const responses = await index_1.db
                    .select({
                    id: schema_1.messageResponses.id,
                    responseText: schema_1.messageResponses.responseText,
                    status: schema_1.messageResponses.status,
                    isValid: schema_1.messageResponses.isValid,
                    createdAt: schema_1.messageResponses.createdAt,
                    processedAt: schema_1.messageResponses.processedAt,
                    errorMessage: schema_1.messageResponses.errorMessage
                })
                    .from(schema_1.messageResponses)
                    .where((0, drizzle_orm_1.eq)(schema_1.messageResponses.responsePhone, phoneNumber))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.messageResponses.createdAt))
                    .limit(Number(limit))
                    .offset(offset);
                res.json({
                    success: true,
                    data: responses,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: responses.length
                    }
                });
            }
            catch (error) {
                console.error('Error in getResponseHistory:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.sendOverdueReminders = async (req, res) => {
            try {
                const result = await this.smsService.sendOverdueRentReminders();
                res.json({
                    success: true,
                    message: `Sent ${result.sent} reminders, ${result.failed} failed`,
                    data: result
                });
            }
            catch (error) {
                console.error('Error in sendOverdueReminders:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.getStats = async (req, res) => {
            try {
                const { dateFrom, dateTo } = req.query;
                const stats = {
                    totalMessages: 0,
                    sentMessages: 0,
                    deliveredMessages: 0,
                    failedMessages: 0,
                    totalResponses: 0,
                    validResponses: 0,
                    renewalAccepted: 0,
                    renewalDeclined: 0
                };
                res.json({
                    success: true,
                    data: stats
                });
            }
            catch (error) {
                console.error('Error in getStats:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                });
            }
        };
        this.smsService = new smsNotificationService_1.SMSNotificationService();
        this.responseService = new messageResponseService_1.MessageResponseService();
        this.renewalService = new renewalInteractionService_1.RenewalInteractionService();
    }
}
exports.SMSController = SMSController;
