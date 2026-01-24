import { db } from "../utils/database";
import { eq, and } from "drizzle-orm";
import { 
  renewalRequests, 
  leases, 
  properties, 
  tenants, 
  landlords, 
  locations,
  messageResponses,
  smsMessages
} from "../db/schema";
import { SMSNotificationService } from "./smsNotificationService";
import { LandlordNotificationService } from "./landlordNotificationService";

export interface RenewalInteractionData {
  leaseId: string;
  tenantId: string;
  landlordId: string;
  propertyName: string;
  propertyAddress: string;
  currentRent: number;
  leaseEndDate: Date;
  renewalTerms?: string;
  newRentAmount?: number;
}

export interface RenewalResponseData {
  renewalRequestId: string;
  tenantResponse: 'YES' | 'NO';
  responseDate: Date;
  additionalNotes?: string;
}

export class RenewalInteractionService {
  private smsService: SMSNotificationService;
  private landlordService: LandlordNotificationService;

  constructor() {
    this.smsService = new SMSNotificationService();
    this.landlordService = new LandlordNotificationService();
  }

  /**
   * Initiate renewal request and send interactive SMS to tenant
   */
  async initiateRenewalRequest(interactionData: RenewalInteractionData): Promise<string> {
    try {
      // First, get the lease data to extract propertyId
      const lease = await db.select()
        .from(leases)
        .where(eq(leases.id, parseInt(interactionData.leaseId)))
        .limit(1);

      if (!lease || lease.length === 0) {
        throw new Error(`Lease not found with ID: ${interactionData.leaseId}`);
      }

      const leaseData = lease[0];

      // Create renewal request record
      const renewalRequest = await db.insert(renewalRequests).values({
        leaseId: parseInt(interactionData.leaseId),
        tenantId: parseInt(interactionData.tenantId),
        landlordId: parseInt(interactionData.landlordId),
        propertyId: leaseData.propertyId,
        status: 'Pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }).returning({ id: renewalRequests.id });

      const renewalRequestId = renewalRequest[0].id;

      // Get tenant details
      const tenantResult = await db
        .select()
        .from(tenants)
        .where(eq(tenants.cognitoId, interactionData.tenantId))
        .limit(1);

      if (!tenantResult.length) {
        throw new Error(`Tenant not found: ${interactionData.tenantId}`);
      }

      const tenant = tenantResult[0];

      // Format renewal request message
      const renewalMessage = this.formatRenewalRequestMessage(interactionData, renewalRequestId.toString());

      // Send SMS with renewal request
      const smsResult = await this.smsService.sendSMS(
        tenant.phoneNumber,
        renewalMessage
      );

      // Log the SMS message
      await db.insert(smsMessages).values({
        messageId: smsResult.messageId?.toString(),
        recipientPhone: tenant.phoneNumber,
        recipientId: interactionData.tenantId,
        recipientType: 'tenant',
        messageType: 'SMS',
        category: 'RenewalRequest',
        content: renewalMessage,
        status: smsResult.success ? 'Sent' : 'Failed',
        termiiResponse: smsResult,
        relatedId: parseInt(interactionData.leaseId),
        relatedType: 'lease',
        createdAt: new Date()
      });

      console.log(`Renewal request initiated for lease ${interactionData.leaseId}, request ID: ${renewalRequestId}`);
      return renewalRequestId.toString();
    } catch (error) {
      console.error('Error initiating renewal request:', error);
      throw error;
    }
  }

  /**
   * Process tenant response to renewal request
   */
  async processRenewalResponse(
    renewalRequestId: string, 
    response: 'YES' | 'NO',
    tenantPhone: string,
    additionalNotes?: string
  ): Promise<void> {
    try {
      // Get renewal request details
      const renewalResult = await db
        .select({
          renewal: renewalRequests,
          lease: leases,
          property: properties,
          tenant: tenants,
          landlord: landlords,
          location: locations
        })
        .from(renewalRequests)
        .leftJoin(leases, eq(renewalRequests.leaseId, leases.id))
        .leftJoin(properties, eq(leases.propertyId, properties.id))
        .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .where(eq(renewalRequests.id, parseInt(renewalRequestId)))
        .limit(1);

      if (!renewalResult.length) {
        throw new Error(`Renewal request not found: ${renewalRequestId}`);
      }

      const { renewal, lease, property, tenant, landlord, location } = renewalResult[0];

      if (!renewal || !lease || !property || !tenant || !landlord) {
        throw new Error('Incomplete renewal request data');
      }

      // Update renewal request status
      await db
        .update(renewalRequests)
        .set({
          status: response === 'YES' ? 'Accepted' : 'Declined',
          responseReceivedAt: new Date(),
          tenantResponse: response
        })
        .where(eq(renewalRequests.id, parseInt(renewalRequestId)));

      // Log the response
      await db.insert(messageResponses).values({
        messageId: 0, // We'll need to link this properly if needed
        responseText: response,
        responsePhone: tenantPhone,
        status: 'Processed',
        processedAt: new Date(),
        isValid: true
      });

      // Send confirmation to tenant
      await this.sendTenantConfirmation(tenant, property, response, location?.address);

      // Notify landlord of tenant's decision
      await this.notifyLandlordOfResponse(landlord, tenant, property, response, location?.address);

      // If accepted, initiate lease renewal process
      if (response === 'YES') {
        await this.initiateLeaseRenewal(lease.id.toString(), lease.rent);
      }

      console.log(`Processed renewal response: ${response} for request ${renewalRequestId}`);
    } catch (error) {
      console.error('Error processing renewal response:', error);
      throw error;
    }
  }

  /**
   * Send follow-up reminders for pending renewal requests
   */
  async sendRenewalReminders(): Promise<void> {
    try {
      // Get pending renewal requests that are approaching expiry
      const pendingRenewals = await db
        .select({
          renewal: renewalRequests,
          lease: leases,
          property: properties,
          tenant: tenants,
          location: locations
        })
        .from(renewalRequests)
        .leftJoin(leases, eq(renewalRequests.leaseId, leases.id))
        .leftJoin(properties, eq(leases.propertyId, properties.id))
        .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .where(
          and(
            eq(renewalRequests.status, 'Pending'),
            // Add condition for requests that need reminders
          )
        );

      for (const renewal of pendingRenewals) {
        if (!renewal.tenant || !renewal.property) continue;

        const daysUntilExpiry = Math.ceil(
          (new Date(renewal.renewal.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry <= 2 && daysUntilExpiry > 0) {
          const reminderMessage = `RENEWAL REMINDER\n\nDear ${renewal.tenant.name},\n\nYour lease renewal request for ${renewal.property.name} expires in ${daysUntilExpiry} day(s).\n\nPlease reply:\n• YES to renew\n• NO to decline\n\nHomematch`;

          await this.smsService.sendSMS(
            renewal.tenant.phoneNumber,
            reminderMessage
          );
        }
      }

      console.log(`Sent renewal reminders for ${pendingRenewals.length} pending requests`);
    } catch (error) {
      console.error('Error sending renewal reminders:', error);
      throw error;
    }
  }

  /**
   * Format renewal request message for tenant
   */
  private formatRenewalRequestMessage(data: RenewalInteractionData, requestId: string): string {
    const rentChange = data.newRentAmount && data.newRentAmount !== data.currentRent 
      ? `\nNew Rent: ₦${data.newRentAmount.toLocaleString()}/year`
      : '';

    return `🏠 LEASE RENEWAL REQUEST\n\nDear Tenant,\n\nYour lease for ${data.propertyName} (${data.propertyAddress}) expires on ${data.leaseEndDate.toLocaleDateString()}.\n\nCurrent Rent: ₦${data.currentRent.toLocaleString()}/year${rentChange}\n\nWould you like to renew your lease?\n\nReply:\n• YES to renew\n• NO to decline\n\nRequest expires in 7 days.\n\nRef: ${requestId}\nHomematch`;
  }

  /**
   * Send confirmation message to tenant
   */
  private async sendTenantConfirmation(
    tenant: any, 
    property: any, 
    response: 'YES' | 'NO',
    propertyAddress?: string
  ): Promise<void> {
    const message = response === 'YES' 
      ? `✅ RENEWAL CONFIRMED\n\nDear ${tenant.name},\n\nThank you for confirming your lease renewal for ${property.name}.\n\nNext steps:\n• Landlord will contact you with renewal documents\n• New lease terms will be finalized\n• Payment schedule will be updated\n\nHomematch`
      : `❌ RENEWAL DECLINED\n\nDear ${tenant.name},\n\nWe've received your decision to decline the lease renewal for ${property.name}.\n\nPlease ensure you:\n• Plan your move-out by the lease end date\n• Schedule property inspection\n• Arrange deposit refund process\n\nThank you for being our tenant.\n\nHomematch`;

    await this.smsService.sendSMS(
      tenant.phoneNumber,
      message
    );
  }

  /**
   * Notify landlord of tenant's response
   */
  private async notifyLandlordOfResponse(
    landlord: any,
    tenant: any,
    property: any,
    response: 'YES' | 'NO',
    propertyAddress?: string
  ): Promise<void> {
    const updateData = {
      landlordId: landlord.cognitoId,
      propertyName: property.name,
      propertyAddress: propertyAddress || 'Address not available',
      updateType: 'lease_renewal' as const,
      tenantName: tenant.name,
      details: response === 'YES' 
        ? `${tenant.name} has ACCEPTED the lease renewal. Please prepare renewal documents.`
        : `${tenant.name} has DECLINED the lease renewal. Property will be available for new tenants.`
    };

    await this.landlordService.sendPropertyUpdate(updateData);
  }

  /**
   * Initiate lease renewal process
   */
  private async initiateLeaseRenewal(leaseId: string, newRentAmount: number): Promise<void> {
    try {
      // This would typically involve:
      // 1. Creating a new lease record
      // 2. Updating property status
      // 3. Generating new lease documents
      // 4. Setting up new payment schedule
      
      console.log(`Initiating lease renewal for lease ${leaseId} with rent ₦${newRentAmount}`);
      
      // For now, we'll just log this - full implementation would depend on business requirements
    } catch (error) {
      console.error('Error initiating lease renewal:', error);
      throw error;
    }
  }

  /**
   * Get renewal request statistics
   */
  async getRenewalStats(): Promise<{
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
  }> {
    try {
      const stats = await db
        .select({
          status: renewalRequests.status
        })
        .from(renewalRequests);

      const result = {
        pending: 0,
        accepted: 0,
        declined: 0,
        expired: 0
      };

      for (const stat of stats) {
        switch (stat.status) {
          case 'Pending':
            result.pending++;
            break;
          case 'Accepted':
            result.accepted++;
            break;
          case 'Declined':
            result.declined++;
            break;
          case 'Expired':
            result.expired++;
            break;
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting renewal stats:', error);
      throw error;
    }
  }
}