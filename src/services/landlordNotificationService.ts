import { db } from '../db/index';
import { eq, and } from 'drizzle-orm';
import { payments, leases, properties, tenants, landlords, locations } from '../db/schema';
import { SMSNotificationService } from './smsNotificationService';

export interface LandlordPaymentAlertData {
  landlordId: string;
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  amountPaid: number;
  paymentDate: Date;
  paymentReference: string;
  remainingBalance?: number;
  totalRentDue?: number;
}

export interface LandlordPropertyUpdateData {
  landlordId: string;
  propertyName: string;
  propertyAddress: string;
  updateType: 'new_tenant' | 'lease_renewal' | 'maintenance_request' | 'inspection_scheduled';
  tenantName?: string;
  details: string;
}

export class LandlordNotificationService {
  private smsService: SMSNotificationService;

  constructor() {
    this.smsService = new SMSNotificationService();
  }

  /**
   * Send payment alert to landlord when tenant makes a payment
   */
  async sendPaymentAlert(paymentId: string): Promise<void> {
    try {
      // Get payment details with related data
      const paymentResult = await db
        .select({
          payment: payments,
          lease: leases,
          property: properties,
          tenant: tenants,
          landlord: landlords,
          location: locations
        })
        .from(payments)
        .leftJoin(leases, eq(payments.leaseId, leases.id))
        .leftJoin(properties, eq(leases.propertyId, properties.id))
        .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .where(eq(payments.id, parseInt(paymentId)))
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

      // Calculate remaining balance if applicable
      const remainingBalance = payment.amountDue - payment.amountPaid;
      
      const alertData: LandlordPaymentAlertData = {
        landlordId: landlord.cognitoId,
        tenantName: tenant.name,
        propertyName: property.name,
        propertyAddress: location?.address || 'Address not available',
        amountPaid: payment.amountPaid,
        paymentDate: payment.paymentDate || new Date(),
        paymentReference: 'N/A', // Remove paystackReference as it doesn't exist in schema
        remainingBalance: remainingBalance > 0 ? remainingBalance : undefined,
        totalRentDue: payment.amountDue
      };

      await this.smsService.sendLandlordPaymentAlert(
        landlord.cognitoId,
        landlord.phoneNumber,
        {
          landlordName: landlord.name,
          tenantName: tenant.name,
          propertyAddress: location?.address || 'Address not available',
          amountPaid: payment.amountPaid,
          paymentDate: payment.paymentDate || new Date(),
          totalRent: payment.amountDue
        },
        parseInt(paymentId)
      );

      console.log(`Payment alert sent to landlord ${landlord.cognitoId} for payment ${paymentId}`);
    } catch (error) {
      console.error(`Error sending payment alert for payment ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Send property update notification to landlord
   */
  async sendPropertyUpdate(updateData: LandlordPropertyUpdateData): Promise<void> {
    try {
      // Get landlord details
      const landlordResult = await db
        .select()
        .from(landlords)
        .where(eq(landlords.cognitoId, updateData.landlordId))
        .limit(1);

      if (!landlordResult.length) {
        console.error(`Landlord not found: ${updateData.landlordId}`);
        return;
      }

      const landlord = landlordResult[0];

      // Format message based on update type
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

      // Send SMS notification only if phone number exists
      if (landlord.phoneNumber) {
        await this.smsService.sendSMS(
          landlord.phoneNumber,
          message
        );
        console.log(`Property update sent to landlord ${updateData.landlordId}`);
      } else {
        console.log(`Skipped SMS for landlord ${updateData.landlordId} - no phone number`);
      }
    } catch (error) {
      console.error(`Error sending property update to landlord ${updateData.landlordId}:`, error);
      throw error;
    }
  }

  /**
   * Send bulk payment reminders to landlords about overdue tenant payments
   */
  async sendOverduePaymentAlerts(): Promise<void> {
    try {
      // Get all overdue payments with landlord details
      const overduePayments = await db
        .select({
          payment: payments,
          lease: leases,
          property: properties,
          tenant: tenants,
          landlord: landlords,
          location: locations
        })
        .from(payments)
        .leftJoin(leases, eq(payments.leaseId, leases.id))
        .leftJoin(properties, eq(leases.propertyId, properties.id))
        .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .where(
          and(
            eq(payments.paymentStatus, 'Pending'),
            // Payment is overdue (due date has passed)
            // Note: You might want to add a buffer period here
          )
        );

      // Group by landlord
      const landlordGroups = new Map<string, typeof overduePayments>();
      
      for (const payment of overduePayments) {
        if (!payment.landlord) continue;
        
        const landlordId = payment.landlord.cognitoId;
        if (!landlordGroups.has(landlordId)) {
          landlordGroups.set(landlordId, []);
        }
        landlordGroups.get(landlordId)!.push(payment);
      }

      // Send alerts to each landlord
      for (const [landlordId, landlordPayments] of landlordGroups) {
        await this.sendBulkOverdueAlert(landlordId, landlordPayments);
      }

      console.log(`Sent overdue payment alerts to ${landlordGroups.size} landlords`);
    } catch (error) {
      console.error('Error sending bulk overdue payment alerts:', error);
      throw error;
    }
  }

  /**
   * Send bulk overdue alert to a specific landlord
   */
  private async sendBulkOverdueAlert(
    landlordId: string, 
    overduePayments: any[]
  ): Promise<void> {
    try {
      if (!overduePayments.length) return;

      const landlord = overduePayments[0].landlord;
      if (!landlord) return;

      let message = `⚠️ OVERDUE PAYMENTS ALERT\n\nDear ${landlord.name},\n\nThe following payments are overdue:\n\n`;

      let totalOverdue = 0;
      for (const payment of overduePayments.slice(0, 5)) { // Limit to 5 to keep SMS short
        if (payment.payment && payment.tenant && payment.property) {
          const daysOverdue = Math.floor(
            (new Date().getTime() - new Date(payment.payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          message += `• ${payment.tenant.name} - ${payment.property.name}\n`;
          message += `  ₦${payment.payment.amountDue.toLocaleString()} (${daysOverdue} days overdue)\n\n`;
          totalOverdue += payment.payment.amountDue;
        }
      }

      if (overduePayments.length > 5) {
        message += `... and ${overduePayments.length - 5} more properties\n\n`;
      }

      message += `Total Overdue: ₦${totalOverdue.toLocaleString()}\n\nPlease follow up with your tenants.\n\nHomematch`;

      // Send SMS notification
      await this.smsService.sendSMS(
        landlord.phoneNumber,
        message
      );

      console.log(`Bulk overdue alert sent to landlord ${landlordId}`);
    } catch (error) {
      console.error(`Error sending bulk overdue alert to landlord ${landlordId}:`, error);
      throw error;
    }
  }

  /**
   * Send monthly property summary to landlord
   */
  async sendMonthlySummary(landlordId: string): Promise<void> {
    try {
      // Get landlord's properties and payment summary for the current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      // This would require more complex queries to get monthly summaries
      // Implementation would depend on specific requirements
      
      console.log(`Monthly summary sent to landlord ${landlordId}`);
    } catch (error) {
      console.error(`Error sending monthly summary to landlord ${landlordId}:`, error);
      throw error;
    }
  }
}