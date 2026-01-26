import { Request, Response } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../utils/database";
import { applications, tenants, properties, locations, landlords, leases, payments, landlordTenantRentals } from "../db/schema";
import { sendEmail } from "../utils/emailService";
import { 
  applicationSubmittedTemplate, 
  applicationApprovedTemplate,
  propertyRentedNotificationTemplate
} from "../utils/emailTemplates";
import { uploadBufferToCloudinary } from "../utils/cloudinaryService";
import { generateLeaseAgreement } from "../utils/leaseAgreementGenerator";

export const listApplications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, userType } = req.query;

    let applicationResults;
    
    if (userId && userType) {
      if (userType === "tenant") {
        applicationResults = await db
          .select()
          .from(applications)
          .leftJoin(properties, eq(applications.propertyId, properties.id))
          .leftJoin(locations, eq(properties.locationId, locations.id))
          .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
          .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
          .leftJoin(leases, eq(applications.leaseId, leases.id))
          .where(eq(applications.tenantCognitoId, String(userId)))
          .orderBy(desc(applications.applicationDate));
      } else if (userType === "landlord") {
        applicationResults = await db
          .select()
          .from(applications)
          .leftJoin(properties, eq(applications.propertyId, properties.id))
          .leftJoin(locations, eq(properties.locationId, locations.id))
          .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
          .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
          .leftJoin(leases, eq(applications.leaseId, leases.id))
          .where(eq(properties.landlordCognitoId, String(userId)))
          .orderBy(desc(applications.applicationDate));
      } else {
        applicationResults = await db
          .select()
          .from(applications)
          .leftJoin(properties, eq(applications.propertyId, properties.id))
          .leftJoin(locations, eq(properties.locationId, locations.id))
          .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
          .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
          .leftJoin(leases, eq(applications.leaseId, leases.id))
          .orderBy(desc(applications.applicationDate));
      }
    } else {
      applicationResults = await db
        .select()
        .from(applications)
        .leftJoin(properties, eq(applications.propertyId, properties.id))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
        .leftJoin(leases, eq(applications.leaseId, leases.id))
        .orderBy(desc(applications.applicationDate));
    }

    // Get payments for each lease
    const leaseIds = applicationResults
      .map(result => result.Lease?.id)
      .filter(Boolean) as number[];
    
    const paymentsData = leaseIds.length > 0 
      ? await db.select().from(payments).where(inArray(payments.leaseId, leaseIds))
      : [];

    function calculateNextPaymentDate(startDate: Date): Date {
      const today = new Date();
      const nextPaymentDate = new Date(startDate);
      while (nextPaymentDate <= today) {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }
      return nextPaymentDate;
    }

    const formattedApplications = applicationResults.map((result) => {
      const app = result.Application;
      const property = result.Property;
      const location = result.Location;
      const landlord = result.Landlord;
      const tenant = result.Tenant;
      const lease = result.Lease;
      
      const leasePayments = lease ? paymentsData.filter(p => p.leaseId === lease.id) : [];
      
      return {
        ...app,
        property: {
          ...property,
          address: location?.address,
        },
        landlord,
        tenant,
        lease: lease
          ? {
              ...lease,
              payments: leasePayments,
              nextPaymentDate: calculateNextPaymentDate(lease.startDate),
            }
          : null,
      };
    });

    res.json(formattedApplications);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving applications: ${error.message}` });
  }
};

export const createApplicationWithFiles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const {
      applicationDate,
      status,
      propertyId,
      tenantCognitoId,
      name,
      email,
      phoneNumber,
      preferredMoveInDate,
      gender,
      dateOfBirth,
      nationality,
      maritalStatus,
      idType,
      durationAtCurrentAddress,
      employmentStatus,
      occupation,
      employerName,
      workAddress,
      monthlyIncome,
      durationAtCurrentJob,
      previousEmployerName,
      previousJobTitle,
      previousEmploymentDuration,
      reasonForLeavingPrevJob,
      numberOfOccupants,
      relationshipToOccupants,
      hasPets,
      isSmoker,
      accessibilityNeeds,
      reasonForLeaving,
      consentToInformation,
      consentToVerification,
      consentToTenancyTerms,
      consentToPrivacyPolicy,
      paymentId
    } = req.body;

    // Validate payment
    if (!paymentId) {
      res.status(400).json({ message: "Payment is required before submitting application." });
      return;
    }

    const paymentResult = await db.select().from(payments).where(eq(payments.id, Number(paymentId))).limit(1);
    if (!paymentResult[0] || paymentResult[0].paymentStatus !== 'Paid') {
        res.status(400).json({ message: "Invalid or unpaid payment reference provided." });
        return;
    }
    // Also check if already used
    if (paymentResult[0].applicationId) {
        res.status(400).json({ message: "This payment has already been used for an application." });
        return;
    }

    // Get property details first
    const propertyResult = await db
      .select()
      .from(properties)
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(eq(properties.id, parseInt(propertyId)))
      .limit(1);

    const property = propertyResult[0]?.Property;
    const landlord = propertyResult[0]?.Landlord;
    const location = propertyResult[0]?.Location;

    if (!property) {
      res.status(404).json({ message: "Property not found" });
      return;
    }

    // Check for existing active application from this tenant for ANY property
    const existingApplicationResult = await db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(
        and(
          eq(applications.tenantCognitoId, tenantCognitoId),
          inArray(applications.status, ['Pending', 'Approved'])
        )
      )
      .limit(1);

    const existingApplication = existingApplicationResult[0]?.Application;
    const existingLocation = existingApplicationResult[0]?.Location;

    if (existingApplication) {
      res.status(400).json({ 
        message: `You already have an active application for ${existingLocation?.address}. Tenants are allowed only one application at a time. Please wait for your current application to be processed or contact support.`,
        existingApplication: {
          id: existingApplication.id,
          propertyAddress: existingLocation?.address,
          status: existingApplication.status,
          applicationDate: existingApplication.applicationDate
        }
      });
      return;
    }

    // Upload documents to Cloudinary (outside transaction)
    let idDocumentUrl = '';
    let incomeProofUrl = '';

    if (files.idDocument && files.idDocument[0]) {
      const idFile = files.idDocument[0];
      const idResult = await uploadBufferToCloudinary(
        idFile.buffer,
        idFile.originalname,
        'documents/id',
        'raw'
      );
      idDocumentUrl = idResult.url;
    }

    if (files.incomeProof && files.incomeProof[0]) {
      const incomeFile = files.incomeProof[0];
      const incomeResult = await uploadBufferToCloudinary(
        incomeFile.buffer,
        incomeFile.originalname,
        'documents/income',
        'raw'
      );
      incomeProofUrl = incomeResult.url;
    }

    // Create application in transaction (NO LEASE YET)
    const newApplication = await db.transaction(async (tx) => {
      // Create application
      const [application] = await tx.insert(applications).values({
        applicationDate: new Date(applicationDate),
        status,
        name,
        email,
        phoneNumber,
        preferredMoveInDate: preferredMoveInDate ? new Date(preferredMoveInDate) : null,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nationality,
        maritalStatus,
        idType,
        idDocumentUrl,
        durationAtCurrentAddress,
        employmentStatus,
        occupation,
        employerName,
        workAddress,
        monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : null,
        durationAtCurrentJob,
        incomeProofUrl,
        previousEmployerName,
        previousJobTitle,
        previousEmploymentDuration,
        reasonForLeavingPrevJob,
        numberOfOccupants: numberOfOccupants ? parseInt(numberOfOccupants) : null,
        relationshipToOccupants,
        hasPets: hasPets === 'true',
        isSmoker: isSmoker === 'true',
        accessibilityNeeds,
        reasonForLeaving,
        consentToInformation: consentToInformation === 'true',
        consentToVerification: consentToVerification === 'true',
        consentToTenancyTerms: consentToTenancyTerms === 'true',
        consentToPrivacyPolicy: consentToPrivacyPolicy === 'true',
        propertyId: parseInt(propertyId),
        tenantCognitoId: tenantCognitoId,
        leaseId: null, // No lease yet
      }).returning();

      // Link payment to application
      if (paymentId) {
        await tx.update(payments)
          .set({ applicationId: application.id })
          .where(eq(payments.id, paymentId));
      }

      // Get the full application with related data
      const fullApplicationResult = await tx
        .select()
        .from(applications)
        .leftJoin(properties, eq(applications.propertyId, properties.id))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
        .leftJoin(leases, eq(applications.leaseId, leases.id))
        .where(eq(applications.id, application.id))
        .limit(1);

      const result = fullApplicationResult[0];
      return {
        ...result.Application,
        property: {
          ...result.Property,
          location: result.Location,
          landlord: result.Landlord,
        },
        tenant: result.Tenant,
        lease: result.Lease,
      };
    });

    // Send emails after transaction completes
    try {
      // Send email to tenant using template
      await sendEmail({
        to: email,
        subject: applicationSubmittedTemplate.subject,
        body: applicationSubmittedTemplate.body(
          name,
          location?.address || '',
          new Date(applicationDate).toLocaleDateString(),
          property.pricePerYear,
          property.pricePerYear * 0.15,
          property.pricePerYear * 0.1
        )
      });

      // Send email to landlord
      if (landlord?.email) {
        await sendEmail({
          to: landlord.email,
          subject: "New Rental Application Received",
          body: `
            <h2>New Application Received</h2>
            <p>A new application has been submitted for your property at ${location?.address}.</p>
            <p>Applicant Details:</p>
            <ul>
              <li>Name: ${name}</li>
              <li>Email: ${email}</li>
              <li>Application Date: ${new Date(applicationDate).toLocaleDateString()}</li>
            </ul>
            <p>Please log in to your dashboard to review the application.</p>
          `
        });
      }
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      // Don't fail the entire request if email fails
    }

    res.status(201).json(newApplication);
  } catch (error: any) {
    console.error('Error creating application with files:', error);
    res.status(500).json({ message: `Error creating application: ${error.message}` });
  }
};

export const createApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      applicationDate,
      status,
      propertyId,
      tenantCognitoId,
      name,
      email,
      phoneNumber,
      preferredMoveInDate,
      gender,
      dateOfBirth,
      nationality,
      maritalStatus,
      idType,
      idDocumentUrl,
      durationAtCurrentAddress,
      employmentStatus,
      occupation,
      employerName,
      workAddress,
      monthlyIncome,
      durationAtCurrentJob,
      incomeProofUrl,
      previousEmployerName,
      previousJobTitle,
      previousEmploymentDuration,
      reasonForLeavingPrevJob,
      numberOfOccupants,
      relationshipToOccupants,
      hasPets,
      isSmoker,
      accessibilityNeeds,
      reasonForLeaving,
      consentToInformation,
      consentToVerification,
      consentToTenancyTerms,
      consentToPrivacyPolicy,
      paymentId
    } = req.body;

    // Validate payment
    if (!paymentId) {
      res.status(400).json({ message: "Payment is required before submitting application." });
      return;
    }

    const paymentResult = await db.select().from(payments).where(eq(payments.id, Number(paymentId))).limit(1);
    if (!paymentResult[0] || paymentResult[0].paymentStatus !== 'Paid') {
        res.status(400).json({ message: "Invalid or unpaid payment reference provided." });
        return;
    }
    // Also check if already used
    if (paymentResult[0].applicationId) {
        res.status(400).json({ message: "This payment has already been used for an application." });
        return;
    }

    const propertyResult = await db
      .select()
      .from(properties)
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(eq(properties.id, propertyId))
      .limit(1);

    const property = propertyResult[0]?.Property;
    const landlord = propertyResult[0]?.Landlord;
    const location = propertyResult[0]?.Location;

    if (!property) {
      res.status(404).json({ message: "Property not found" });
      return;
    }

    // Check for existing active application from this tenant for ANY property
    const existingApplicationResult = await db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(
        and(
          eq(applications.tenantCognitoId, tenantCognitoId),
          inArray(applications.status, ['Pending', 'Approved'])
        )
      )
      .limit(1);

    const existingApplication = existingApplicationResult[0]?.Application;
    const existingLocation = existingApplicationResult[0]?.Location;

    if (existingApplication) {
      res.status(400).json({ 
        message: `You already have an active application for ${existingLocation?.address}. Tenants are allowed only one application at a time. Please wait for your current application to be processed or contact support.`,
        existingApplication: {
          id: existingApplication.id,
          propertyAddress: existingLocation?.address,
          status: existingApplication.status,
          applicationDate: existingApplication.applicationDate
        }
      });
      return;
    }

    const newApplication = await db.transaction(async (tx) => {
      // Create application
      const [application] = await tx.insert(applications).values({
        applicationDate: new Date(applicationDate),
        status,
        name,
        email,
        phoneNumber,
        preferredMoveInDate: preferredMoveInDate ? new Date(preferredMoveInDate) : null,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nationality,
        maritalStatus,
        idType,
        idDocumentUrl,
        durationAtCurrentAddress,
        employmentStatus,
        occupation,
        employerName,
        workAddress,
        monthlyIncome,
        durationAtCurrentJob,
        incomeProofUrl,
        previousEmployerName,
        previousJobTitle,
        previousEmploymentDuration,
        reasonForLeavingPrevJob,
        numberOfOccupants,
        relationshipToOccupants,
        hasPets,
        isSmoker,
        accessibilityNeeds,
        reasonForLeaving,
        consentToInformation,
        consentToVerification,
        consentToTenancyTerms,
        consentToPrivacyPolicy,
        propertyId: propertyId,
        tenantCognitoId: tenantCognitoId,
        leaseId: null, // No lease yet
      }).returning();

      // Link payment to application
      if (paymentId) {
        await tx.update(payments)
          .set({ applicationId: application.id })
          .where(eq(payments.id, Number(paymentId)));
      }

      // Get full application data with joins for response
      const applicationWithDetails = await tx
        .select()
        .from(applications)
        .leftJoin(properties, eq(applications.propertyId, properties.id))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
        .leftJoin(leases, eq(applications.leaseId, leases.id))
        .where(eq(applications.id, application.id))
        .limit(1);

      const result = applicationWithDetails[0];

      // Send email to tenant using template
      await sendEmail({
        to: email,
        subject: applicationSubmittedTemplate.subject,
        body: applicationSubmittedTemplate.body(
          name,
          location?.address || '',
          new Date(applicationDate).toLocaleDateString(),
          property.pricePerYear,
          property.pricePerYear * 0.15,
          property.pricePerYear * 0.1
        )
      });

      // Send email to landlord
      if (landlord?.email) {
        await sendEmail({
          to: landlord.email,
          subject: "New Rental Application Received",
          body: `
            <h2>New Application Received</h2>
            <p>A new application has been submitted for your property at ${location?.address}.</p>
            <p>Applicant Details:</p>
            <ul>
              <li>Name: ${name}</li>
              <li>Email: ${email}</li>
              <li>Application Date: ${new Date(applicationDate).toLocaleDateString()}</li>
            </ul>
            <p>Please log in to your dashboard to review the application.</p>
          `
        });
      }

      return result;
    });

    res.status(201).json({
      applications: newApplication.Application,
      properties: newApplication.Property,
      locations: newApplication.Location,
      landlords: newApplication.Landlord,
      tenants: newApplication.Tenant,
      leases: newApplication.Lease
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error creating application: ${error.message}` });
  }
};

export const updateApplicationStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, userType, keyDeliveryType, keyDeliveryInstructions } = req.body;
    
    // Only admins can update application status
    if (userType !== 'admin') {
      res.status(403).json({ message: "Only administrators can approve or deny applications." });
      return;
    }

    const applicationResult = await db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .where(eq(applications.id, Number(id)))
      .limit(1);

    const application = applicationResult[0]?.Application;
    const property = applicationResult[0]?.Property;
    const location = applicationResult[0]?.Location;
    const tenant = applicationResult[0]?.Tenant;
    const landlord = applicationResult[0]?.Landlord;

    if (!application) {
      res.status(404).json({ message: "Application not found." });
      return;
    }

    if (status === "Approved") {
      if (!tenant || !property) {
        res.status(400).json({ message: "Tenant or Property not found" });
        return;
      }

      // Create lease
      const newLeaseResult = await db.insert(leases).values({
        rent: property.pricePerYear,
        deposit: property.securityDeposit || 0,
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        tenantCognitoId: tenant.cognitoId,
        propertyId: property.id
      }).returning();
      
      const newLease = newLeaseResult[0];

      // Create LandlordTenantRental (Residence)
      try {
           const nextRentDueDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
           const leaseStartDate = new Date();
           const leaseEndDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
           const landlordIdNumeric = landlord?.id;
           const tenantIdNumeric = tenant.id;

           if (landlordIdNumeric && tenantIdNumeric) {
             await db.insert(landlordTenantRentals).values({
               tenantId: tenantIdNumeric,
               landlordId: landlordIdNumeric,
               rentAmount: property.pricePerYear,
               rentDueDate: nextRentDueDate,
               leaseStartDate,
               leaseEndDate,
               paymentMethod: 'Paystack',
               propertyAddress: location?.address || 'N/A',
               isRentOverdue: false,
               applicationFeeAdded: false,
               securityDepositAdded: !!property.securityDeposit,
               hasBeenEditedByLandlord: false,
             }).onConflictDoNothing();
           }
      } catch (error) {
          console.error("Error creating residence record:", error);
      }

      // Update application status to approved with lease info
      await db.update(applications)
        .set({ 
          status,
          leaseId: newLease.id,
          keyDeliveryType,
          keyDeliveryInstructions
        })
        .where(eq(applications.id, Number(id)));

      // Update Payment with leaseId
      // Find payment for this application
      const paymentResult = await db.select().from(payments).where(eq(payments.applicationId, Number(id))).limit(1);
      const payment = paymentResult[0];
      if (payment) {
          await db.update(payments).set({ leaseId: newLease.id }).where(eq(payments.id, payment.id));
      }
      
      // Generate Lease Agreement PDF
      const leaseAgreementPDF = await generateLeaseAgreement({
             tenantName: tenant.name,
             tenantEmail: tenant.email,
             tenantPhone: tenant.phoneNumber,
             propertyAddress: location?.address || 'N/A',
             propertyName: property.name || 'Property',
             landlordName: landlord?.name || 'N/A',
             landlordEmail: landlord?.email || 'N/A',
             landlordPhone: landlord?.phoneNumber || 'N/A',
             rentAmount: newLease.rent,
             securityDeposit: newLease.deposit,
             leaseStartDate: newLease.startDate,
             leaseEndDate: newLease.endDate,
             paymentDate: payment?.paymentDate || new Date(),
             paymentReference: `APP-${id}` // Or use payment ID if available
      });

      // Send approval email to tenant using template
      await sendEmail({
        to: tenant?.email || '',
        subject: applicationApprovedTemplate.subject,
        body: applicationApprovedTemplate.body(
          tenant?.name || '',
          location?.address || '',
          application.propertyId,
          keyDeliveryType,
          keyDeliveryInstructions
        ),
        attachments: [
              {
                filename: 'Lease_Agreement.pdf',
                content: leaseAgreementPDF,
                contentType: 'application/pdf',
              }
        ]
      });

      // Send Landlord Notification
         if (landlord?.email) {
           await sendEmail({
             to: landlord.email,
             subject: propertyRentedNotificationTemplate.subject,
             body: propertyRentedNotificationTemplate.body(
               landlord.name,
               location?.address || 'N/A',
               tenant.name,
               tenant.phoneNumber,
               property.pricePerYear
             )
           });
         }
    } else if (status === "Denied") {
      await db.update(applications)
        .set({ status })
        .where(eq(applications.id, Number(id)));

      // Send denial email to tenant
      await sendEmail({
        to: tenant?.email || '',
        subject: "Update on Your Rental Application",
        body: `
          <h2>Application Status Update</h2>
          <p>Dear ${tenant?.name},</p>
          <p>We regret to inform you that your application for ${location?.address} has not been approved at this time.</p>
          <p>You can continue browsing other available properties on our platform that might better suit your needs.</p>
          <p>Thank you for your interest in our properties.</p>
        `
      });
    }

    const updatedApplicationResult = await db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
      .leftJoin(leases, eq(applications.leaseId, leases.id))
      .where(eq(applications.id, Number(id)))
      .limit(1);

    res.json({
      applications: updatedApplicationResult[0]?.Application,
      properties: updatedApplicationResult[0]?.Property,
      tenants: updatedApplicationResult[0]?.Tenant,
      leases: updatedApplicationResult[0]?.Lease
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error updating application status: ${error.message}` });
  }
};

export const getApplications = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, propertyId, tenantCognitoId } = req.query;

    // Build where conditions
    const conditions = [];
    
    if (status && ['Pending', 'Denied', 'Approved'].includes(status as string)) {
      conditions.push(eq(applications.status, status as 'Pending' | 'Denied' | 'Approved'));
    }
    
    if (propertyId) {
      conditions.push(eq(applications.propertyId, Number(propertyId)));
    }
    
    if (tenantCognitoId) {
      conditions.push(eq(applications.tenantCognitoId, tenantCognitoId as string));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    let query = db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
      .leftJoin(leases, eq(applications.leaseId, leases.id))
      .leftJoin(payments, eq(leases.id, payments.leaseId))
      .orderBy(desc(applications.applicationDate))
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    if (whereCondition) {
      query = query.where(whereCondition) as any;
    }

    const applicationResults = await query;

    res.json({
      applications: applicationResults,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: applicationResults.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching applications: ${error.message}` });
  }
};

export const getApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const applicationResults = await db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
      .leftJoin(leases, eq(applications.leaseId, leases.id))
      .leftJoin(payments, eq(leases.id, payments.leaseId))
      .where(eq(applications.id, parseInt(id)))
      .limit(1);

    const application = applicationResults[0]?.Application;

    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    res.json({
      applications: applicationResults[0]?.Application,
      properties: applicationResults[0]?.Property,
      locations: applicationResults[0]?.Location,
      landlords: applicationResults[0]?.Landlord,
      tenants: applicationResults[0]?.Tenant,
      leases: applicationResults[0]?.Lease,
      payments: applicationResults[0]?.Payment
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching application: ${error.message}` });
  }
};

export const checkPaymentDeadlines = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Find all approved applications with expired payment deadlines
    const expiredApplicationsResult = await db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
      .where(
        and(
           eq(applications.status, 'Approved')
           // Note: paymentDeadline comparison would need to be added here
         )
      );

    // Update expired applications to 'Denied' status
    for (const result of expiredApplicationsResult) {
      const application = result.Application;
      const tenant = result.Tenant;
      const location = result.Location;
      
      if (application) {
        await db.update(applications)
          .set({ 
            status: 'Denied',
            paymentDeadline: null
          })
          .where(eq(applications.id, application.id));

        // Send notification email to tenant
        await sendEmail({
          to: tenant?.email || '',
          subject: "Payment Deadline Expired - Application Denied",
          body: `
            <h2>Payment Deadline Expired</h2>
            <p>Dear ${tenant?.name},</p>
            <p>Your payment deadline for the property at ${location?.address} has expired.</p>
            <p>Your application has been automatically denied due to non-payment within the required timeframe.</p>
            <p>You can apply for other available properties on our platform.</p>
            <p>Thank you for your interest.</p>
          `
        });
      }
    }

    res.json({ 
      message: `Processed ${expiredApplicationsResult.length} expired applications`,
      expiredCount: expiredApplicationsResult.length
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error checking payment deadlines: ${error.message}` });
  }
};

export const checkExistingApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { tenantCognitoId } = req.query;

    if (!tenantCognitoId) {
      res.status(400).json({ message: "Tenant Cognito ID is required" });
      return;
    }

    const existingApplicationResult = await db
      .select()
      .from(applications)
      .leftJoin(properties, eq(applications.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .leftJoin(tenants, eq(applications.tenantCognitoId, tenants.cognitoId))
      .leftJoin(leases, eq(applications.leaseId, leases.id))
      .leftJoin(payments, eq(leases.id, payments.leaseId))
      .where(
        and(
          eq(applications.tenantCognitoId, tenantCognitoId as string),
          inArray(applications.status, ['Pending', 'Approved'])
        )
      )
      .limit(1);

    const existingApplication = existingApplicationResult[0]?.Application;

    res.json({
      hasApplication: !!existingApplication,
      application: existingApplication || undefined,
      property: existingApplicationResult[0]?.Property,
      location: existingApplicationResult[0]?.Location,
      landlord: existingApplicationResult[0]?.Landlord,
      tenant: existingApplicationResult[0]?.Tenant,
      lease: existingApplicationResult[0]?.Lease,
      payments: existingApplicationResult[0]?.Payment
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error checking existing application: ${error.message}` });
  }
};
