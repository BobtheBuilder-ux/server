import { db } from '../db/index';
import { eq, and, isNull, desc } from "drizzle-orm";
import { 
  messageResponses, 
  renewalRequests, 
  smsMessages, 
  leases, 
  tenants, 
  properties,
  landlords,
  locations,
  messageAuditLog,
  admins
} from "../db/schema";
import { SMSNotificationService } from "./smsNotificationService";
import { RenewalInteractionService } from "./renewalInteractionService";
import { NotificationService, NotificationType as ServiceNotificationType, NotificationPriority } from "./notificationService";

export interface IncomingMessage {
  from: string;
  message: string;
  messageId?: string;
  timestamp?: Date;
}

export interface ResponseProcessingResult {
  success: boolean;
  action?: 'renewal_accepted' | 'renewal_declined' | 'invalid_response' | 'no_pending_request';
  message?: string;
  error?: string;
  renewalRequestId?: number;
}

/**
 * Notification types for routing decisions
 */
export enum NotificationType {
  RENT_PAYMENT = 'rent_payment',
  RENEWAL_RESPONSE = 'renewal_response',
  INVALID_RESPONSE = 'invalid_response',
  UNMATCHED_RESPONSE = 'unmatched_response',
  SYSTEM_ERROR = 'system_error'
}

/**
 * MessageResponseService handles incoming SMS responses from tenants regarding lease renewals.
 * 
 * NOTIFICATION ROUTING STRATEGY:
 * =============================
 * This service implements a specific routing strategy for notifications based on the type of event:
 * 
 * 1. RENT PAYMENT RELATED NOTIFICATIONS (routed to LANDLORD):
 *    - RENEWAL_RESPONSE: When tenants accept/decline lease renewals
 *    These notifications are sent to the landlord because they directly impact rent collection
 *    and property management decisions.
 * 
 * 2. ALL OTHER NOTIFICATIONS (routed to ADMIN):
 *    - INVALID_RESPONSE: When tenants send invalid responses (not YES/NO)
 *    - UNMATCHED_RESPONSE: When responses are received without pending renewal requests
 *    - SYSTEM_ERROR: When technical errors occur during processing
 *    These notifications are sent to admin for system monitoring and support purposes.
 * 
 * ROUTING IMPLEMENTATION:
 * ======================
 * - routeNotification(): Main routing method that determines destination based on NotificationType
 * - routeToAdmin(): Sends notifications to all admin users in the system
 * - getAdminUsers(): Retrieves all admin user IDs for notification distribution
 * 
 * The routing ensures that landlords only receive business-critical notifications related to
 * their properties and rent collection, while admins handle all system-level issues.
 */
export class MessageResponseService {
  private smsService: SMSNotificationService;
  private renewalService: RenewalInteractionService;
  private notificationService: NotificationService;

  constructor() {
    this.smsService = new SMSNotificationService();
    this.renewalService = new RenewalInteractionService();
    this.notificationService = new NotificationService();
  }

  /**
   * NOTIFICATION ROUTING LOGIC
   * 
   * This service implements a clear notification routing strategy:
   * 
   * 1. RENT PAYMENT NOTIFICATIONS → Routed to LANDLORD
   *    - Tenant responses to rent payment reminders
   *    - Payment confirmations and alerts
   *    - Lease renewal responses (acceptance/decline)
   * 
   * 2. ALL OTHER NOTIFICATIONS → Routed to ADMIN
   *    - Invalid responses requiring manual review
   *    - Unmatched responses from unknown numbers
   *    - System errors and processing failures
   *    - General tenant inquiries and support requests
   * 
   * This ensures landlords only receive business-critical notifications
   * while admins handle all system management and support issues.
   */

  /**
   * Get all admin users for notification routing
   * @returns Array of admin user IDs
   */
  private async getAdminUsers(): Promise<string[]> {
    try {
      const adminUsers = await db.select({
        cognitoId: admins.cognitoId
      }).from(admins);
      
      return adminUsers.map(admin => admin.cognitoId);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      // Fallback: return empty array if admin fetch fails
      return [];
    }
  }

  /**
   * Route notification based on type and business rules
   * @param notificationType Type of notification to determine routing
   * @param landlordId Optional landlord ID for rent payment notifications
   * @param notificationData Notification content and metadata
   */
  /**
   * Route notifications based on type - rent payment to landlord, others to admin
   */
  private async routeNotification(
    notificationType: NotificationType,
    notificationData: {
      title: string;
      message: string;
      metadata?: any;
      relatedId?: number;
      relatedType?: string;
    },
    landlordId?: string
  ): Promise<void> {
    try {
      // Rent payment related notifications go to landlord
      if (notificationType === NotificationType.RENT_PAYMENT || 
          notificationType === NotificationType.RENEWAL_RESPONSE) {
        if (landlordId) {
          await this.notificationService.createNotification({
            title: notificationData.title,
            message: notificationData.message,
            type: ServiceNotificationType.PaymentReminder, // Using existing notification type enum
            priority: NotificationPriority.High,
            recipientId: landlordId,
            recipientType: 'landlord',
            relatedId: notificationData.relatedId,
            relatedType: notificationData.relatedType,
            metadata: notificationData.metadata
          });
          console.log(`Notification routed to landlord: ${landlordId}`);
        } else {
          console.warn('Landlord ID not provided for rent payment notification, routing to admin');
          await this.routeToAdmin(notificationData);
        }
      } else {
        // All other notifications go to admin
        await this.routeToAdmin(notificationData);
      }
    } catch (error) {
      console.error('Error routing notification:', error);
    }
  }

  /**
   * Route notifications to all admin users
   */
  private async routeToAdmin(notificationData: {
    title: string;
    message: string;
    metadata?: any;
    relatedId?: number;
    relatedType?: string;
  }): Promise<void> {
    try {
      const adminUsers = await this.getAdminUsers();
      
      const notificationPromises = adminUsers.map(adminId =>
        this.notificationService.createNotification({
          title: notificationData.title,
          message: notificationData.message,
          type: ServiceNotificationType.SystemAlert, // Using existing notification type enum
          priority: NotificationPriority.Medium,
          recipientId: adminId,
          recipientType: 'admin',
          relatedId: notificationData.relatedId,
          relatedType: notificationData.relatedType,
          metadata: notificationData.metadata
        })
      );

      await Promise.all(notificationPromises);
      console.log(`Notification routed to ${adminUsers.length} admin users`);
    } catch (error) {
      console.error('Error routing to admin:', error);
    }
  }

  /**
   * Process incoming SMS response from Termii webhook
   */
  async processIncomingResponse(incomingMessage: IncomingMessage): Promise<ResponseProcessingResult> {
    try {
      const { from: phoneNumber, message: responseText, timestamp = new Date() } = incomingMessage;

      // Clean and normalize the response
      const normalizedResponse = this.normalizeResponse(responseText);

      // Find the most recent renewal request message sent to this phone number
      const pendingRequest = await this.findPendingRenewalRequest(phoneNumber);

      if (!pendingRequest) {
        // Log the response but don't process it
        await this.logUnmatchedResponse(phoneNumber, responseText, timestamp);
        
        // Route unmatched response notification to admin
        await this.routeNotification(
          NotificationType.UNMATCHED_RESPONSE,
          {
            title: 'Unmatched SMS Response',
            message: `Received SMS response from ${phoneNumber} with no pending renewal request: "${responseText}"`,
            metadata: { phoneNumber, responseText, timestamp },
            relatedType: 'sms_response'
          }
        );
        
        return {
          success: true,
          action: 'no_pending_request',
          message: 'No pending renewal request found for this number'
        };
      }

      // Validate response
      if (!this.isValidResponse(normalizedResponse)) {
        await this.logInvalidResponse(pendingRequest.messageId, phoneNumber, responseText, timestamp);
        
        // Send clarification message
        await this.sendClarificationMessage(phoneNumber, pendingRequest.tenantName);
        
        // Route invalid response notification to admin
        await this.routeNotification(
          NotificationType.INVALID_RESPONSE,
          {
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
          }
        );
        
        return {
          success: true,
          action: 'invalid_response',
          message: 'Invalid response received, clarification sent'
        };
      }

      // Save the response
      const [savedResponse] = await db.insert(messageResponses).values({
        messageId: pendingRequest.messageId,
        responseText: normalizedResponse,
        responsePhone: phoneNumber,
        status: 'Received',
        isValid: true,
        createdAt: timestamp
      }).returning();

      // Process the response
      const processingResult = await this.processRenewalResponse(
        pendingRequest.renewalRequestId,
        normalizedResponse,
        savedResponse.id,
        pendingRequest
      );

      // Update response status
      await db.update(messageResponses)
        .set({
          status: 'Processed',
          processedAt: new Date(),
          processingResult
        })
        .where(eq(messageResponses.id, savedResponse.id));

      // Log the action
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

    } catch (error) {
      console.error('Error processing incoming response:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find pending renewal request for a phone number
   */
  private async findPendingRenewalRequest(phoneNumber: string) {
    try {
      const result = await db
        .select({
          messageId: smsMessages.id,
          renewalRequestId: renewalRequests.id,
          tenantName: tenants.name,
          propertyAddress: properties.name,
          expiresAt: renewalRequests.expiresAt
        })
        .from(smsMessages)
        .innerJoin(renewalRequests, eq(smsMessages.id, renewalRequests.messageId))
        .innerJoin(tenants, eq(renewalRequests.tenantId, tenants.id))
        .innerJoin(properties, eq(renewalRequests.propertyId, properties.id))
        .where(
          and(
            eq(smsMessages.recipientPhone, phoneNumber),
            eq(smsMessages.category, 'RenewalRequest'),
            eq(renewalRequests.status, 'Pending'),
            isNull(renewalRequests.responseId) // No response yet
          )
        )
        .orderBy(desc(smsMessages.createdAt))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const request = result[0];

      // Check if request has expired
      if (new Date() > request.expiresAt) {
        // Mark as expired
        await db.update(renewalRequests)
          .set({ status: 'Expired' })
          .where(eq(renewalRequests.id, request.renewalRequestId));
        
        return null;
      }

      return request;
    } catch (error) {
      console.error('Error finding pending renewal request:', error);
      return null;
    }
  }

  /**
   * Process renewal response (YES/NO)
   */
  private async processRenewalResponse(
    renewalRequestId: number,
    response: string,
    responseId: number,
    pendingRequest: any
  ): Promise<{ success: boolean; message: string; action: string }> {
    try {
      // Use the renewal service to process the response
      await this.renewalService.processRenewalResponse(
        renewalRequestId.toString(),
        response as 'YES' | 'NO',
        '',
        ''
      );

      const action = response === 'YES' ? 'lease_renewal_accepted' : 'lease_renewal_declined';
      const message = response === 'YES' 
        ? 'Lease renewal accepted successfully'
        : 'Lease renewal declined';

      // Route renewal response notification to landlord (rent payment related)
      await this.routeNotification(
        NotificationType.RENEWAL_RESPONSE,
        {
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
        },
        pendingRequest.landlordId
      );

      return { success: true, message, action };

    } catch (error) {
      console.error('Error processing renewal response:', error);
      
      // Route system error notification to admin
      await this.routeNotification(
        NotificationType.SYSTEM_ERROR,
        {
          title: 'Renewal Response Processing Error',
          message: `Failed to process renewal response for request ${renewalRequestId}: ${error}`,
          metadata: { renewalRequestId, response, error: String(error) },
          relatedId: renewalRequestId,
          relatedType: 'renewal_request'
        }
      );
      
      return { 
        success: false, 
        message: 'Failed to process response',
        action: 'processing_failed'
      };
    }
  }

  /**
   * Send confirmation message to tenant
   */
  private async sendResponseConfirmation(
    tenantPhone: string,
    tenantName: string,
    response: string,
    propertyAddress: string
  ): Promise<void> {
    try {
      const message = response === 'YES'
        ? `Dear ${tenantName}, thank you for accepting the lease renewal for ${propertyAddress}. Your landlord will contact you with next steps. - HomeMatch`
        : `Dear ${tenantName}, we've received your decision to decline the lease renewal for ${propertyAddress}. Your landlord has been notified. - HomeMatch`;

      await this.smsService.sendSMS(
      tenantPhone,
      message
    );
    } catch (error) {
      console.error('Error sending response confirmation:', error);
    }
  }

  /**
   * Notify landlord of tenant's response
   */
  private async notifyLandlordOfResponse(
    landlordPhone: string,
    landlordName: string,
    tenantName: string,
    propertyAddress: string,
    response: string
  ): Promise<void> {
    try {
      const message = response === 'YES'
        ? `Dear ${landlordName}, ${tenantName} has ACCEPTED the lease renewal for ${propertyAddress}. Please proceed with renewal documentation. - HomeMatch`
        : `Dear ${landlordName}, ${tenantName} has DECLINED the lease renewal for ${propertyAddress}. You may need to find a new tenant. - HomeMatch`;

      await this.smsService.sendSMS(
        landlordPhone,
        message
      );
    } catch (error) {
      console.error('Error notifying landlord:', error);
    }
  }

  /**
   * Send clarification message for invalid responses
   */
  private async sendClarificationMessage(phoneNumber: string, tenantName: string): Promise<void> {
    try {
      const message = `Dear ${tenantName}, we didn't understand your response. Please reply with "YES" to accept the lease renewal or "NO" to decline. - HomeMatch`;
      
      await this.smsService.sendSMS(phoneNumber, message);
    } catch (error) {
      console.error('Error sending clarification message:', error);
    }
  }

  /**
   * Normalize response text
   */
  private normalizeResponse(responseText: string): string {
    const cleaned = responseText.trim().toUpperCase();
    
    // Handle various forms of YES
    if (['YES', 'Y', 'ACCEPT', 'OK', 'OKAY', 'AGREE', '1'].includes(cleaned)) {
      return 'YES';
    }
    
    // Handle various forms of NO
    if (['NO', 'N', 'DECLINE', 'REJECT', 'DISAGREE', '0'].includes(cleaned)) {
      return 'NO';
    }
    
    return cleaned;
  }

  /**
   * Check if response is valid
   */
  private isValidResponse(response: string): boolean {
    return ['YES', 'NO'].includes(response);
  }

  /**
   * Log unmatched response
   */
  private async logUnmatchedResponse(
    phoneNumber: string,
    responseText: string,
    timestamp: Date
  ): Promise<void> {
    try {
      await db.insert(messageResponses).values({
        messageId: 0, // No associated message
        responseText,
        responsePhone: phoneNumber,
        status: 'Received',
        isValid: false,
        createdAt: timestamp,
        errorMessage: 'No pending renewal request found'
      });
    } catch (error) {
      console.error('Error logging unmatched response:', error);
    }
  }

  /**
   * Log invalid response
   */
  private async logInvalidResponse(
    messageId: number,
    phoneNumber: string,
    responseText: string,
    timestamp: Date
  ): Promise<void> {
    try {
      await db.insert(messageResponses).values({
        messageId,
        responseText,
        responsePhone: phoneNumber,
        status: 'Received',
        isValid: false,
        createdAt: timestamp,
        errorMessage: 'Invalid response format'
      });
    } catch (error) {
      console.error('Error logging invalid response:', error);
    }
  }

  /**
   * Log response action for audit trail
   */
  private async logResponseAction(
    responseId: number,
    action: string,
    details: any,
    performedBy: string = 'system'
  ): Promise<void> {
    try {
      await db.insert(messageAuditLog).values({
        responseId,
        action,
        details,
        performedBy,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error logging response action:', error);
    }
  }

  /**
   * Get response statistics
   */
  async getResponseStats(dateFrom?: Date, dateTo?: Date) {
    try {
      // This would return statistics about responses
      // Implementation depends on specific requirements
      return {
        totalResponses: 0,
        validResponses: 0,
        acceptedRenewals: 0,
        declinedRenewals: 0,
        invalidResponses: 0
      };
    } catch (error) {
      console.error('Error getting response stats:', error);
      return null;
    }
  }

  /**
   * Clean up expired renewal requests
   */
  async cleanupExpiredRequests(): Promise<{ expired: number }> {
    try {
      const result = await db.update(renewalRequests)
        .set({ status: 'Expired' })
        .where(
          and(
            eq(renewalRequests.status, 'Pending'),
            // expiresAt < now
          )
        );

      return { expired: 0 }; // Would return actual count
    } catch (error) {
      console.error('Error cleaning up expired requests:', error);
      return { expired: 0 };
    }
  }
}