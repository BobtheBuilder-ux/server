import { db } from '../db/index';
import { 
  payments, 
  leases, 
  tenants, 
  landlords, 
  properties, 
  locations 
} from '../db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { SMSNotificationService, RentReminderData } from './smsNotificationService';
import { LandlordNotificationService } from './landlordNotificationService';

export interface PaymentNotificationData {
  paymentId: number;
  tenantId: string;
  landlordId: string;
  amount: number;
  paymentDate: Date;
  propertyAddress: string;
  tenantName: string;
  landlordName: string;
  tenantPhone?: string | null;
  landlordPhone?: string | null;
}

export class PaymentNotificationService {
  private smsService: SMSNotificationService;
  private landlordService: LandlordNotificationService;

  constructor() {
    this.smsService = new SMSNotificationService();
    this.landlordService = new LandlordNotificationService();
  }

  /**
   * Process payment notifications - send confirmation to tenant and alert to landlord
   */
  async processPaymentNotifications(paymentId: number): Promise<{
    tenantNotification: { success: boolean; messageId?: number; error?: string };
    landlordNotification: { success: boolean; messageId?: number; error?: string };
  }> {
    try {
      // Get payment details with related information
      const paymentData = await this.getPaymentDetails(paymentId);
      
      if (!paymentData) {
        throw new Error('Payment not found');
      }

      // Send tenant confirmation
      const tenantResult = await this.sendTenantPaymentConfirmation(paymentData);
      
      // Send landlord alert using the new landlord service
      await this.landlordService.sendPaymentAlert(paymentId.toString());
      const landlordResult = { success: true, messageId: 1 };

      console.log(`Payment notifications sent for payment ${paymentId}`);

      return {
        tenantNotification: tenantResult,
        landlordNotification: landlordResult
      };
    } catch (error) {
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

  /**
   * Get payment details with all related information
   */
  private async getPaymentDetails(paymentId: number): Promise<PaymentNotificationData | null> {
    const result = await db
      .select({
        payment: payments,
        lease: leases,
        tenant: tenants,
        landlord: landlords,
        property: properties
      })
      .from(payments)
      .innerJoin(leases, eq(payments.leaseId, leases.id))
      .innerJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .innerJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .where(eq(payments.id, paymentId))
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

  /**
   * Send payment confirmation to tenant
   */
  private async sendTenantPaymentConfirmation(
    paymentData: PaymentNotificationData
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!paymentData.tenantPhone) {
      return { success: false, error: 'Tenant phone number not available' };
    }

    try {
      // Get remaining balance
      const remainingBalance = await this.calculateRemainingBalance(paymentData.paymentId);

      const confirmationData = {
        tenantName: paymentData.tenantName,
        propertyAddress: paymentData.propertyAddress,
        amountPaid: paymentData.amount,
        paymentDate: paymentData.paymentDate,
        remainingBalance
      };

      const result = await this.smsService.sendPaymentConfirmation(
        paymentData.tenantId,
        paymentData.tenantPhone,
        confirmationData,
        paymentData.paymentId
      );

      return result;
    } catch (error) {
      console.error('Error sending tenant payment confirmation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send payment alert to landlord
   */
  private async sendLandlordPaymentAlert(
    paymentData: PaymentNotificationData
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!paymentData.landlordPhone) {
      return { success: false, error: 'Landlord phone number not available' };
    }

    try {
      // Get total rent amount
      const totalRent = await this.getTotalRentAmount(paymentData.paymentId);

      const alertData = {
        landlordName: paymentData.landlordName,
        tenantName: paymentData.tenantName,
        propertyAddress: paymentData.propertyAddress,
        amountPaid: paymentData.amount,
        paymentDate: paymentData.paymentDate,
        totalRent
      };

      const result = await this.smsService.sendLandlordPaymentAlert(
        paymentData.landlordId,
        paymentData.landlordPhone,
        alertData,
        paymentData.paymentId
      );

      return result;
    } catch (error) {
      console.error('Error sending landlord payment alert:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Calculate remaining balance for a payment
   */
  private async calculateRemainingBalance(paymentId: number): Promise<number> {
    const payment = await db
      .select({
        amountPaid: payments.amountPaid,
        amountDue: payments.amountDue
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (payment.length === 0) {
      return 0;
    }

    return Math.max(0, payment[0].amountDue - payment[0].amountPaid);
  }

  /**
   * Get total rent amount for a payment
   */
  private async getTotalRentAmount(paymentId: number): Promise<number> {
    const result = await db
      .select({
        amountDue: payments.amountDue
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    return result.length > 0 ? result[0].amountDue : 0;
  }

  /**
   * Send bulk payment reminders for overdue payments
   */
  async sendOverduePaymentReminders(): Promise<{
    sent: number;
    failed: number;
    results: Array<{ paymentId: number; success: boolean; error?: string }>;
  }> {
    try {
      // Get overdue payments
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
          } else {
            failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ paymentId: payment.id, success: false, error: errorMessage });
          failed++;
        }
      }

      return { sent, failed, results };
    } catch (error) {
      console.error('Error sending overdue payment reminders:', error);
      return { sent: 0, failed: 0, results: [] };
    }
  }

  /**
   * Get overdue payments
   */
  private async getOverduePayments() {
    const currentDate = new Date();
    
    return await db
      .select({
        id: payments.id,
        dueDate: payments.dueDate,
        amountDue: payments.amountDue,
        amountPaid: payments.amountPaid,
        lease: leases,
        tenant: tenants,
        property: properties
      })
      .from(payments)
      .innerJoin(leases, eq(payments.leaseId, leases.id))
      .innerJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .where(
        and(
          eq(payments.paymentStatus, 'Pending'),
          // Payment is overdue (due date has passed)
          // Note: This would need to be adjusted based on your actual date comparison logic
        )
      );
  }

  /**
   * Send overdue reminder for a specific payment
   */
  private async sendOverdueReminderForPayment(payment: any): Promise<{
    success: boolean;
    messageId?: number;
    error?: string;
  }> {
    if (!payment.tenant.phoneNumber) {
      return { success: false, error: 'Tenant phone number not available' };
    }

    const reminderData: RentReminderData = {
      tenantName: payment.tenant.name,
      propertyAddress: payment.tenant.houseAddress || payment.property.name,
      rentAmount: payment.amountDue,
      dueDate: payment.dueDate,
      landlordName: payment.landlord?.name || 'Landlord',
      landlordPhone: payment.landlord?.phoneNumber || 'N/A'
    };

    // Use the existing rent reminder service with overdue flag
    return await this.smsService.sendRentReminder(
      payment.tenant.userId,
      payment.tenant.phoneNumber,
      reminderData,
      0 // 0 days before due (it's already overdue)
    );
  }

  /**
   * Schedule automatic payment notifications
   */
  async schedulePaymentNotifications(paymentId: number, delayMinutes: number = 5): Promise<void> {
    // In a production environment, you would use a job queue like Bull or Agenda
    // For now, we'll use a simple setTimeout
    setTimeout(async () => {
      await this.processPaymentNotifications(paymentId);
    }, delayMinutes * 60 * 1000);
  }
}