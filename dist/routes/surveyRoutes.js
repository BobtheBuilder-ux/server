"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const json2csv_1 = require("json2csv");
const drizzle_orm_1 = require("drizzle-orm");
const emailSubscriptionService_1 = require("../utils/emailSubscriptionService");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
router.post('/tenant', async (req, res) => {
    try {
        const { fullName, email, currentLocation, rentingStatus, housingType, biggestFrustrations, scammedExperience, scamDetails, virtualTourRating, streetViewRating, verifiedListingsRating, supportTeamRating, inAppChatRating, rentPaymentRating, wishExisted, launchNotification } = req.body;
        const [survey] = await database_1.db.insert(database_1.tenantSurveys)
            .values({
            fullName,
            email,
            currentLocation,
            rentingStatus,
            housingType: Array.isArray(housingType) ? housingType : [housingType],
            frustrations: Array.isArray(biggestFrustrations) ? biggestFrustrations : [biggestFrustrations],
            scamExperience: scammedExperience,
            scamDetails,
            propertyListingRating: virtualTourRating,
            dashboardRating: streetViewRating,
            maintenanceRating: verifiedListingsRating,
            rentCollectionRating: supportTeamRating,
            customerSupportRating: inAppChatRating,
            monthlyReportRating: rentPaymentRating,
            wishEasier: wishExisted,
            launchNotification
        })
            .returning();
        try {
            await Promise.all([
                (0, emailSubscriptionService_1.sendSurveyConfirmationEmail)(email, fullName, 'tenant'),
                (0, emailSubscriptionService_1.addToEmailList)({
                    email,
                    fullName,
                    subscriptionType: 'tenant_survey'
                })
            ]);
            console.log(`Email sent and user added to list: ${email}`);
        }
        catch (emailError) {
            console.error('Error with email operations:', emailError);
        }
        res.status(201).json({ success: true, data: survey });
    }
    catch (error) {
        console.error('Error submitting tenant survey:', error);
        res.status(500).json({ success: false, error: 'Failed to submit survey' });
    }
});
router.post('/landlord', async (req, res) => {
    try {
        const { fullName, email, currentLocation, propertyOwnership, propertyTypes, biggestChallenges, averageVacancyPeriod, tenantVerificationImportance, communicationPreference, desiredFeatures, launchNotification, propertyLocation, numberOfProperties, tenantManagement, agentIssues, platformInterest, propertyListingRating, dashboardRating, maintenanceRating, rentCollectionRating, customerSupportRating, monthlyReportRating, wishEasier } = req.body;
        const [survey] = await database_1.db.insert(database_1.landlordSurveys)
            .values({
            fullName,
            email,
            propertyLocation: propertyLocation || currentLocation || 'Not specified',
            numberOfProperties: numberOfProperties || propertyOwnership || 'Not specified',
            propertyTypes: Array.isArray(propertyTypes) ? propertyTypes : [propertyTypes || 'Not specified'],
            tenantManagement: Array.isArray(tenantManagement) ? tenantManagement : [tenantManagement || communicationPreference || 'Not specified'],
            biggestChallenges: Array.isArray(biggestChallenges) ? biggestChallenges : [biggestChallenges || 'Not specified'],
            agentIssues: agentIssues || averageVacancyPeriod || 'Not specified',
            platformInterest: platformInterest || tenantVerificationImportance || 'Not specified',
            propertyListingRating: propertyListingRating || '5',
            dashboardRating: dashboardRating || '5',
            maintenanceRating: maintenanceRating || '5',
            rentCollectionRating: rentCollectionRating || '5',
            customerSupportRating: customerSupportRating || '5',
            monthlyReportRating: monthlyReportRating || '5',
            wishEasier: wishEasier || (Array.isArray(desiredFeatures) ? desiredFeatures.join(', ') : 'Better platform features'),
            launchNotification
        })
            .returning();
        try {
            await Promise.all([
                (0, emailSubscriptionService_1.sendSurveyConfirmationEmail)(email, fullName, 'landlord'),
                (0, emailSubscriptionService_1.addToEmailList)({
                    email,
                    fullName,
                    subscriptionType: 'landlord_survey'
                })
            ]);
            console.log(`Email sent and user added to list: ${email}`);
        }
        catch (emailError) {
            console.error('Error with email operations:', emailError);
        }
        res.status(201).json({ success: true, data: survey });
    }
    catch (error) {
        console.error('Error submitting landlord survey:', error);
        res.status(500).json({ success: false, error: 'Failed to submit survey' });
    }
});
router.get('/tenant/download', async (_req, res) => {
    try {
        const surveys = await database_1.db.select().from(database_1.tenantSurveys)
            .orderBy(database_1.tenantSurveys.createdAt);
        const csvData = surveys.map(survey => ({
            ...survey,
            housingType: survey.housingType.join(', '),
            frustrations: survey.frustrations.join(', '),
            createdAt: survey.createdAt.toISOString(),
            updatedAt: survey.updatedAt.toISOString()
        }));
        const fields = [
            'id',
            'fullName',
            'email',
            'currentLocation',
            'rentingStatus',
            'housingType',
            'frustrations',
            'scamExperience',
            'scamDetails',
            'propertyListingRating',
            'dashboardRating',
            'maintenanceRating',
            'rentCollectionRating',
            'customerSupportRating',
            'monthlyReportRating',
            'wishEasier',
            'launchNotification',
            'createdAt',
            'updatedAt'
        ];
        const parser = new json2csv_1.Parser({ fields });
        const csv = parser.parse(csvData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="tenant-surveys.csv"');
        res.send(csv);
    }
    catch (error) {
        console.error('Error downloading tenant surveys:', error);
        res.status(500).json({ success: false, error: 'Failed to download surveys' });
    }
});
router.get('/landlord/download', async (_req, res) => {
    try {
        const surveys = await database_1.db.select().from(database_1.landlordSurveys)
            .orderBy(database_1.landlordSurveys.createdAt);
        const csvData = surveys.map(survey => ({
            ...survey,
            propertyTypes: survey.propertyTypes.join(', '),
            tenantManagement: survey.tenantManagement.join(', '),
            biggestChallenges: survey.biggestChallenges.join(', '),
            createdAt: survey.createdAt.toISOString(),
            updatedAt: survey.updatedAt.toISOString()
        }));
        const fields = [
            'id',
            'fullName',
            'email',
            'propertyLocation',
            'numberOfProperties',
            'propertyTypes',
            'tenantManagement',
            'biggestChallenges',
            'agentIssues',
            'platformInterest',
            'propertyListingRating',
            'dashboardRating',
            'maintenanceRating',
            'rentCollectionRating',
            'customerSupportRating',
            'monthlyReportRating',
            'wishEasier',
            'launchNotification',
            'createdAt',
            'updatedAt'
        ];
        const parser = new json2csv_1.Parser({ fields });
        const csv = parser.parse(csvData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="landlord-surveys.csv"');
        res.send(csv);
    }
    catch (error) {
        console.error('Error downloading landlord surveys:', error);
        res.status(500).json({ success: false, error: 'Failed to download surveys' });
    }
});
router.get('/stats', async (_req, res) => {
    try {
        const [{ count: tenantCount }] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(database_1.tenantSurveys);
        const [{ count: landlordCount }] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(database_1.landlordSurveys);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [{ count: recentTenantSurveys }] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(database_1.tenantSurveys)
            .where((0, drizzle_orm_1.gte)(database_1.tenantSurveys.createdAt, sevenDaysAgo));
        const [{ count: recentLandlordSurveys }] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(database_1.landlordSurveys)
            .where((0, drizzle_orm_1.gte)(database_1.landlordSurveys.createdAt, sevenDaysAgo));
        res.json({
            success: true,
            data: {
                totalTenantSurveys: tenantCount,
                totalLandlordSurveys: landlordCount,
                recentTenantSurveys,
                recentLandlordSurveys,
                totalSurveys: tenantCount + landlordCount
            }
        });
    }
    catch (error) {
        console.error('Error fetching survey stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch survey statistics' });
    }
});
exports.default = router;
