"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSNotificationService = void 0;
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const termiiService_1 = require("./termiiService");
const drizzle_orm_1 = require("drizzle-orm");
const date_fns_1 = require("date-fns");
class SMSNotificationService {
    constructor() {
        this.termiiService = new termiiService_1.TermiiService({
            apiKey: process.env.TERMII_API_KEY,
            senderId: process.env.TERMII_SENDER_ID || 'HomeMatch',
            baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com'
        });
    }
    async sendRentReminder(tenantId, tenantPhone, data, daysBeforeDue = 7) {
        try {
            const message = this.formatRentReminderMessage(data, daysBeforeDue);
            const termiiResponse = await this.termiiService.sendSMS({
                to: tenantPhone,
                message,
                channel: 'generic'
            });
            const [savedMessage] = await index_1.db.insert(schema_1.smsMessages).values({
                messageId: termiiResponse.message_id,
                recipientPhone: tenantPhone,
                recipientId: tenantId,
                recipientType: 'tenant',
                messageType: 'SMS',
                category: 'RentReminder',
                content: message,
                status: 'Sent',
                termiiResponse: termiiResponse,
                metadata: {
                    daysBeforeDue,
                    rentAmount: data.rentAmount,
                    dueDate: data.dueDate.toISOString(),
                    propertyAddress: data.propertyAddress
                }
            }).returning();
            await this.logMessageAction(savedMessage.id, 'sent', {
                termiiMessageId: termiiResponse.message_id,
                daysBeforeDue
            });
            return { success: true, messageId: savedMessage.id };
        }
        catch (error) {
            console.error('Error sending rent reminder:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async sendPaymentConfirmation(tenantId, tenantPhone, data, paymentId) {
        try {
            const message = this.formatPaymentConfirmationMessage(data);
            const termiiResponse = await this.termiiService.sendSMS({
                to: tenantPhone,
                message: message,
                channel: 'generic'
            });
            const [savedMessage] = await index_1.db.insert(schema_1.smsMessages).values({
                messageId: termiiResponse.message_id,
                recipientPhone: tenantPhone,
                recipientId: tenantId,
                recipientType: 'tenant',
                messageType: 'SMS',
                category: 'PaymentConfirmation',
                content: message,
                status: 'Sent',
                termiiResponse: termiiResponse,
                relatedId: paymentId,
                relatedType: 'payment',
                metadata: {
                    amountPaid: data.amountPaid,
                    paymentDate: data.paymentDate.toISOString(),
                    remainingBalance: data.remainingBalance,
                    propertyAddress: data.propertyAddress
                }
            }).returning();
            await this.logMessageAction(savedMessage.id, 'sent', {
                termiiMessageId: termiiResponse.message_id,
                paymentId
            });
            return { success: true, messageId: savedMessage.id };
        }
        catch (error) {
            console.error('Error sending payment confirmation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async sendLandlordPaymentAlert(landlordId, landlordPhone, data, paymentId) {
        try {
            if (!landlordPhone) {
                return { success: false, error: 'No phone number provided for landlord' };
            }
            const message = this.formatLandlordAlertMessage(data);
            const termiiResponse = await this.termiiService.sendSMS({
                to: landlordPhone,
                message: message,
                channel: 'generic'
            });
            const [savedMessage] = await index_1.db.insert(schema_1.smsMessages).values({
                messageId: termiiResponse.message_id,
                recipientPhone: landlordPhone,
                recipientId: landlordId,
                recipientType: 'landlord',
                messageType: 'SMS',
                category: 'LandlordAlert',
                content: message,
                status: 'Sent',
                termiiResponse: termiiResponse,
                relatedId: paymentId,
                relatedType: 'payment',
                metadata: {
                    tenantName: data.tenantName,
                    amountPaid: data.amountPaid,
                    paymentDate: data.paymentDate.toISOString(),
                    propertyAddress: data.propertyAddress,
                    totalRent: data.totalRent
                }
            }).returning();
            await this.logMessageAction(savedMessage.id, 'sent', {
                termiiMessageId: termiiResponse.message_id,
                paymentId
            });
            return { success: true, messageId: savedMessage.id };
        }
        catch (error) {
            console.error('Error sending landlord alert:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async sendRenewalRequest(tenantId, tenantPhone, data, leaseId, expiresInDays = 7) {
        try {
            const message = this.formatRenewalRequestMessage(data, expiresInDays);
            const termiiResponse = await this.termiiService.sendSMS({
                to: tenantPhone,
                message: message,
                channel: 'generic'
            });
            const [savedMessage] = await index_1.db.insert(schema_1.smsMessages).values({
                messageId: termiiResponse.message_id,
                recipientPhone: tenantPhone,
                recipientId: tenantId,
                recipientType: 'tenant',
                messageType: 'SMS',
                category: 'RenewalRequest',
                content: message,
                status: 'Sent',
                termiiResponse: termiiResponse,
                relatedId: leaseId,
                relatedType: 'lease',
                metadata: {
                    currentLeaseEnd: data.currentLeaseEnd.toISOString(),
                    newRentAmount: data.newRentAmount,
                    expiresInDays,
                    propertyAddress: data.propertyAddress
                }
            }).returning();
            const [renewalRequest] = await index_1.db.insert(schema_1.renewalRequests).values({
                leaseId,
                tenantId: parseInt(tenantId),
                landlordId: 1,
                propertyId: 1,
                messageId: savedMessage.id,
                expiresAt: (0, date_fns_1.addDays)(new Date(), expiresInDays),
                status: 'Pending'
            }).returning();
            await this.logMessageAction(savedMessage.id, 'sent', {
                termiiMessageId: termiiResponse.message_id,
                renewalRequestId: renewalRequest.id,
                expiresInDays
            });
            return {
                success: true,
                messageId: savedMessage.id,
                renewalRequestId: renewalRequest.id
            };
        }
        catch (error) {
            console.error('Error sending renewal request:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async sendOverdueRentReminders() {
        let sent = 0;
        let failed = 0;
        try {
            const overduePayments = await index_1.db
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
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, 'Overdue'), (0, drizzle_orm_1.lte)(schema_1.payments.dueDate, new Date())));
            for (const record of overduePayments) {
                const reminderData = {
                    tenantName: record.tenant.name,
                    propertyAddress: record.tenant.houseAddress || 'Your rental property',
                    rentAmount: record.payment.amountDue,
                    dueDate: record.payment.dueDate,
                    landlordName: record.landlord.name,
                    landlordPhone: record.landlord.phoneNumber
                };
                const result = await this.sendRentReminder(record.tenant.userId, record.tenant.phoneNumber || '', reminderData, 0);
                if (result.success) {
                    sent++;
                }
                else {
                    failed++;
                    console.error(`Failed to send overdue reminder to ${record.tenant.phoneNumber}:`, result.error);
                }
            }
        }
        catch (error) {
            console.error('Error sending overdue rent reminders:', error);
        }
        return { sent, failed };
    }
    formatRentReminderMessage(data, daysBeforeDue) {
        const formattedAmount = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(data.rentAmount);
        const formattedDate = (0, date_fns_1.format)(data.dueDate, 'MMM dd, yyyy');
        if (daysBeforeDue === 0) {
            return `Dear ${data.tenantName}, your rent of ${formattedAmount} for ${data.propertyAddress} is now OVERDUE (due: ${formattedDate}). Please make payment immediately to avoid penalties. Contact ${data.landlordName} at ${data.landlordPhone} for assistance. - HomeMatch`;
        }
        else if (daysBeforeDue === 1) {
            return `Dear ${data.tenantName}, your rent of ${formattedAmount} for ${data.propertyAddress} is due TOMORROW (${formattedDate}). Please ensure timely payment. Contact ${data.landlordName} at ${data.landlordPhone} if needed. - HomeMatch`;
        }
        else {
            return `Dear ${data.tenantName}, your rent of ${formattedAmount} for ${data.propertyAddress} is due in ${daysBeforeDue} days (${formattedDate}). Please prepare for timely payment. Contact ${data.landlordName} at ${data.landlordPhone} if needed. - HomeMatch`;
        }
    }
    formatPaymentConfirmationMessage(data) {
        const formattedAmount = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(data.amountPaid);
        const formattedDate = (0, date_fns_1.format)(data.paymentDate, 'MMM dd, yyyy');
        let message = `Dear ${data.tenantName}, we confirm receipt of your rent payment of ${formattedAmount} for ${data.propertyAddress} on ${formattedDate}.`;
        if (data.remainingBalance && data.remainingBalance > 0) {
            const formattedBalance = new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN'
            }).format(data.remainingBalance);
            message += ` Remaining balance: ${formattedBalance}.`;
        }
        else {
            message += ' Your rent is now fully paid.';
        }
        message += ' Thank you for your prompt payment. - HomeMatch';
        return message;
    }
    formatLandlordAlertMessage(data) {
        const formattedAmount = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(data.amountPaid);
        const formattedTotal = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(data.totalRent);
        const formattedDate = (0, date_fns_1.format)(data.paymentDate, 'MMM dd, yyyy');
        return `Dear ${data.landlordName}, ${data.tenantName} has made a rent payment of ${formattedAmount} (Total: ${formattedTotal}) for ${data.propertyAddress} on ${formattedDate}. Payment processed successfully. - HomeMatch`;
    }
    formatRenewalRequestMessage(data, expiresInDays) {
        const formattedAmount = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(data.newRentAmount);
        const formattedDate = (0, date_fns_1.format)(data.currentLeaseEnd, 'MMM dd, yyyy');
        return `Dear ${data.tenantName}, your lease for ${data.propertyAddress} expires on ${formattedDate}. ${data.landlordName} offers renewal at ${formattedAmount}/year. Reply "YES" to accept or "NO" to decline within ${expiresInDays} days. - HomeMatch`;
    }
    async logMessageAction(messageId, action, details, performedBy = 'system') {
        try {
            await index_1.db.insert(schema_1.messageAuditLog).values({
                messageId,
                action,
                details,
                performedBy,
                createdAt: new Date()
            });
        }
        catch (error) {
            console.error('Error logging message action:', error);
        }
    }
    async sendSMS(to, message) {
        try {
            const termiiResponse = await this.termiiService.sendSMS({
                to,
                message,
                channel: 'generic'
            });
            const [messageRecord] = await index_1.db.insert(schema_1.smsMessages).values({
                messageId: termiiResponse.message_id,
                recipientPhone: to,
                recipientId: 'system',
                recipientType: 'general',
                messageType: 'SMS',
                category: 'General',
                content: message,
                status: 'Sent',
                termiiResponse: termiiResponse,
                createdAt: new Date()
            }).returning();
            return {
                success: true,
                messageId: messageRecord.id
            };
        }
        catch (error) {
            console.error('Error sending SMS:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async updateMessageStatus(messageId) {
        try {
            console.log(`Updating status for message: ${messageId}`);
        }
        catch (error) {
            console.error('Error updating message status:', error);
        }
    }
}
exports.SMSNotificationService = SMSNotificationService;
