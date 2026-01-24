import { Router } from 'express';
import { Parser } from 'json2csv';
import { count, gte } from 'drizzle-orm';
import { addToEmailList, sendSurveyConfirmationEmail } from '../utils/emailSubscriptionService';
import { db, tenantSurveys, landlordSurveys } from '../utils/database';

const router = Router();

// Submit tenant survey
router.post('/tenant', async (req, res) => {
  try {
    const {
      fullName,
      email,
      currentLocation,
      rentingStatus,
      housingType,
      biggestFrustrations,
      scammedExperience,
      scamDetails,
      // directLandlordPreference (removed; not present in schema)
      virtualTourRating,
      streetViewRating,
      verifiedListingsRating,
      supportTeamRating,
      inAppChatRating,
      rentPaymentRating,
      wishExisted,
      launchNotification
    } = req.body;

    const [survey] = await db.insert(tenantSurveys)
      .values({
        fullName,
        email,
        currentLocation,
        rentingStatus,
        housingType: Array.isArray(housingType) ? housingType : [housingType], // Ensure array format
        frustrations: Array.isArray(biggestFrustrations) ? biggestFrustrations : [biggestFrustrations],
        scamExperience: scammedExperience,
        scamDetails,
        // directLandlordPreference removed to match schema
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

    // Send confirmation email and add to email list
    try {
      await Promise.all([
        sendSurveyConfirmationEmail(email, fullName, 'tenant'),
        addToEmailList({
          email,
          fullName,
          subscriptionType: 'tenant_survey'
        })
      ]);
      console.log(`Email sent and user added to list: ${email}`);
    } catch (emailError) {
      console.error('Error with email operations:', emailError);
      // Don't fail the survey submission if email fails
    }

    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    console.error('Error submitting tenant survey:', error);
    res.status(500).json({ success: false, error: 'Failed to submit survey' });
  }
});

// Submit landlord survey
router.post('/landlord', async (req, res) => {
  try {
    const {
      fullName,
      email,
      currentLocation,
      propertyOwnership,
      propertyTypes,
      // _propertyLocations (unused)
      biggestChallenges,
      // _currentAdvertising (unused)
      averageVacancyPeriod,
      tenantVerificationImportance,
      communicationPreference,
      // _rentCollectionMethod (unused)
      // _maintenanceHandling (unused)
      desiredFeatures,
      // _platformUsageFrequency (unused)
      launchNotification,
      // Legacy field names for backward compatibility
      propertyLocation,
      numberOfProperties,
      tenantManagement,
      agentIssues,
      platformInterest,
      propertyListingRating,
      dashboardRating,
      maintenanceRating,
      rentCollectionRating,
      customerSupportRating,
      monthlyReportRating,
      wishEasier
    } = req.body;

    const [survey] = await db.insert(landlordSurveys)
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

    // Send confirmation email and add to email list
    try {
      await Promise.all([
        sendSurveyConfirmationEmail(email, fullName, 'landlord'),
        addToEmailList({
          email,
          fullName,
          subscriptionType: 'landlord_survey'
        })
      ]);
      console.log(`Email sent and user added to list: ${email}`);
    } catch (emailError) {
      console.error('Error with email operations:', emailError);
      // Don't fail the survey submission if email fails
    }

    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    console.error('Error submitting landlord survey:', error);
    res.status(500).json({ success: false, error: 'Failed to submit survey' });
  }
});

// Download tenant surveys (Admin only)
router.get('/tenant/download', async (_req, res) => {
  try {
    const surveys = await db.select().from(tenantSurveys)
      .orderBy(tenantSurveys.createdAt);

    // Convert array fields to comma-separated strings for CSV
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

    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tenant-surveys.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error downloading tenant surveys:', error);
    res.status(500).json({ success: false, error: 'Failed to download surveys' });
  }
});

// Download landlord surveys (Admin only)
router.get('/landlord/download', async (_req, res) => {
  try {
    const surveys = await db.select().from(landlordSurveys)
      .orderBy(landlordSurveys.createdAt);

    // Convert array fields to comma-separated strings for CSV
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

    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="landlord-surveys.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error downloading landlord surveys:', error);
    res.status(500).json({ success: false, error: 'Failed to download surveys' });
  }
});

// Get survey statistics (Admin only)
router.get('/stats', async (_req, res) => {
  try {
    const [{ count: tenantCount }] = await db.select({ count: count() }).from(tenantSurveys);
    const [{ count: landlordCount }] = await db.select({ count: count() }).from(landlordSurveys);
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [{ count: recentTenantSurveys }] = await db.select({ count: count() })
      .from(tenantSurveys)
      .where(gte(tenantSurveys.createdAt, sevenDaysAgo));
    
    const [{ count: recentLandlordSurveys }] = await db.select({ count: count() })
      .from(landlordSurveys)
      .where(gte(landlordSurveys.createdAt, sevenDaysAgo));

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
  } catch (error) {
    console.error('Error fetching survey stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch survey statistics' });
  }
});

export default router;