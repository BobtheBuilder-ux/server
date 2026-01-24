"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentNotificationService = void 0;
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const smsNotificationService_1 = require("./smsNotificationService");
const landlordNotificationService_1 = require("./landlordNotificationService");
class PaymentNotificationService {
    constructor() {
        this.smsService = new smsNotificationService_1.SMSNotificationService();
        this.landlordService = new landlordNotificationService_1.LandlordNotificationService();
    }
    async processPaymentNotifications(paymentId) {
        try {
            const paymentData = await this.getPaymentDetails(paymentId);
            if (!paymentData) {
                throw new Error('Payment not found');
            }
            const tenantResult = await this.sendTenantPaymentConfirmation(paymentData);
            await this.landlordService.sendPaymentAlert(paymentId.toString());
            const landlordResult = { success: true, messageId: 1 };
            console.log(`Payment notifications sent for payment ${paymentId}`);
            return {
                tenantNotification: tenantResult,
                landlordNotification: landlordResult
            };
        }
        catch (error) {
            console.error('Error processing payment notifications:', error);
            return {
                tenantNotification: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                landlordNotification: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
    async getPaymentDetails(paymentId) {
        const result = await index_1.db
            .select({
            payment: schema_1.payments,
            lease: schema_1.leases,
            tenant: schema_1.tenants,
            landlord: schema_1.landlords,
            property: schema_1.properties
        })
            .from(schema_1.payments)
            .innerJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
            .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
            .innerJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
            .innerJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId))
            .limit(1);
        if (result.length === 0) {
            return null;
        }
        const { payment, tenant, landlord, property } = result[0];
        return {
            paymentId: payment.id,
            tenantId: tenant.userId || '',
            landlordId: landlord.userId || '',
            amount: payment.amountPaid,
            paymentDate: payment.paymentDate,
            propertyAddress: tenant.houseAddress || property.name,
            tenantName: tenant.name,
            landlordName: landlord.name,
            tenantPhone: tenant.phoneNumber,
            landlordPhone: landlord.phoneNumber
        };
    }
    async sendTenantPaymentConfirmation(paymentData) {
        if (!paymentData.tenantPhone) {
            return { success: false, error: 'Tenant phone number not available' };
        }
        try {
            const remainingBalance = await this.calculateRemainingBalance(paymentData.paymentId);
            const confirmationData = {
                tenantName: paymentData.tenantName,
                propertyAddress: paymentData.propertyAddress,
                amountPaid: paymentData.amount,
                paymentDate: paymentData.paymentDate,
                remainingBalance
            };
            const result = await this.smsService.sendPaymentConfirmation(paymentData.tenantId, paymentData.tenantPhone, confirmationData, paymentData.paymentId);
            return result;
        }
        catch (error) {
            console.error('Error sending tenant payment confirmation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async sendLandlordPaymentAlert(paymentData) {
        if (!paymentData.landlordPhone) {
            return { success: false, error: 'Landlord phone number not available' };
        }
        try {
            const totalRent = await this.getTotalRentAmount(paymentData.paymentId);
            const alertData = {
                landlordName: paymentData.landlordName,
                tenantName: paymentData.tenantName,
                propertyAddress: paymentData.propertyAddress,
                amountPaid: paymentData.amount,
                paymentDate: paymentData.paymentDate,
                totalRent
            };
            const result = await this.smsService.sendLandlordPaymentAlert(paymentData.landlordId, paymentData.landlordPhone, alertData, paymentData.paymentId);
            return result;
        }
        catch (error) {
            console.error('Error sending landlord payment alert:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async calculateRemainingBalance(paymentId) {
        const payment = await index_1.db
            .select({
            amountPaid: schema_1.payments.amountPaid,
            amountDue: schema_1.payments.amountDue
        })
            .from(schema_1.payments)
            .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId))
            .limit(1);
        if (payment.length === 0) {
            return 0;
        }
        return Math.max(0, payment[0].amountDue - payment[0].amountPaid);
    }
    async getTotalRentAmount(paymentId) {
        const result = await index_1.db
            .select({
            amountDue: schema_1.payments.amountDue
        })
            .from(schema_1.payments)
            .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId))
            .limit(1);
        return result.length > 0 ? result[0].amountDue : 0;
    }
    async sendOverduePaymentReminders() {
        try {
            const overduePayments = await this.getOverduePayments();
            const results = [];
            let sent = 0;
            let failed = 0;
            for (const payment of overduePayments) {
                try {
                    const result = await this.sendOverdueReminderForPayment(payment);
                    results.push({ paymentId: payment.id, success: result.success, error: result.error });
                    if (result.success) {
                        sent++;
                    }
                    else {
                        failed++;
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({ paymentId: payment.id, success: false, error: errorMessage });
                    failed++;
                }
            }
            return { sent, failed, results };
        }
        catch (error) {
            console.error('Error sending overdue payment reminders:', error);
            return { sent: 0, failed: 0, results: [] };
        }
    }
    async getOverduePayments() {
        const currentDate = new Date();
        return await index_1.db
            .select({
            id: schema_1.payments.id,
            dueDate: schema_1.payments.dueDate,
            amountDue: schema_1.payments.amountDue,
            amountPaid: schema_1.payments.amountPaid,
            lease: schema_1.leases,
            tenant: schema_1.tenants,
            property: schema_1.properties
        })
            .from(schema_1.payments)
            .innerJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
            .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
            .innerJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, 'Pending')));
    }
    async sendOverdueReminderForPayment(payment) {
        if (!payment.tenant.phoneNumber) {
            return { success: false, error: 'Tenant phone number not available' };
        }
        const reminderData = {
            tenantName: payment.tenant.name,
            propertyAddress: payment.tenant.houseAddress || payment.property.name,
            rentAmount: payment.amountDue,
            dueDate: payment.dueDate,
            landlordName: payment.landlord?.name || 'Landlord',
            landlordPhone: payment.landlord?.phoneNumber || 'N/A'
        };
        return await this.smsService.sendRentReminder(payment.tenant.userId, payment.tenant.phoneNumber, reminderData, 0);
    }
    async schedulePaymentNotifications(paymentId, delayMinutes = 5) {
        setTimeout(async () => {
            await this.processPaymentNotifications(paymentId);
        }, delayMinutes * 60 * 1000);
    }
}
exports.PaymentNotificationService = PaymentNotificationService;
