"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.ActivityType = exports.NotificationPriority = exports.NotificationType = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
var NotificationType;
(function (NotificationType) {
    NotificationType["PropertyUpdate"] = "PropertyUpdate";
    NotificationType["ApplicationStatus"] = "ApplicationStatus";
    NotificationType["PaymentReminder"] = "PaymentReminder";
    NotificationType["InspectionScheduled"] = "InspectionScheduled";
    NotificationType["LeaseExpiring"] = "LeaseExpiring";
    NotificationType["MaintenanceRequest"] = "MaintenanceRequest";
    NotificationType["SystemAlert"] = "SystemAlert";
    NotificationType["Welcome"] = "Welcome";
    NotificationType["General"] = "General";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["Low"] = "Low";
    NotificationPriority["Medium"] = "Medium";
    NotificationPriority["High"] = "High";
    NotificationPriority["Urgent"] = "Urgent";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
var ActivityType;
(function (ActivityType) {
    ActivityType["PropertyCreated"] = "PropertyCreated";
    ActivityType["PropertyUpdated"] = "PropertyUpdated";
    ActivityType["PropertyDeleted"] = "PropertyDeleted";
    ActivityType["ApplicationSubmitted"] = "ApplicationSubmitted";
    ActivityType["ApplicationApproved"] = "ApplicationApproved";
    ActivityType["ApplicationDenied"] = "ApplicationDenied";
    ActivityType["LeaseCreated"] = "LeaseCreated";
    ActivityType["LeaseExpired"] = "LeaseExpired";
    ActivityType["PaymentMade"] = "PaymentMade";
    ActivityType["PaymentOverdue"] = "PaymentOverdue";
    ActivityType["InspectionScheduled"] = "InspectionScheduled";
    ActivityType["InspectionCompleted"] = "InspectionCompleted";
    ActivityType["TenantRegistered"] = "TenantRegistered";
    ActivityType["LandlordRegistered"] = "LandlordRegistered";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
class NotificationService {
    constructor() {
    }
    async createNotification(data) {
        const [notification] = await database_1.db.insert(database_1.notifications).values({
            title: data.title,
            message: data.message,
            type: data.type,
            priority: data.priority || NotificationPriority.Medium,
            recipientId: data.recipientId,
            recipientType: data.recipientType,
            relatedId: data.relatedId,
            relatedType: data.relatedType,
            actionUrl: data.actionUrl,
            actionText: data.actionText,
            metadata: data.metadata,
            expiresAt: data.expiresAt
        }).returning();
        return notification;
    }
    async createActivity(data) {
        const [activity] = await database_1.db.insert(database_1.activityFeeds).values({
            type: data.type,
            title: data.title,
            description: data.description,
            actorId: data.actorId,
            actorType: data.actorType,
            actorName: data.actorName,
            targetId: data.targetId,
            targetType: data.targetType,
            metadata: data.metadata,
            isPublic: data.isPublic || false
        }).returning();
        return activity;
    }
    async createPropertyUpdateNotification(data) {
        const notifications = [];
        const landlordNotification = await this.createNotification({
            title: 'Property Updated',
            message: `Your property "${data.propertyName}" has been updated: ${data.updateType}`,
            type: NotificationType.PropertyUpdate,
            priority: NotificationPriority.Medium,
            recipientId: data.landlordId,
            recipientType: 'landlord',
            relatedId: data.propertyId,
            relatedType: 'property',
            actionUrl: `/dashboard/properties/${data.propertyId}`,
            actionText: 'View Property'
        });
        notifications.push(landlordNotification);
        if (data.tenantIds && data.tenantIds.length > 0) {
            for (const tenantId of data.tenantIds) {
                const tenantNotification = await this.createNotification({
                    title: 'Property Update',
                    message: `The property "${data.propertyName}" has been updated: ${data.updateType}`,
                    type: NotificationType.PropertyUpdate,
                    priority: NotificationPriority.Medium,
                    recipientId: tenantId,
                    recipientType: 'tenant',
                    relatedId: data.propertyId,
                    relatedType: 'property',
                    actionUrl: `/dashboard/properties/${data.propertyId}`,
                    actionText: 'View Property'
                });
                notifications.push(tenantNotification);
            }
        }
        await this.createActivity({
            type: ActivityType.PropertyUpdated,
            title: 'Property Updated',
            description: `Property "${data.propertyName}" was updated: ${data.updateType}`,
            actorId: data.landlordId,
            actorType: 'landlord',
            actorName: 'Landlord',
            targetId: data.propertyId,
            targetType: 'property',
            metadata: {
                updateType: data.updateType,
                propertyName: data.propertyName
            },
            isPublic: true
        });
        return notifications;
    }
    async createApplicationStatusNotification(data) {
        const notifications = [];
        const tenantNotification = await this.createNotification({
            title: 'Application Status Update',
            message: `Your application for "${data.propertyName}" has been ${data.status.toLowerCase()}`,
            type: NotificationType.ApplicationStatus,
            priority: NotificationPriority.High,
            recipientId: data.tenantId,
            recipientType: 'tenant',
            relatedId: data.applicationId,
            relatedType: 'application',
            actionUrl: `/dashboard/applications/${data.applicationId}`,
            actionText: 'View Application'
        });
        notifications.push(tenantNotification);
        const landlordNotification = await this.createNotification({
            title: 'Application Updated',
            message: `Application from ${data.tenantName} for "${data.propertyName}" has been ${data.status.toLowerCase()}`,
            type: NotificationType.ApplicationStatus,
            priority: NotificationPriority.Medium,
            recipientId: data.landlordId,
            recipientType: 'landlord',
            relatedId: data.applicationId,
            relatedType: 'application',
            actionUrl: `/dashboard/applications/${data.applicationId}`,
            actionText: 'View Application'
        });
        notifications.push(landlordNotification);
        const activityType = data.status === 'Approved' ? ActivityType.ApplicationApproved :
            data.status === 'Denied' ? ActivityType.ApplicationDenied :
                ActivityType.ApplicationSubmitted;
        await this.createActivity({
            type: activityType,
            title: `Application ${data.status}`,
            description: `Application from ${data.tenantName} for "${data.propertyName}" was ${data.status.toLowerCase()}`,
            actorId: data.landlordId,
            actorType: 'landlord',
            actorName: 'Landlord',
            targetId: data.applicationId,
            targetType: 'application',
            metadata: {
                tenantName: data.tenantName,
                propertyName: data.propertyName,
                status: data.status
            },
            isPublic: false
        });
        return notifications;
    }
    async createPaymentNotification(data) {
        const notification = await this.createNotification({
            title: 'Payment Due',
            message: `Your payment of ₦${data.amount.toLocaleString()} is due on ${data.dueDate.toLocaleDateString()}`,
            type: NotificationType.PaymentReminder,
            priority: NotificationPriority.High,
            recipientId: data.recipientId,
            recipientType: data.recipientType,
            relatedId: data.leaseId || data.propertyId,
            relatedType: data.leaseId ? 'lease' : 'property',
            actionUrl: `/dashboard/payments`,
            actionText: 'View Payment',
            expiresAt: data.dueDate
        });
        await this.createActivity({
            type: ActivityType.PaymentMade,
            title: 'Payment Due',
            description: `Payment of ₦${data.amount.toLocaleString()} is due`,
            actorId: 'system',
            actorType: 'system',
            actorName: 'System',
            targetId: data.leaseId || data.propertyId,
            targetType: data.leaseId ? 'lease' : 'property',
            metadata: {
                amount: data.amount,
                dueDate: data.dueDate,
                currency: 'NGN'
            }
        });
        return notification;
    }
    async createInspectionNotification(data) {
        const notifications = [];
        const tenantNotification = await this.createNotification({
            title: 'Inspection Scheduled',
            message: `Your inspection for "${data.propertyName}" is scheduled for ${data.scheduledDate.toLocaleDateString()}`,
            type: NotificationType.InspectionScheduled,
            priority: NotificationPriority.High,
            recipientId: data.tenantId,
            recipientType: 'tenant',
            relatedId: data.inspectionId,
            relatedType: 'inspection',
            actionUrl: `/dashboard/inspections/${data.inspectionId}`,
            actionText: 'View Inspection'
        });
        notifications.push(tenantNotification);
        const landlordNotification = await this.createNotification({
            title: 'Inspection Scheduled',
            message: `Inspection for "${data.propertyName}" with ${data.tenantName} is scheduled for ${data.scheduledDate.toLocaleDateString()}`,
            type: NotificationType.InspectionScheduled,
            priority: NotificationPriority.Medium,
            recipientId: data.landlordId,
            recipientType: 'landlord',
            relatedId: data.inspectionId,
            relatedType: 'inspection',
            actionUrl: `/dashboard/inspections/${data.inspectionId}`,
            actionText: 'View Inspection'
        });
        notifications.push(landlordNotification);
        if (data.agentId) {
            const agentNotification = await this.createNotification({
                title: 'Inspection Assignment',
                message: `You have been assigned an inspection for "${data.propertyName}" on ${data.scheduledDate.toLocaleDateString()}`,
                type: NotificationType.InspectionScheduled,
                priority: NotificationPriority.High,
                recipientId: data.agentId,
                recipientType: 'agent',
                relatedId: data.inspectionId,
                relatedType: 'inspection',
                actionUrl: `/dashboard/inspections/${data.inspectionId}`,
                actionText: 'View Inspection'
            });
            notifications.push(agentNotification);
        }
        await this.createActivity({
            type: ActivityType.InspectionScheduled,
            title: 'Inspection Scheduled',
            description: `Inspection for "${data.propertyName}" scheduled with ${data.tenantName}`,
            actorId: data.tenantId,
            actorType: 'tenant',
            actorName: data.tenantName,
            targetId: data.inspectionId,
            targetType: 'inspection',
            metadata: {
                propertyName: data.propertyName,
                scheduledDate: data.scheduledDate
            },
            isPublic: false
        });
        return notifications;
    }
    async createLeaseExpiringNotification(data) {
        const notifications = [];
        const tenantNotification = await this.createNotification({
            title: 'Lease Expiring Soon',
            message: `Your lease for "${data.propertyName}" expires on ${data.expiryDate.toLocaleDateString()}`,
            type: NotificationType.LeaseExpiring,
            priority: NotificationPriority.High,
            recipientId: data.tenantId,
            recipientType: 'tenant',
            relatedId: data.leaseId,
            relatedType: 'lease',
            actionUrl: `/dashboard/leases/${data.leaseId}`,
            actionText: 'View Lease',
            expiresAt: data.expiryDate
        });
        notifications.push(tenantNotification);
        const landlordNotification = await this.createNotification({
            title: 'Lease Expiring Soon',
            message: `Lease for "${data.propertyName}" with ${data.tenantName} expires on ${data.expiryDate.toLocaleDateString()}`,
            type: NotificationType.LeaseExpiring,
            priority: NotificationPriority.High,
            recipientId: data.landlordId,
            recipientType: 'landlord',
            relatedId: data.leaseId,
            relatedType: 'lease',
            actionUrl: `/dashboard/leases/${data.leaseId}`,
            actionText: 'View Lease',
            expiresAt: data.expiryDate
        });
        notifications.push(landlordNotification);
        return notifications;
    }
    async createWelcomeNotification(data) {
        const notification = await this.createNotification({
            title: 'Welcome to HomeMatch!',
            message: `Welcome ${data.recipientName}! We're excited to have you on our platform.`,
            type: NotificationType.Welcome,
            priority: NotificationPriority.Medium,
            recipientId: data.recipientId,
            recipientType: data.recipientType,
            actionUrl: `/dashboard`,
            actionText: 'Explore Dashboard'
        });
        const activityType = data.recipientType === 'tenant' ? ActivityType.TenantRegistered :
            ActivityType.LandlordRegistered;
        await this.createActivity({
            type: activityType,
            title: `New ${data.recipientType} joined`,
            description: `${data.recipientName} joined as a ${data.recipientType}`,
            actorId: data.recipientId,
            actorType: data.recipientType,
            actorName: data.recipientName,
            metadata: {
                userType: data.recipientType
            },
            isPublic: true
        });
        return notification;
    }
    async markAsRead(notificationId, userId) {
        const [notification] = await database_1.db.update(database_1.notifications)
            .set({ isRead: true })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.notifications.id, notificationId), (0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId)))
            .returning();
        return notification;
    }
    async getUserNotifications(userId, limit = 20, offset = 0) {
        return await database_1.db.select().from(database_1.notifications)
            .where((0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId))
            .orderBy((0, drizzle_orm_1.desc)(database_1.notifications.createdAt))
            .limit(limit)
            .offset(offset);
    }
    async getUnreadCount(userId) {
        const result = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(database_1.notifications)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId), (0, drizzle_orm_1.eq)(database_1.notifications.isRead, false)));
        return result[0]?.count || 0;
    }
    async getActivityFeed(limit = 50, offset = 0, isPublic = true) {
        return await database_1.db.select().from(database_1.activityFeeds)
            .where((0, drizzle_orm_1.eq)(database_1.activityFeeds.isPublic, isPublic))
            .orderBy((0, drizzle_orm_1.desc)(database_1.activityFeeds.createdAt))
            .limit(limit)
            .offset(offset);
    }
    async deleteExpiredNotifications() {
        const now = new Date();
        const result = await database_1.db.delete(database_1.notifications)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNotNull)(database_1.notifications.expiresAt), (0, drizzle_orm_1.lt)(database_1.notifications.expiresAt, now)));
        return { count: result.rowCount };
    }
}
exports.NotificationService = NotificationService;
exports.default = NotificationService;
