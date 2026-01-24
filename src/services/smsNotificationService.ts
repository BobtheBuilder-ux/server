import { db } from '../db/index';
import { 
  smsMessages, 
  messageAuditLog, 
  tenants, 
  landlords, 
  properties, 
  leases, 
  payments,
  renewalRequests 
} from '../db/schema';
import { TermiiService } from './termiiService';
import { eq, and, lte, gte, isNull, desc } from 'drizzle-orm';
import { addDays, format, isAfter, isBefore } from 'date-fns';

export interface RentReminderData {
  tenantName: string;
  propertyAddress: string;
  rentAmount: number;
  dueDate: Date;
  landlordName: string;
  landlordPhone: string | null;
}

export interface PaymentConfirmationData {
  tenantName: string;
  propertyAddress: string;
  amountPaid: number;
  paymentDate: Date;
  remainingBalance?: number;
}

export interface LandlordAlertData {
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  amountPaid: number;
  paymentDate: Date;
  totalRent: number;
}

export interface RenewalRequestData {
  tenantName: string;
  propertyAddress: string;
  currentLeaseEnd: Date;
  newRentAmount: number;
  landlordName: string;
}

export class SMSNotificationService {
  private termiiService: TermiiService;

  constructor() {
    this.termiiService = new TermiiService({
      apiKey: process.env.TERMII_API_KEY!,
      senderId: process.env.TERMII_SENDER_ID || 'HomeMatch',
      baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com'
    });
  }

  /**
   * Send rent due reminder to tenant
   */
  async sendRentReminder(
    tenantId: string,
    tenantPhone: string,
    data: RentReminderData,
    daysBeforeDue: number = 7
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      // Format the reminder message
      const message = this.formatRentReminderMessage(data, daysBeforeDue);
      
      // Send SMS via Termii
      const termiiResponse = await this.termiiService.sendSMS({
        to: tenantPhone,
        message,
        channel: 'generic'
      });

      // Save message to database
      const [savedMessage] = await db.insert(smsMessages).values({
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

      // Log the action
      await this.logMessageAction(savedMessage.id, 'sent', {
        termiiMessageId: termiiResponse.message_id,
        daysBeforeDue
      });

      return { success: true, messageId: savedMessage.id };
    } catch (error) {
      console.error('Error sending rent reminder:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send payment confirmation to tenant
   */
  async sendPaymentConfirmation(
    tenantId: string,
    tenantPhone: string,
    data: PaymentConfirmationData,
    paymentId?: number
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const message = this.formatPaymentConfirmationMessage(data);
      
      const termiiResponse = await this.termiiService.sendSMS({
        to: tenantPhone,
        message: message,
        channel: 'generic'
      });

      const [savedMessage] = await db.insert(smsMessages).values({
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
    } catch (error) {
      console.error('Error sending payment confirmation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send payment alert to landlord
   */
  async sendLandlordPaymentAlert(
    landlordId: string,
    landlordPhone: string | null,
    data: LandlordAlertData,
    paymentId?: number
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      // Skip sending if no phone number
      if (!landlordPhone) {
        return { success: false, error: 'No phone number provided for landlord' };
      }

      const message = this.formatLandlordAlertMessage(data);
      
      const termiiResponse = await this.termiiService.sendSMS({
        to: landlordPhone,
        message: message,
        channel: 'generic'
      });

      const [savedMessage] = await db.insert(smsMessages).values({
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
    } catch (error) {
      console.error('Error sending landlord alert:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send renewal request to tenant
   */
  async sendRenewalRequest(
    tenantId: string,
    tenantPhone: string,
    data: RenewalRequestData,
    leaseId: number,
    expiresInDays: number = 7
  ): Promise<{ success: boolean; messageId?: number; renewalRequestId?: number; error?: string }> {
    try {
      const message = this.formatRenewalRequestMessage(data, expiresInDays);
      
      const termiiResponse = await this.termiiService.sendSMS({
        to: tenantPhone,
        message: message,
        channel: 'generic'
      });

      const [savedMessage] = await db.insert(smsMessages).values({
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

      // Create renewal request record
      const [renewalRequest] = await db.insert(renewalRequests).values({
        leaseId,
        tenantId: parseInt(tenantId),
        landlordId: 1, // This should be derived from the lease
        propertyId: 1, // This should be derived from the lease
        messageId: savedMessage.id,
        expiresAt: addDays(new Date(), expiresInDays),
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
    } catch (error) {
      console.error('Error sending renewal request:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get overdue rent payments and send reminders
   */
  async sendOverdueRentReminders(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    try {
      // Get overdue payments
      const overduePayments = await db
        .select({
          payment: payments,
          lease: leases,
          tenant: tenants,
          property: properties,
          landlord: landlords
        })
        .from(payments)
        .innerJoin(leases, eq(payments.leaseId, leases.id))
        .innerJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .innerJoin(properties, eq(leases.propertyId, properties.id))
        .innerJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .where(
          and(
            eq(payments.paymentStatus, 'Overdue'),
            lte(payments.dueDate, new Date())
          )
        );

      for (const record of overduePayments) {
        const reminderData: RentReminderData = {
          tenantName: record.tenant.name,
          propertyAddress: record.tenant.houseAddress || 'Your rental property',
          rentAmount: record.payment.amountDue,
          dueDate: record.payment.dueDate,
          landlordName: record.landlord.name,
          landlordPhone: record.landlord.phoneNumber
        };

        const result = await this.sendRentReminder(
          record.tenant.userId!,
          record.tenant.phoneNumber || '',
          reminderData,
          0 // Overdue, so 0 days before due
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          console.error(`Failed to send overdue reminder to ${record.tenant.phoneNumber}:`, result.error);
        }
      }
    } catch (error) {
      console.error('Error sending overdue rent reminders:', error);
    }

    return { sent, failed };
  }

  /**
   * Format rent reminder message
   */
  private formatRentReminderMessage(data: RentReminderData, daysBeforeDue: number): string {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(data.rentAmount);

    const formattedDate = format(data.dueDate, 'MMM dd, yyyy');

    if (daysBeforeDue === 0) {
      return `Dear ${data.tenantName}, your rent of ${formattedAmount} for ${data.propertyAddress} is now OVERDUE (due: ${formattedDate}). Please make payment immediately to avoid penalties. Contact ${data.landlordName} at ${data.landlordPhone} for assistance. - HomeMatch`;
    } else if (daysBeforeDue === 1) {
      return `Dear ${data.tenantName}, your rent of ${formattedAmount} for ${data.propertyAddress} is due TOMORROW (${formattedDate}). Please ensure timely payment. Contact ${data.landlordName} at ${data.landlordPhone} if needed. - HomeMatch`;
    } else {
      return `Dear ${data.tenantName}, your rent of ${formattedAmount} for ${data.propertyAddress} is due in ${daysBeforeDue} days (${formattedDate}). Please prepare for timely payment. Contact ${data.landlordName} at ${data.landlordPhone} if needed. - HomeMatch`;
    }
  }

  /**
   * Format payment confirmation message
   */
  private formatPaymentConfirmationMessage(data: PaymentConfirmationData): string {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(data.amountPaid);

    const formattedDate = format(data.paymentDate, 'MMM dd, yyyy');

    let message = `Dear ${data.tenantName}, we confirm receipt of your rent payment of ${formattedAmount} for ${data.propertyAddress} on ${formattedDate}.`;

    if (data.remainingBalance && data.remainingBalance > 0) {
      const formattedBalance = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN'
      }).format(data.remainingBalance);
      message += ` Remaining balance: ${formattedBalance}.`;
    } else {
      message += ' Your rent is now fully paid.';
    }

    message += ' Thank you for your prompt payment. - HomeMatch';
    return message;
  }

  /**
   * Format landlord alert message
   */
  private formatLandlordAlertMessage(data: LandlordAlertData): string {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(data.amountPaid);

    const formattedTotal = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(data.totalRent);

    const formattedDate = format(data.paymentDate, 'MMM dd, yyyy');

    return `Dear ${data.landlordName}, ${data.tenantName} has made a rent payment of ${formattedAmount} (Total: ${formattedTotal}) for ${data.propertyAddress} on ${formattedDate}. Payment processed successfully. - HomeMatch`;
  }

  /**
   * Format renewal request message
   */
  private formatRenewalRequestMessage(data: RenewalRequestData, expiresInDays: number): string {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(data.newRentAmount);

    const formattedDate = format(data.currentLeaseEnd, 'MMM dd, yyyy');

    return `Dear ${data.tenantName}, your lease for ${data.propertyAddress} expires on ${formattedDate}. ${data.landlordName} offers renewal at ${formattedAmount}/year. Reply "YES" to accept or "NO" to decline within ${expiresInDays} days. - HomeMatch`;
  }

  /**
   * Log message action for audit trail
   */
  private async logMessageAction(
    messageId: number,
    action: string,
    details: any,
    performedBy: string = 'system'
  ): Promise<void> {
    try {
      await db.insert(messageAuditLog).values({
        messageId,
        action,
        details,
        performedBy,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error logging message action:', error);
    }
  }

  /**
   * Get message delivery status from Termii
   */
  /**
   * Send a simple SMS message
   */
  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const termiiResponse = await this.termiiService.sendSMS({
        to,
        message,
        channel: 'generic'
      });

      // Store message in database
      const [messageRecord] = await db.insert(smsMessages).values({
        messageId: termiiResponse.message_id,
        recipientPhone: to,
        recipientId: 'system', // Default for generic messages
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

    } catch (error) {
      console.error('Error sending SMS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateMessageStatus(messageId: string): Promise<void> {
    try {
      // This would integrate with Termii's delivery status API
      // For now, we'll implement a placeholder
      console.log(`Updating status for message: ${messageId}`);
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }
}