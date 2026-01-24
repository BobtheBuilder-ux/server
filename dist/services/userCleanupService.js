"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userCleanupService = exports.UserCleanupService = void 0;
const tslib_1 = require("tslib");
const drizzle_orm_1 = require("drizzle-orm");
const cron = tslib_1.__importStar(require("node-cron"));
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
class UserCleanupService {
    constructor() {
        this.cleanupJob = null;
    }
    static getInstance() {
        if (!UserCleanupService.instance) {
            UserCleanupService.instance = new UserCleanupService();
        }
        return UserCleanupService.instance;
    }
    startCleanupService() {
        if (this.cleanupJob) {
            logger_1.logger.warn('Cleanup service is already running');
            return;
        }
        this.cleanupJob = cron.schedule('* * * * *', async () => {
            await this.cleanupExpiredUsers();
        });
        logger_1.logger.info('User cleanup service started - checking every minute for expired unverified users');
    }
    stopCleanupService() {
        if (this.cleanupJob) {
            this.cleanupJob.destroy();
            this.cleanupJob = null;
            logger_1.logger.info('User cleanup service stopped');
        }
    }
    async cleanupExpiredUsers() {
        let foundUsers = 0;
        let deletedUsers = 0;
        let errors = 0;
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            let expiredUsers = [];
            let retryCount = 0;
            const maxRetries = 3;
            while (retryCount < maxRetries) {
                try {
                    expiredUsers = await database_1.db.select({
                        id: database_1.users.id,
                        email: database_1.users.email,
                        verificationInitiatedAt: database_1.users.verificationInitiatedAt
                    }).from(database_1.users)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.emailVerified, false), (0, drizzle_orm_1.isNotNull)(database_1.users.verificationInitiatedAt), (0, drizzle_orm_1.lte)(database_1.users.verificationInitiatedAt, tenMinutesAgo)));
                    break;
                }
                catch (queryError) {
                    retryCount++;
                    logger_1.logger.warn(`Database query attempt ${retryCount} failed:`, queryError);
                    if (retryCount >= maxRetries) {
                        throw queryError;
                    }
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                }
            }
            foundUsers = expiredUsers.length;
            if (foundUsers > 0) {
                logger_1.logger.info(`Found ${foundUsers} expired unverified users to delete`);
                for (const user of expiredUsers) {
                    try {
                        await this.deleteUserAndAssociatedData(user.id, user.email, 'verification_timeout');
                        deletedUsers++;
                    }
                    catch (error) {
                        errors++;
                        logger_1.logger.error(`Failed to delete expired user during cleanup`, error, user.id, user.email);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error during user cleanup service run', error);
            errors++;
        }
        finally {
            if (foundUsers > 0 || errors > 0) {
                logger_1.logger.logCleanupRun(foundUsers, deletedUsers, errors);
            }
        }
    }
    async deleteUserOnRefresh(userId, email) {
        try {
            await this.deleteUserAndAssociatedData(userId, email, 'page_refresh');
            logger_1.logger.info('User deletion on refresh completed successfully', undefined, userId, email);
        }
        catch (error) {
            logger_1.logger.error('Error deleting user on refresh', error, userId, email);
            throw error;
        }
    }
    async deleteUserAndAssociatedData(userId, email, reason) {
        const startTime = Date.now();
        try {
            await database_1.db.transaction(async (tx) => {
                const deletedTenants = await tx.delete(database_1.tenants)
                    .where((0, drizzle_orm_1.eq)(database_1.tenants.userId, userId));
                const deletedLandlords = await tx.delete(database_1.landlords)
                    .where((0, drizzle_orm_1.eq)(database_1.landlords.userId, userId));
                const deletedAgents = await tx.delete(database_1.agents)
                    .where((0, drizzle_orm_1.eq)(database_1.agents.userId, userId));
                const deletedAdmins = await tx.delete(database_1.admins)
                    .where((0, drizzle_orm_1.eq)(database_1.admins.userId, userId));
                const deletedSessions = await tx.delete(database_1.sessions)
                    .where((0, drizzle_orm_1.eq)(database_1.sessions.userId, userId));
                const deletedAccounts = await tx.delete(database_1.accounts)
                    .where((0, drizzle_orm_1.eq)(database_1.accounts.userId, userId));
                const deletedVerifications = await tx.delete(database_1.verifications)
                    .where((0, drizzle_orm_1.eq)(database_1.verifications.userId, userId));
                await tx.delete(database_1.users)
                    .where((0, drizzle_orm_1.eq)(database_1.users.id, userId));
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
                logger_1.logger.info(`User deletion transaction completed`, deletionData, userId, email);
            });
            logger_1.logger.logUserDeletion(userId, email, reason, true);
        }
        catch (error) {
            logger_1.logger.logUserDeletion(userId, email, reason, false, error);
            throw error;
        }
    }
    async shouldDeleteUser(userId) {
        try {
            const userResult = await database_1.db.select({
                emailVerified: database_1.users.emailVerified,
                verificationInitiatedAt: database_1.users.verificationInitiatedAt
            }).from(database_1.users)
                .where((0, drizzle_orm_1.eq)(database_1.users.id, userId))
                .limit(1);
            const user = userResult[0];
            if (!user) {
                logger_1.logger.warn('User not found when checking deletion eligibility', undefined, userId);
                return false;
            }
            if (user.emailVerified) {
                return false;
            }
            if (!user.verificationInitiatedAt) {
                logger_1.logger.warn('User has no verification timestamp', undefined, userId);
                return false;
            }
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const shouldDelete = user.verificationInitiatedAt <= tenMinutesAgo;
            if (shouldDelete) {
                logger_1.logger.info('User eligible for deletion due to verification timeout', {
                    verificationInitiatedAt: user.verificationInitiatedAt,
                    timeElapsedMinutes: Math.floor((Date.now() - user.verificationInitiatedAt.getTime()) / (1000 * 60))
                }, userId);
            }
            return shouldDelete;
        }
        catch (error) {
            logger_1.logger.error('Error checking if user should be deleted', error, userId);
            return false;
        }
    }
}
exports.UserCleanupService = UserCleanupService;
exports.userCleanupService = UserCleanupService.getInstance();
