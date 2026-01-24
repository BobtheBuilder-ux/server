import { Request, Response } from 'express';
import { SMSNotificationService } from '../services/smsNotificationService';
import { MessageResponseService } from '../services/messageResponseService';
import { RenewalInteractionService } from '../services/renewalInteractionService';
import { db } from '../db/index';
import { 
  tenants, 
  landlords, 
  properties, 
  leases, 
  payments,
  smsMessages,
  messageResponses,
  locations
} from '../db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const sendRentReminderSchema = z.object({
  tenantId: z.string(),
  daysBeforeDue: z.number().min(0).max(30).optional().default(7)
});

const sendPaymentConfirmationSchema = z.object({
  paymentId: z.number(),
  tenantId: z.string()
});

const sendLandlordAlertSchema = z.object({
  paymentId: z.number(),
  landlordId: z.string()
});

const sendRenewalRequestSchema = z.object({
  leaseId: z.number(),
  tenantId: z.string(),
  expiresInDays: z.number().min(1).max(30).optional().default(7)
});

const termiiWebhookSchema = z.object({
  from: z.string(),
  message: z.string(),
  messageId: z.string().optional(),
  timestamp: z.string().optional()
});

export class SMSController {
  private smsService: SMSNotificationService;
  private responseService: MessageResponseService;
  private renewalService: RenewalInteractionService;

  constructor() {
    this.smsService = new SMSNotificationService();
    this.responseService = new MessageResponseService();
    this.renewalService = new RenewalInteractionService();
  }

  /**
   * Send rent reminder to tenant
   */
  sendRentReminder = async (req: Request, res: Response) => {
    try {
      const { tenantId, daysBeforeDue } = sendRentReminderSchema.parse(req.body);

      // Get tenant and current lease details
      const tenantData = await db
        .select({
          tenant: tenants,
          lease: leases,
          property: properties,
          landlord: landlords,
          payment: payments
        })
        .from(tenants)
        .innerJoin(leases, eq(tenants.cognitoId, leases.tenantCognitoId))
        .innerJoin(properties, eq(leases.propertyId, properties.id))
        .innerJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(payments, eq(leases.id, payments.leaseId))
        .where(eq(tenants.userId, tenantId))
        .orderBy(desc(leases.endDate))
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

      // Calculate due date (assuming yearly rent)
      const dueDate = payment?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const reminderData = {
        tenantName: tenant.name,
        propertyAddress: tenant.houseAddress || property.name,
        rentAmount: lease.rent,
        dueDate,
        landlordName: landlord.name,
        landlordPhone: landlord.phoneNumber
      };

      const result = await this.smsService.sendRentReminder(
        tenantId,
        tenant.phoneNumber,
        reminderData,
        daysBeforeDue
      );

      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          message: 'Rent reminder sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in sendRentReminder:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Send payment confirmation to tenant
   */
  sendPaymentConfirmation = async (req: Request, res: Response) => {
    try {
      const { paymentId, tenantId } = sendPaymentConfirmationSchema.parse(req.body);

      // Get payment and related details
      const paymentData = await db
        .select({
          payment: payments,
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
            eq(payments.id, paymentId),
            eq(tenants.userId, tenantId)
          )
        );

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

      const result = await this.smsService.sendPaymentConfirmation(
        tenantId,
        tenant.phoneNumber,
        confirmationData,
        paymentId
      );

      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          message: 'Payment confirmation sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in sendPaymentConfirmation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Send payment alert to landlord
   */
  sendLandlordAlert = async (req: Request, res: Response) => {
    try {
      const { paymentId, landlordId } = sendLandlordAlertSchema.parse(req.body);

      // Get payment and related details
      const paymentData = await db
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
            eq(payments.id, paymentId),
            eq(landlords.userId, landlordId)
          )
        );

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

      const result = await this.smsService.sendLandlordPaymentAlert(
        landlordId,
        landlord.phoneNumber,
        alertData,
        paymentId
      );

      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          message: 'Landlord alert sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in sendLandlordAlert:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Send renewal request to tenant
   */
  sendRenewalRequest = async (req: Request, res: Response) => {
    try {
      const { leaseId, tenantId, expiresInDays } = sendRenewalRequestSchema.parse(req.body);

      // Get lease and related details
      const leaseData = await db
        .select({
          lease: leases,
          tenant: tenants,
          property: properties,
          landlord: landlords,
          location: locations
        })
        .from(leases)
        .innerJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .innerJoin(properties, eq(leases.propertyId, properties.id))
        .innerJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .where(
          and(
            eq(leases.id, leaseId),
            eq(tenants.cognitoId, tenantId)
          )
        );

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

      // Prepare renewal interaction data
      const renewalData = {
        leaseId: lease.id.toString(),
        tenantId: tenant.cognitoId,
        landlordId: landlord.cognitoId,
        propertyName: property.name,
        propertyAddress: location?.address || 'Address not available',
        currentRent: lease.rent,
        leaseEndDate: lease.endDate,
        renewalTerms: 'Standard renewal terms apply',
        newRentAmount: lease.rent // Could be different for renewal
      };

      // Use the new renewal service
      const renewalRequestId = await this.renewalService.initiateRenewalRequest(renewalData);

      res.json({
        success: true,
        renewalRequestId,
        message: 'Renewal request sent successfully',
        expiresInDays
      });
    } catch (error) {
      console.error('Error in sendRenewalRequest:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Handle Termii webhook for incoming messages
   */
  handleWebhook = async (req: Request, res: Response) => {
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
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in handleWebhook:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Get message history for a user
   */
  getMessageHistory = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, category } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      let whereCondition;
      if (category) {
        whereCondition = and(
          eq(smsMessages.recipientId, userId),
          eq(smsMessages.category, category as any)
        );
      } else {
        whereCondition = eq(smsMessages.recipientId, userId);
      }

      const messages = await db
        .select({
          id: smsMessages.id,
          content: smsMessages.content,
          recipientId: smsMessages.recipientId,
          recipientType: smsMessages.recipientType,
          category: smsMessages.category,
          createdAt: smsMessages.createdAt
        })
        .from(smsMessages)
        .where(whereCondition)
        .orderBy(desc(smsMessages.createdAt))
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
    } catch (error) {
      console.error('Error in getMessageHistory:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Get response history
   */
  getResponseHistory = async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      const responses = await db
        .select({
          id: messageResponses.id,
          responseText: messageResponses.responseText,
          status: messageResponses.status,
          isValid: messageResponses.isValid,
          createdAt: messageResponses.createdAt,
          processedAt: messageResponses.processedAt,
          errorMessage: messageResponses.errorMessage
        })
        .from(messageResponses)
        .where(eq(messageResponses.responsePhone, phoneNumber))
        .orderBy(desc(messageResponses.createdAt))
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
    } catch (error) {
      console.error('Error in getResponseHistory:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Send overdue rent reminders (cron job endpoint)
   */
  sendOverdueReminders = async (req: Request, res: Response) => {
    try {
      const result = await this.smsService.sendOverdueRentReminders();

      res.json({
        success: true,
        message: `Sent ${result.sent} reminders, ${result.failed} failed`,
        data: result
      });
    } catch (error) {
      console.error('Error in sendOverdueReminders:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Get SMS statistics
   */
  getStats = async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;

      // Basic stats query - would be expanded based on requirements
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
    } catch (error) {
      console.error('Error in getStats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };
}