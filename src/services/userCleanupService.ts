import { eq, and, lte, isNotNull, inArray } from 'drizzle-orm';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import {
  db,
  users,
  tenants,
  landlords,
  agents,
  admins,
  sessions,
  accounts,
  verifications,
  properties,
  applications,
  leases,
  payments,
  tasks,
  agentProperties,
  tenantFavorites,
  tenantProperties,
  inspections,
  inspectionLimits,
  withdrawals,
  notifications,
  activityFeeds,
  smsMessages,
  messageAuditLog,
  renewalRequests,
  landlordTenantRentals,
  bloggers,
  blogPosts,
  blogPostTags,
  saleUsers,
  realEstateCompanies,
  saleListings,
  saleListingDocuments,
  saleSellers,
  saleVerifications,
  saleListingAuditLog,
  jobs,
  jobApplications,
  jobApplicationRatings,
  tenantEditAuditLog,
  emailSubscriptions,
  tenantSurveys,
  landlordSurveys,
} from '../utils/database';

export class UserCleanupService {
  private static instance: UserCleanupService;
  private cleanupJob: cron.ScheduledTask | null = null;

  private constructor() {}

  public static getInstance(): UserCleanupService {
    if (!UserCleanupService.instance) {
      UserCleanupService.instance = new UserCleanupService();
    }
    return UserCleanupService.instance;
  }

  /**
   * Start the cleanup service that runs every minute to check for expired unverified users
   */
  public startCleanupService(): void {
    if (this.cleanupJob) {
      logger.warn('Cleanup service is already running');
      return;
    }

    // Run every minute to check for expired users
    this.cleanupJob = cron.schedule('* * * * *', async () => {
      await this.cleanupExpiredUsers();
    });

    logger.info('User cleanup service started - checking every minute for expired unverified users');
  }

  /**
   * Stop the cleanup service
   */
  public stopCleanupService(): void {
    if (this.cleanupJob) {
      this.cleanupJob.destroy();
      this.cleanupJob = null;
      logger.info('User cleanup service stopped');
    }
  }

  /**
   * Clean up users who have not verified their email within 10 minutes
   */
  private async cleanupExpiredUsers(): Promise<void> {
    let foundUsers = 0;
    let deletedUsers = 0;
    let errors = 0;

    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      // Find unverified users whose verification was initiated more than 10 minutes ago
      // Add retry logic for database queries
      let expiredUsers: any[] = [];
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          expiredUsers = await db.select({
            id: users.id,
            email: users.email,
            verificationInitiatedAt: users.verificationInitiatedAt
          }).from(users)
            .where(and(
              eq(users.emailVerified, false),
              isNotNull(users.verificationInitiatedAt),
              lte(users.verificationInitiatedAt, tenMinutesAgo)
            ));
          break; // Success, exit retry loop
        } catch (queryError) {
          retryCount++;
          logger.warn(`Database query attempt ${retryCount} failed:`, queryError);
          
          if (retryCount >= maxRetries) {
            throw queryError; // Re-throw after max retries
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }

      foundUsers = expiredUsers.length;

      if (foundUsers > 0) {
        logger.info(`Found ${foundUsers} expired unverified users to delete`);

        for (const user of expiredUsers) {
          try {
            await this.deleteUserAndAssociatedData(user.id, user.email, 'verification_timeout');
            deletedUsers++;
          } catch (error) {
            errors++;
            logger.error(
              `Failed to delete expired user during cleanup`,
              error,
              user.id,
              user.email
            );
          }
        }
      }
    } catch (error) {
      logger.error('Error during user cleanup service run', error);
      errors++;
    } finally {
      // Log cleanup run statistics
      if (foundUsers > 0 || errors > 0) {
        logger.logCleanupRun(foundUsers, deletedUsers, errors);
      }
    }
  }

  /**
   * Delete a specific user immediately (for page refresh scenario)
   */
  public async deleteUserOnRefresh(userId: string, email: string): Promise<void> {
    try {
      await this.deleteUserAndAssociatedData(userId, email, 'page_refresh');
      logger.info('User deletion on refresh completed successfully', undefined, userId, email);
    } catch (error) {
      logger.error('Error deleting user on refresh', error, userId, email);
      throw error;
    }
  }

  /**
   * Delete user and all associated data
   */
  public async deleteUserAndAssociatedData(
    userId: string,
    email: string,
    reason: 'verification_timeout' | 'page_refresh' | 'admin_delete'
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Use a transaction to ensure all deletions happen atomically
      await db.transaction(async (tx) => {
        const tenantProfiles = await tx.select().from(tenants).where(eq(tenants.userId, userId));
        const landlordProfiles = await tx.select().from(landlords).where(eq(landlords.userId, userId));
        const agentProfiles = await tx.select().from(agents).where(eq(agents.userId, userId));
        const adminProfiles = await tx.select().from(admins).where(eq(admins.userId, userId));
        const bloggerProfiles = await tx.select().from(bloggers).where(eq(bloggers.userId, userId));
        const saleUserProfiles = await tx.select().from(saleUsers).where(eq(saleUsers.userId, userId));
        const realEstateCompanyProfiles = await tx
          .select()
          .from(realEstateCompanies)
          .where(eq(realEstateCompanies.userId, userId));

        const tenantIds = tenantProfiles.map((t) => t.id);
        const landlordIds = landlordProfiles.map((l) => l.id);
        const agentIds = agentProfiles.map((a) => a.id);
        const tenantCognitoIds = tenantProfiles.map((t) => t.cognitoId);
        const landlordCognitoIds = landlordProfiles.map((l) => l.cognitoId);

        let propertyIds: number[] = [];
        if (landlordCognitoIds.length > 0) {
          const propertyRows = await tx
            .select({ id: properties.id })
            .from(properties)
            .where(inArray(properties.landlordCognitoId, landlordCognitoIds));
          propertyIds = propertyRows.map((p) => p.id);
        }

        let leaseIds: number[] = [];
        let applicationIds: number[] = [];

        if (tenantCognitoIds.length > 0) {
          const leaseRows = await tx
            .select({ id: leases.id })
            .from(leases)
            .where(inArray(leases.tenantCognitoId, tenantCognitoIds));
          leaseIds = leaseRows.map((l) => l.id);

          const applicationRows = await tx
            .select({ id: applications.id })
            .from(applications)
            .where(inArray(applications.tenantCognitoId, tenantCognitoIds));
          applicationIds = applicationRows.map((a) => a.id);
        }

        if (propertyIds.length > 0) {
          const leaseRowsByProperty = await tx
            .select({ id: leases.id })
            .from(leases)
            .where(inArray(leases.propertyId, propertyIds));
          const leasesFromProperties = leaseRowsByProperty.map((l) => l.id);
          leaseIds = [...new Set([...leaseIds, ...leasesFromProperties])];

          const applicationRowsByProperty = await tx
            .select({ id: applications.id })
            .from(applications)
            .where(inArray(applications.propertyId, propertyIds));
          const applicationsFromProperties = applicationRowsByProperty.map((a) => a.id);
          applicationIds = [...new Set([...applicationIds, ...applicationsFromProperties])];
        }

        if (leaseIds.length > 0) {
          await tx.delete(payments).where(inArray(payments.leaseId, leaseIds));
        }

        if (applicationIds.length > 0) {
          await tx.delete(payments).where(inArray(payments.applicationId, applicationIds));
        }

        if (leaseIds.length > 0) {
          await tx.delete(leases).where(inArray(leases.id, leaseIds));
        }

        if (applicationIds.length > 0) {
          await tx.delete(applications).where(inArray(applications.id, applicationIds));
        }

        if (tenantIds.length > 0) {
          await tx.delete(tenantFavorites).where(inArray(tenantFavorites.tenantId, tenantIds));
          await tx.delete(tenantProperties).where(inArray(tenantProperties.tenantId, tenantIds));
          await tx
            .delete(landlordTenantRentals)
            .where(inArray(landlordTenantRentals.tenantId, tenantIds));
          await tx.delete(tenantEditAuditLog).where(inArray(tenantEditAuditLog.tenantId, tenantIds));
          await tx.delete(renewalRequests).where(inArray(renewalRequests.tenantId, tenantIds));
        }

        if (landlordIds.length > 0) {
          await tx
            .delete(landlordTenantRentals)
            .where(inArray(landlordTenantRentals.landlordId, landlordIds));
          await tx
            .delete(tenantEditAuditLog)
            .where(inArray(tenantEditAuditLog.landlordId, landlordIds));
          await tx.delete(renewalRequests).where(inArray(renewalRequests.landlordId, landlordIds));
        }

        if (propertyIds.length > 0) {
          await tx.delete(tenantProperties).where(inArray(tenantProperties.propertyId, propertyIds));
          await tx.delete(agentProperties).where(inArray(agentProperties.propertyId, propertyIds));
          await tx.delete(inspections).where(inArray(inspections.propertyId, propertyIds));
          await tx.delete(renewalRequests).where(inArray(renewalRequests.propertyId, propertyIds));
          await tx.delete(properties).where(inArray(properties.id, propertyIds));
        }

        if (tenantCognitoIds.length > 0) {
          await tx.delete(inspections).where(inArray(inspections.tenantCognitoId, tenantCognitoIds));
          await tx
            .delete(inspectionLimits)
            .where(inArray(inspectionLimits.tenantCognitoId, tenantCognitoIds));
        }

        if (landlordCognitoIds.length > 0) {
          await tx
            .delete(withdrawals)
            .where(inArray(withdrawals.landlordCognitoId, landlordCognitoIds));
        }

        if (agentIds.length > 0) {
          await tx.delete(tasks).where(inArray(tasks.agentId, agentIds));
          await tx.delete(agentProperties).where(inArray(agentProperties.agentId, agentIds));
          await tx.delete(inspections).where(inArray(inspections.agentId, agentIds));
        }

        const bloggerIds = bloggerProfiles.map((b) => b.id);
        if (bloggerIds.length > 0) {
          const blogPostRows = await tx
            .select({ id: blogPosts.id })
            .from(blogPosts)
            .where(eq(blogPosts.authorUserId, userId));
          const blogPostIds = blogPostRows.map((p) => p.id);
          if (blogPostIds.length > 0) {
            await tx.delete(blogPostTags).where(inArray(blogPostTags.postId, blogPostIds));
            await tx.delete(blogPosts).where(inArray(blogPosts.id, blogPostIds));
          }
          await tx.delete(bloggers).where(inArray(bloggers.id, bloggerIds));
        }

        if (saleUserProfiles.length > 0 || realEstateCompanyProfiles.length > 0) {
          const listingRows = await tx
            .select({ id: saleListings.id })
            .from(saleListings)
            .where(eq(saleListings.createdByUserId, userId));
          const listingIds = listingRows.map((l) => l.id);
          if (listingIds.length > 0) {
            await tx
              .delete(saleListingDocuments)
              .where(inArray(saleListingDocuments.listingId, listingIds));
            await tx.delete(saleSellers).where(inArray(saleSellers.listingId, listingIds));
            await tx
              .delete(saleVerifications)
              .where(inArray(saleVerifications.listingId, listingIds));
            await tx
              .delete(saleListingAuditLog)
              .where(inArray(saleListingAuditLog.listingId, listingIds));
            await tx.delete(saleListings).where(inArray(saleListings.id, listingIds));
          }

          const saleUserIds = saleUserProfiles.map((s) => s.id);
          if (saleUserIds.length > 0) {
            await tx.delete(saleUsers).where(inArray(saleUsers.id, saleUserIds));
          }

          const realEstateCompanyIds = realEstateCompanyProfiles.map((r) => r.id);
          if (realEstateCompanyIds.length > 0) {
            await tx
              .delete(realEstateCompanies)
              .where(inArray(realEstateCompanies.id, realEstateCompanyIds));
          }
        }

        if (email) {
          await tx.delete(emailSubscriptions).where(eq(emailSubscriptions.email, email));
          await tx.delete(tenantSurveys).where(eq(tenantSurveys.email, email));
          await tx.delete(landlordSurveys).where(eq(landlordSurveys.email, email));
        }

        const deletedTenants = await tx.delete(tenants)
          .where(eq(tenants.userId, userId));

        const deletedLandlords = await tx.delete(landlords)
          .where(eq(landlords.userId, userId));

        const deletedAgents = await tx.delete(agents)
          .where(eq(agents.userId, userId));

        const deletedAdmins = await tx.delete(admins)
          .where(eq(admins.userId, userId));

        // Delete user sessions
        const deletedSessions = await tx.delete(sessions)
          .where(eq(sessions.userId, userId));

        // Delete user accounts
        const deletedAccounts = await tx.delete(accounts)
          .where(eq(accounts.userId, userId));

        // Delete user verifications
        const deletedVerifications = await tx.delete(verifications)
          .where(eq(verifications.userId, userId));

        // Finally delete the user
        await tx.delete(users)
          .where(eq(users.id, userId));

        // Log deletion details
        const deletionData = {
          deletedProfiles: {
            tenants: deletedTenants.rowCount || 0,
            landlords: deletedLandlords.rowCount || 0,
            agents: deletedAgents.rowCount || 0,
            admins: deletedAdmins.rowCount || 0,
          },
          deletedSessions: deletedSessions.rowCount || 0,
          deletedAccounts: deletedAccounts.rowCount || 0,
          deletedVerifications: deletedVerifications.rowCount || 0,
          executionTimeMs: Date.now() - startTime,
        };

        logger.info(
          `User deletion transaction completed`,
          deletionData,
          userId,
          email
        );
      });

      logger.logUserDeletion(userId, email, reason, true);
    } catch (error) {
      logger.logUserDeletion(userId, email, reason, false, error);
      throw error;
    }
  }

  /**
   * Check if a user should be deleted due to verification timeout
   */
  public async shouldDeleteUser(userId: string): Promise<boolean> {
    try {
      const userResult = await db.select({
        emailVerified: users.emailVerified,
        verificationInitiatedAt: users.verificationInitiatedAt
      }).from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      const user = userResult[0];

      if (!user) {
        logger.warn('User not found when checking deletion eligibility', undefined, userId);
        return false;
      }

      if (user.emailVerified) {
        return false; // User is already verified
      }

      if (!user.verificationInitiatedAt) {
        logger.warn('User has no verification timestamp', undefined, userId);
        return false;
      }

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const shouldDelete = user.verificationInitiatedAt <= tenMinutesAgo;
      
      if (shouldDelete) {
        logger.info(
          'User eligible for deletion due to verification timeout',
          {
            verificationInitiatedAt: user.verificationInitiatedAt,
            timeElapsedMinutes: Math.floor((Date.now() - user.verificationInitiatedAt.getTime()) / (1000 * 60))
          },
          userId
        );
      }
      
      return shouldDelete;
    } catch (error) {
      logger.error('Error checking if user should be deleted', error, userId);
      return false;
    }
  }
}

export const userCleanupService = UserCleanupService.getInstance();
