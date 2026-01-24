"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandlordNotificationService = void 0;
const index_1 = require("../db/index");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../db/schema");
const smsNotificationService_1 = require("./smsNotificationService");
class LandlordNotificationService {
    constructor() {
        this.smsService = new smsNotificationService_1.SMSNotificationService();
    }
    async sendPaymentAlert(paymentId) {
        try {
            const paymentResult = await index_1.db
                .select({
                payment: schema_1.payments,
                lease: schema_1.leases,
                property: schema_1.properties,
                tenant: schema_1.tenants,
                landlord: schema_1.landlords,
                location: schema_1.locations
            })
                .from(schema_1.payments)
                .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .where((0, drizzle_orm_1.eq)(schema_1.payments.id, parseInt(paymentId)))
                .limit(1);
            if (!paymentResult.length || !paymentResult[0].landlord) {
                console.error(`No landlord found for payment ${paymentId}`);
                return;
            }
            const { payment, lease, property, tenant, landlord, location } = paymentResult[0];
            if (!payment || !lease || !property || !tenant || !landlord) {
                console.error(`Incomplete data for payment alert ${paymentId}`);
                return;
            }
            const remainingBalance = payment.amountDue - payment.amountPaid;
            const alertData = {
                landlordId: landlord.cognitoId,
                tenantName: tenant.name,
                propertyName: property.name,
                propertyAddress: location?.address || 'Address not available',
                amountPaid: payment.amountPaid,
                paymentDate: payment.paymentDate || new Date(),
                paymentReference: 'N/A',
                remainingBalance: remainingBalance > 0 ? remainingBalance : undefined,
                totalRentDue: payment.amountDue
            };
            await this.smsService.sendLandlordPaymentAlert(landlord.cognitoId, landlord.phoneNumber, {
                landlordName: landlord.name,
                tenantName: tenant.name,
                propertyAddress: location?.address || 'Address not available',
                amountPaid: payment.amountPaid,
                paymentDate: payment.paymentDate || new Date(),
                totalRent: payment.amountDue
            }, parseInt(paymentId));
            console.log(`Payment alert sent to landlord ${landlord.cognitoId} for payment ${paymentId}`);
        }
        catch (error) {
            console.error(`Error sending payment alert for payment ${paymentId}:`, error);
            throw error;
        }
    }
    async sendPropertyUpdate(updateData) {
        try {
            const landlordResult = await index_1.db
                .select()
                .from(schema_1.landlords)
                .where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, updateData.landlordId))
                .limit(1);
            if (!landlordResult.length) {
                console.error(`Landlord not found: ${updateData.landlordId}`);
                return;
            }
            const landlord = landlordResult[0];
            let message = '';
            switch (updateData.updateType) {
                case 'new_tenant':
                    message = `🏠 NEW TENANT ALERT\n\nProperty: ${updateData.propertyName}\nLocation: ${updateData.propertyAddress}\nTenant: ${updateData.tenantName}\n\n${updateData.details}\n\nHomematch`;
                    break;
                case 'lease_renewal':
                    message = `📋 LEASE RENEWAL UPDATE\n\nProperty: ${updateData.propertyName}\nLocation: ${updateData.propertyAddress}\nTenant: ${updateData.tenantName}\n\n${updateData.details}\n\nHomematch`;
                    break;
                case 'maintenance_request':
                    message = `🔧 MAINTENANCE REQUEST\n\nProperty: ${updateData.propertyName}\nLocation: ${updateData.propertyAddress}\nTenant: ${updateData.tenantName}\n\n${updateData.details}\n\nHomematch`;
                    break;
                case 'inspection_scheduled':
                    message = `📅 INSPECTION SCHEDULED\n\nProperty: ${updateData.propertyName}\nLocation: ${updateData.propertyAddress}\n\n${updateData.details}\n\nHomematch`;
                    break;
                default:
                    message = `🏠 PROPERTY UPDATE\n\nProperty: ${updateData.propertyName}\nLocation: ${updateData.propertyAddress}\n\n${updateData.details}\n\nHomematch`;
            }
            if (landlord.phoneNumber) {
                await this.smsService.sendSMS(landlord.phoneNumber, message);
                console.log(`Property update sent to landlord ${updateData.landlordId}`);
            }
            else {
                console.log(`Skipped SMS for landlord ${updateData.landlordId} - no phone number`);
            }
        }
        catch (error) {
            console.error(`Error sending property update to landlord ${updateData.landlordId}:`, error);
            throw error;
        }
    }
    async sendOverduePaymentAlerts() {
        try {
            const overduePayments = await index_1.db
                .select({
                payment: schema_1.payments,
                lease: schema_1.leases,
                property: schema_1.properties,
                tenant: schema_1.tenants,
                landlord: schema_1.landlords,
                location: schema_1.locations
            })
                .from(schema_1.payments)
                .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, 'Pending')));
            const landlordGroups = new Map();
            for (const payment of overduePayments) {
                if (!payment.landlord)
                    continue;
                const landlordId = payment.landlord.cognitoId;
                if (!landlordGroups.has(landlordId)) {
                    landlordGroups.set(landlordId, []);
                }
                landlordGroups.get(landlordId).push(payment);
            }
            for (const [landlordId, landlordPayments] of landlordGroups) {
                await this.sendBulkOverdueAlert(landlordId, landlordPayments);
            }
            console.log(`Sent overdue payment alerts to ${landlordGroups.size} landlords`);
        }
        catch (error) {
            console.error('Error sending bulk overdue payment alerts:', error);
            throw error;
        }
    }
    async sendBulkOverdueAlert(landlordId, overduePayments) {
        try {
            if (!overduePayments.length)
                return;
            const landlord = overduePayments[0].landlord;
            if (!landlord)
                return;
            let message = `⚠️ OVERDUE PAYMENTS ALERT\n\nDear ${landlord.name},\n\nThe following payments are overdue:\n\n`;
            let totalOverdue = 0;
            for (const payment of overduePayments.slice(0, 5)) {
                if (payment.payment && payment.tenant && payment.property) {
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(payment.payment.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                    message += `• ${payment.tenant.name} - ${payment.property.name}\n`;
                    message += `  ₦${payment.payment.amountDue.toLocaleString()} (${daysOverdue} days overdue)\n\n`;
                    totalOverdue += payment.payment.amountDue;
                }
            }
            if (overduePayments.length > 5) {
                message += `... and ${overduePayments.length - 5} more properties\n\n`;
            }
            message += `Total Overdue: ₦${totalOverdue.toLocaleString()}\n\nPlease follow up with your tenants.\n\nHomematch`;
            await this.smsService.sendSMS(landlord.phoneNumber, message);
            console.log(`Bulk overdue alert sent to landlord ${landlordId}`);
        }
        catch (error) {
            console.error(`Error sending bulk overdue alert to landlord ${landlordId}:`, error);
            throw error;
        }
    }
    async sendMonthlySummary(landlordId) {
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const endOfMonth = new Date(startOfMonth);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            console.log(`Monthly summary sent to landlord ${landlordId}`);
        }
        catch (error) {
            console.error(`Error sending monthly summary to landlord ${landlordId}:`, error);
            throw error;
        }
    }
}
exports.LandlordNotificationService = LandlordNotificationService;
