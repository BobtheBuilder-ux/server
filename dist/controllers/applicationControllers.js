"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExistingApplication = exports.checkPaymentDeadlines = exports.getApplication = exports.getApplications = exports.updateApplicationStatus = exports.createApplication = exports.createApplicationWithFiles = exports.listApplications = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const emailService_1 = require("../utils/emailService");
const emailTemplates_1 = require("../utils/emailTemplates");
const cloudinaryService_1 = require("../utils/cloudinaryService");
const listApplications = async (req, res) => {
    try {
        const { userId, userType } = req.query;
        let applicationResults;
        if (userId && userType) {
            if (userType === "tenant") {
                applicationResults = await database_1.db
                    .select()
                    .from(schema_1.applications)
                    .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
                    .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, String(userId)))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.applications.applicationDate));
            }
            else if (userType === "landlord") {
                applicationResults = await database_1.db
                    .select()
                    .from(schema_1.applications)
                    .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
                    .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, String(userId)))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.applications.applicationDate));
            }
            else {
                applicationResults = await database_1.db
                    .select()
                    .from(schema_1.applications)
                    .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
                    .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.applications.applicationDate));
            }
        }
        else {
            applicationResults = await database_1.db
                .select()
                .from(schema_1.applications)
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.applications.applicationDate));
        }
        const leaseIds = applicationResults
            .map(result => result.Lease?.id)
            .filter(Boolean);
        const paymentsData = leaseIds.length > 0
            ? await database_1.db.select().from(schema_1.payments).where((0, drizzle_orm_1.inArray)(schema_1.payments.leaseId, leaseIds))
            : [];
        function calculateNextPaymentDate(startDate) {
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
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving applications: ${error.message}` });
    }
};
exports.listApplications = listApplications;
const createApplicationWithFiles = async (req, res) => {
    try {
        const files = req.files;
        const { applicationDate, status, propertyId, tenantCognitoId, name, email, phoneNumber, preferredMoveInDate, desiredLeaseDuration, gender, dateOfBirth, nationality, maritalStatus, idType, durationAtCurrentAddress, employmentStatus, occupation, employerName, workAddress, monthlyIncome, durationAtCurrentJob, previousEmployerName, previousJobTitle, previousEmploymentDuration, reasonForLeavingPrevJob, numberOfOccupants, relationshipToOccupants, hasPets, isSmoker, accessibilityNeeds, reasonForLeaving, consentToInformation, consentToVerification, consentToTenancyTerms, consentToPrivacyPolicy, } = req.body;
        const propertyResult = await database_1.db
            .select()
            .from(schema_1.properties)
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, parseInt(propertyId)))
            .limit(1);
        const property = propertyResult[0]?.Property;
        const landlord = propertyResult[0]?.Landlord;
        const location = propertyResult[0]?.Location;
        if (!property) {
            res.status(404).json({ message: "Property not found" });
            return;
        }
        const existingApplicationResult = await database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, tenantCognitoId), (0, drizzle_orm_1.inArray)(schema_1.applications.status, ['Pending', 'Approved'])))
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
        let idDocumentUrl = '';
        let incomeProofUrl = '';
        if (files.idDocument && files.idDocument[0]) {
            const idFile = files.idDocument[0];
            const idResult = await (0, cloudinaryService_1.uploadBufferToCloudinary)(idFile.buffer, idFile.originalname, 'documents/id', 'raw');
            idDocumentUrl = idResult.url;
        }
        if (files.incomeProof && files.incomeProof[0]) {
            const incomeFile = files.incomeProof[0];
            const incomeResult = await (0, cloudinaryService_1.uploadBufferToCloudinary)(incomeFile.buffer, incomeFile.originalname, 'documents/income', 'raw');
            incomeProofUrl = incomeResult.url;
        }
        const newApplication = await database_1.db.transaction(async (tx) => {
            const [lease] = await tx.insert(schema_1.leases).values({
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                rent: property.pricePerYear,
                deposit: property.securityDeposit || 0,
                propertyId: parseInt(propertyId),
                tenantCognitoId: tenantCognitoId,
            }).returning();
            const [application] = await tx.insert(schema_1.applications).values({
                applicationDate: new Date(applicationDate),
                status,
                name,
                email,
                phoneNumber,
                preferredMoveInDate: preferredMoveInDate ? new Date(preferredMoveInDate) : null,
                desiredLeaseDuration,
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
                leaseId: lease.id,
            }).returning();
            const fullApplicationResult = await tx
                .select()
                .from(schema_1.applications)
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
                .where((0, drizzle_orm_1.eq)(schema_1.applications.id, application.id))
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
        try {
            await (0, emailService_1.sendEmail)({
                to: email,
                subject: emailTemplates_1.applicationSubmittedTemplate.subject,
                body: emailTemplates_1.applicationSubmittedTemplate.body(name, location?.address || '', new Date(applicationDate).toLocaleDateString(), property.pricePerYear, property.pricePerYear * 0.15, property.pricePerYear * 0.1)
            });
            if (landlord?.email) {
                await (0, emailService_1.sendEmail)({
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
        }
        catch (emailError) {
            console.error('Error sending emails:', emailError);
        }
        res.status(201).json(newApplication);
    }
    catch (error) {
        console.error('Error creating application with files:', error);
        res.status(500).json({ message: `Error creating application: ${error.message}` });
    }
};
exports.createApplicationWithFiles = createApplicationWithFiles;
const createApplication = async (req, res) => {
    try {
        const { applicationDate, status, propertyId, tenantCognitoId, name, email, phoneNumber, preferredMoveInDate, desiredLeaseDuration, gender, dateOfBirth, nationality, maritalStatus, idType, idDocumentUrl, durationAtCurrentAddress, employmentStatus, occupation, employerName, workAddress, monthlyIncome, durationAtCurrentJob, incomeProofUrl, previousEmployerName, previousJobTitle, previousEmploymentDuration, reasonForLeavingPrevJob, numberOfOccupants, relationshipToOccupants, hasPets, isSmoker, accessibilityNeeds, reasonForLeaving, consentToInformation, consentToVerification, consentToTenancyTerms, consentToPrivacyPolicy, } = req.body;
        const propertyResult = await database_1.db
            .select()
            .from(schema_1.properties)
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
            .limit(1);
        const property = propertyResult[0]?.Property;
        const landlord = propertyResult[0]?.Landlord;
        const location = propertyResult[0]?.Location;
        if (!property) {
            res.status(404).json({ message: "Property not found" });
            return;
        }
        const existingApplicationResult = await database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, tenantCognitoId), (0, drizzle_orm_1.inArray)(schema_1.applications.status, ['Pending', 'Approved'])))
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
        const newApplication = await database_1.db.transaction(async (tx) => {
            const [lease] = await tx.insert(schema_1.leases).values({
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                rent: property.pricePerYear,
                deposit: property.securityDeposit || 0,
                propertyId: propertyId,
                tenantCognitoId: tenantCognitoId,
            }).returning();
            const [application] = await tx.insert(schema_1.applications).values({
                applicationDate: new Date(applicationDate),
                status,
                name,
                email,
                phoneNumber,
                preferredMoveInDate: preferredMoveInDate ? new Date(preferredMoveInDate) : null,
                desiredLeaseDuration,
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
                leaseId: lease.id,
            }).returning();
            const applicationWithDetails = await tx
                .select()
                .from(schema_1.applications)
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
                .where((0, drizzle_orm_1.eq)(schema_1.applications.id, application.id))
                .limit(1);
            const result = applicationWithDetails[0];
            await (0, emailService_1.sendEmail)({
                to: email,
                subject: emailTemplates_1.applicationSubmittedTemplate.subject,
                body: emailTemplates_1.applicationSubmittedTemplate.body(name, location?.address || '', new Date(applicationDate).toLocaleDateString(), property.pricePerYear, property.pricePerYear * 0.15, property.pricePerYear * 0.1)
            });
            if (landlord?.email) {
                await (0, emailService_1.sendEmail)({
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
    }
    catch (error) {
        res.status(500).json({ message: `Error creating application: ${error.message}` });
    }
};
exports.createApplication = createApplication;
const updateApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, userType } = req.body;
        if (userType !== 'admin') {
            res.status(403).json({ message: "Only administrators can approve or deny applications." });
            return;
        }
        const applicationResult = await database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
            .where((0, drizzle_orm_1.eq)(schema_1.applications.id, Number(id)))
            .limit(1);
        const application = applicationResult[0]?.Application;
        const property = applicationResult[0]?.Property;
        const location = applicationResult[0]?.Location;
        const tenant = applicationResult[0]?.Tenant;
        if (!application) {
            res.status(404).json({ message: "Application not found." });
            return;
        }
        if (status === "Approved") {
            const paymentDeadline = new Date();
            paymentDeadline.setDate(paymentDeadline.getDate() + 7);
            await database_1.db.update(schema_1.applications)
                .set({
                status,
                paymentDeadline
            })
                .where((0, drizzle_orm_1.eq)(schema_1.applications.id, Number(id)));
            await (0, emailService_1.sendEmail)({
                to: tenant?.email || '',
                subject: emailTemplates_1.applicationApprovedTemplate.subject,
                body: emailTemplates_1.applicationApprovedTemplate.body(tenant?.name || '', location?.address || '', application.propertyId, property?.pricePerYear || 0, (property?.pricePerYear || 0) * 0.15, (property?.pricePerYear || 0) * 0.1)
            });
        }
        else if (status === "Denied") {
            await database_1.db.update(schema_1.applications)
                .set({ status })
                .where((0, drizzle_orm_1.eq)(schema_1.applications.id, Number(id)));
            await (0, emailService_1.sendEmail)({
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
        const updatedApplicationResult = await database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
            .where((0, drizzle_orm_1.eq)(schema_1.applications.id, Number(id)))
            .limit(1);
        res.json({
            applications: updatedApplicationResult[0]?.Application,
            properties: updatedApplicationResult[0]?.Property,
            tenants: updatedApplicationResult[0]?.Tenant,
            leases: updatedApplicationResult[0]?.Lease
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error updating application status: ${error.message}` });
    }
};
exports.updateApplicationStatus = updateApplicationStatus;
const getApplications = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, propertyId, tenantCognitoId } = req.query;
        const conditions = [];
        if (status && ['Pending', 'Denied', 'Approved'].includes(status)) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.applications.status, status));
        }
        if (propertyId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.applications.propertyId, Number(propertyId)));
        }
        if (tenantCognitoId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, tenantCognitoId));
        }
        const whereCondition = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        let query = database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
            .leftJoin(schema_1.payments, (0, drizzle_orm_1.eq)(schema_1.leases.id, schema_1.payments.leaseId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.applications.applicationDate))
            .limit(Number(limit))
            .offset((Number(page) - 1) * Number(limit));
        if (whereCondition) {
            query = query.where(whereCondition);
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
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching applications: ${error.message}` });
    }
};
exports.getApplications = getApplications;
const getApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const applicationResults = await database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
            .leftJoin(schema_1.payments, (0, drizzle_orm_1.eq)(schema_1.leases.id, schema_1.payments.leaseId))
            .where((0, drizzle_orm_1.eq)(schema_1.applications.id, parseInt(id)))
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
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching application: ${error.message}` });
    }
};
exports.getApplication = getApplication;
const checkPaymentDeadlines = async (_req, res) => {
    try {
        const expiredApplicationsResult = await database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.applications.status, 'Approved')));
        for (const result of expiredApplicationsResult) {
            const application = result.Application;
            const tenant = result.Tenant;
            const location = result.Location;
            if (application) {
                await database_1.db.update(schema_1.applications)
                    .set({
                    status: 'Denied',
                    paymentDeadline: null
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.applications.id, application.id));
                await (0, emailService_1.sendEmail)({
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
    }
    catch (error) {
        res.status(500).json({ message: `Error checking payment deadlines: ${error.message}` });
    }
};
exports.checkPaymentDeadlines = checkPaymentDeadlines;
const checkExistingApplication = async (req, res) => {
    try {
        const { tenantCognitoId } = req.query;
        if (!tenantCognitoId) {
            res.status(400).json({ message: "Tenant Cognito ID is required" });
            return;
        }
        const existingApplicationResult = await database_1.db
            .select()
            .from(schema_1.applications)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.applications.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.applications.leaseId, schema_1.leases.id))
            .leftJoin(schema_1.payments, (0, drizzle_orm_1.eq)(schema_1.leases.id, schema_1.payments.leaseId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, tenantCognitoId), (0, drizzle_orm_1.inArray)(schema_1.applications.status, ['Pending', 'Approved'])))
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
    }
    catch (error) {
        res.status(500).json({ message: `Error checking existing application: ${error.message}` });
    }
};
exports.checkExistingApplication = checkExistingApplication;
