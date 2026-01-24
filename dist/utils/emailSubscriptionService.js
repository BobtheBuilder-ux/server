"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdminWelcomeEmail = exports.sendLandlordWelcomeEmail = exports.sendTenantWelcomeEmail = exports.sendInspectionApprovedEmail = exports.sendInspectionRequestEmail = exports.getEmailSubscriptions = exports.unsubscribeFromEmailList = exports.sendWelcomeEmail = exports.sendSurveyConfirmationEmail = exports.addToEmailList = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const emailService_1 = require("./emailService");
const emailTemplates_1 = require("./emailTemplates");
const database_1 = require("./database");
const addToEmailList = async (data) => {
    try {
        const existingSubscriptionResult = await database_1.db.select().from(database_1.emailSubscriptions)
            .where((0, drizzle_orm_1.eq)(database_1.emailSubscriptions.email, data.email))
            .limit(1);
        const existingSubscription = existingSubscriptionResult[0];
        if (existingSubscription) {
            if (!existingSubscription.isActive) {
                await database_1.db.update(database_1.emailSubscriptions)
                    .set({
                    isActive: true,
                    subscriptionType: data.subscriptionType,
                    fullName: data.fullName,
                    subscribedAt: new Date(),
                    unsubscribedAt: null
                })
                    .where((0, drizzle_orm_1.eq)(database_1.emailSubscriptions.email, data.email));
                console.log(`Reactivated email subscription for: ${data.email}`);
            }
            else {
                console.log(`Email already subscribed: ${data.email}`);
            }
        }
        else {
            await database_1.db.insert(database_1.emailSubscriptions).values({
                email: data.email,
                fullName: data.fullName,
                subscriptionType: data.subscriptionType,
                isActive: true
            });
            console.log(`Added new email subscription: ${data.email}`);
        }
    }
    catch (error) {
        console.error('Error adding to email list:', error);
        throw error;
    }
};
exports.addToEmailList = addToEmailList;
const sendSurveyConfirmationEmail = async (email, fullName, surveyType) => {
    try {
        const template = emailTemplates_1.surveyConfirmationTemplate[surveyType];
        await (0, emailService_1.sendEmail)({
            to: email,
            subject: template.subject,
            body: template.body(fullName)
        });
        console.log(`Survey confirmation email sent to: ${email}`);
    }
    catch (error) {
        console.error('Error sending survey confirmation email:', error);
        throw error;
    }
};
exports.sendSurveyConfirmationEmail = sendSurveyConfirmationEmail;
const sendWelcomeEmail = async (email, fullName, subscriptionType) => {
    try {
        await (0, emailService_1.sendEmail)({
            to: email,
            subject: emailTemplates_1.welcomeToEmailListTemplate.subject,
            body: emailTemplates_1.welcomeToEmailListTemplate.body(fullName, subscriptionType)
        });
        console.log(`Welcome email sent to: ${email}`);
    }
    catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
};
exports.sendWelcomeEmail = sendWelcomeEmail;
const unsubscribeFromEmailList = async (email) => {
    try {
        await database_1.db.update(database_1.emailSubscriptions)
            .set({
            isActive: false,
            unsubscribedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(database_1.emailSubscriptions.email, email));
        console.log(`Unsubscribed email: ${email}`);
    }
    catch (error) {
        console.error('Error unsubscribing from email list:', error);
        throw error;
    }
};
exports.unsubscribeFromEmailList = unsubscribeFromEmailList;
const getEmailSubscriptions = async (subscriptionType) => {
    try {
        const whereCondition = subscriptionType
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.emailSubscriptions.subscriptionType, subscriptionType), (0, drizzle_orm_1.eq)(database_1.emailSubscriptions.isActive, true))
            : (0, drizzle_orm_1.eq)(database_1.emailSubscriptions.isActive, true);
        return await database_1.db.select().from(database_1.emailSubscriptions)
            .where(whereCondition)
            .orderBy((0, drizzle_orm_1.desc)(database_1.emailSubscriptions.subscribedAt));
    }
    catch (error) {
        console.error('Error fetching email subscriptions:', error);
        throw error;
    }
};
exports.getEmailSubscriptions = getEmailSubscriptions;
const sendInspectionRequestEmail = async (tenantEmail, tenantName, propertyAddress, scheduledDate, preferredTime) => {
    try {
        await (0, emailService_1.sendEmail)({
            to: tenantEmail,
            subject: emailTemplates_1.inspectionRequestTemplate.subject,
            body: emailTemplates_1.inspectionRequestTemplate.body(tenantName, propertyAddress, scheduledDate, preferredTime)
        });
        console.log(`Inspection request email sent to: ${tenantEmail}`);
    }
    catch (error) {
        console.error('Error sending inspection request email:', error);
        throw error;
    }
};
exports.sendInspectionRequestEmail = sendInspectionRequestEmail;
const sendInspectionApprovedEmail = async (tenantEmail, tenantName, propertyAddress, scheduledDate, preferredTime, agentName, agentPhone) => {
    try {
        await (0, emailService_1.sendEmail)({
            to: tenantEmail,
            subject: emailTemplates_1.inspectionApprovedTemplate.subject,
            body: emailTemplates_1.inspectionApprovedTemplate.body(tenantName, propertyAddress, scheduledDate, preferredTime, agentName, agentPhone)
        });
        console.log(`Inspection approved email sent to: ${tenantEmail}`);
    }
    catch (error) {
        console.error('Error sending inspection approved email:', error);
        throw error;
    }
};
exports.sendInspectionApprovedEmail = sendInspectionApprovedEmail;
const sendTenantWelcomeEmail = async (tenantEmail, tenantName) => {
    try {
        await (0, emailService_1.sendEmail)({
            to: tenantEmail,
            subject: emailTemplates_1.tenantWelcomeTemplate.subject,
            body: emailTemplates_1.tenantWelcomeTemplate.body(tenantName)
        });
        console.log(`Tenant welcome email sent to: ${tenantEmail}`);
    }
    catch (error) {
        console.error('Error sending tenant welcome email:', error);
        throw error;
    }
};
exports.sendTenantWelcomeEmail = sendTenantWelcomeEmail;
const sendLandlordWelcomeEmail = async (landlordEmail, landlordName) => {
    try {
        await (0, emailService_1.sendEmail)({
            to: landlordEmail,
            subject: emailTemplates_1.landlordWelcomeTemplate.subject,
            body: emailTemplates_1.landlordWelcomeTemplate.body(landlordName)
        });
        console.log(`Landlord welcome email sent to: ${landlordEmail}`);
    }
    catch (error) {
        console.error('Error sending landlord welcome email:', error);
        throw error;
    }
};
exports.sendLandlordWelcomeEmail = sendLandlordWelcomeEmail;
const sendAdminWelcomeEmail = async (adminEmail, adminName, temporaryPassword) => {
    try {
        await (0, emailService_1.sendEmail)({
            to: adminEmail,
            subject: emailTemplates_1.adminWelcomeTemplate.subject,
            body: emailTemplates_1.adminWelcomeTemplate.body(adminName, adminEmail, temporaryPassword)
        });
        console.log(`Admin welcome email sent to: ${adminEmail}`);
    }
    catch (error) {
        console.error('Error sending admin welcome email:', error);
        throw error;
    }
};
exports.sendAdminWelcomeEmail = sendAdminWelcomeEmail;
