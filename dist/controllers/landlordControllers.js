"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editTenantInfo = exports.getLandlordTenants = exports.getTenantRegistrationLink = exports.generateTenantRegistrationLink = exports.getLandlordProperties = exports.updateLandlord = exports.registerLandlordWithCode = exports.impersonateLandlord = exports.listLandlords = exports.adminCreateLandlord = exports.createLandlord = exports.getLandlord = void 0;
const tslib_1 = require("tslib");
const wkt_1 = require("@terraformer/wkt");
const emailSubscriptionService_1 = require("../utils/emailSubscriptionService");
const emailService_1 = require("../utils/emailService");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const qrCodeService_1 = require("../services/qrCodeService");
const auth_1 = require("../auth");
const getLandlord = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const landlordResult = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId));
        const landlord = landlordResult[0];
        if (landlord) {
            res.json(landlord);
        }
        else {
            res.status(404).json({ message: "Landlord not found" });
        }
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving landlord: ${error.message}` });
    }
};
exports.getLandlord = getLandlord;
const createLandlord = async (req, res) => {
    try {
        const { cognitoId, name, email, phoneNumber } = req.body;
        const landlordResult = await database_1.db.insert(schema_1.landlords).values({
            cognitoId,
            name,
            email,
            phoneNumber,
        }).returning();
        const landlord = landlordResult[0];
        try {
            await (0, emailSubscriptionService_1.sendLandlordWelcomeEmail)(landlord.email, landlord.name);
            console.log(`Welcome email sent to landlord: ${landlord.email}`);
        }
        catch (emailError) {
            console.error('Error sending landlord welcome email:', emailError);
        }
        try {
            await (0, emailSubscriptionService_1.addToEmailList)({
                email: landlord.email,
                fullName: landlord.name,
                subscriptionType: 'newsletter'
            });
            console.log(`Added landlord ${landlord.email} to email list`);
        }
        catch (emailError) {
            console.error('Error adding landlord to email list:', emailError);
        }
        res.status(201).json(landlord);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error creating landlord: ${error.message}` });
    }
};
exports.createLandlord = createLandlord;
const adminCreateLandlord = async (req, res) => {
    try {
        const { name, email, phoneNumber, accountName, accountNumber, bankName } = req.body;
        if (!name || !email || !phoneNumber || !accountName || !accountNumber || !bankName) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }
        const existingUser = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email)).limit(1);
        if (existingUser[0]) {
            const existingLandlord = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.userId, existingUser[0].id)).limit(1);
            if (existingLandlord[0]) {
                res.status(409).json({ message: "Landlord already exists" });
                return;
            }
        }
        const password = crypto_1.default.randomBytes(12).toString("base64");
        const created = await auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                role: "landlord",
                phoneNumber,
                callbackURL: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/verify-email`,
            },
            headers: req.headers
        });
        if (!created || !created.user) {
            res.status(500).json({ message: "Failed to create user" });
            return;
        }
        const user = created.user;
        await database_1.db.update(schema_1.users)
            .set({ emailVerified: true })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id));
        let createdByAgentId;
        if (req.user?.role === 'agent') {
            const agentRecord = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.userId, req.user.id)).limit(1);
            if (agentRecord[0]) {
                createdByAgentId = agentRecord[0].id;
            }
        }
        const landlordProfileResult = await database_1.db.insert(schema_1.landlords).values({
            cognitoId: user.legacyCognitoId || user.id,
            userId: user.id,
            name,
            email,
            phoneNumber,
            bankName,
            accountNumber,
            accountName,
            createdByAgentId
        }).returning();
        const landlordProfile = landlordProfileResult[0];
        try {
            await database_1.db.insert(schema_1.activityFeeds).values({
                type: 'LandlordRegistered',
                title: 'Landlord onboarded',
                description: `Landlord ${name} (${email}) was created`,
                actorId: req.user?.id || 'system',
                actorType: req.user?.role || 'admin',
                actorName: req.user?.name || 'Admin',
                targetId: landlordProfile.id,
                targetType: 'landlord',
                metadata: { phoneNumber, bankName, accountNumber, accountName },
                isPublic: false,
            });
        }
        catch { }
        await (0, emailService_1.sendEmail)({
            to: email,
            subject: "Welcome to HomeMatch",
            body: `
        <html>
          <body>
            <h2>Welcome to HomeMatch</h2>
            <p>Your landlord account has been created.</p>
            <p>Email: ${email}</p>
            <p>Password: ${password}</p>
          </body>
        </html>
      `,
        });
        res.status(201).json({ success: true, landlord: landlordProfile });
    }
    catch (error) {
        res.status(500).json({ message: `Error creating landlord: ${error.message}` });
    }
};
exports.adminCreateLandlord = adminCreateLandlord;
const listLandlords = async (req, res) => {
    try {
        let whereClause = undefined;
        if (req.user?.role === 'agent') {
            const agentRecord = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.userId, req.user.id)).limit(1);
            if (agentRecord[0]) {
                whereClause = (0, drizzle_orm_1.eq)(schema_1.landlords.createdByAgentId, agentRecord[0].id);
            }
            else {
                res.json({ success: true, data: [] });
                return;
            }
        }
        const rows = await database_1.db.select({
            id: schema_1.landlords.id,
            name: schema_1.landlords.name,
            email: schema_1.landlords.email,
            phoneNumber: schema_1.landlords.phoneNumber,
            userId: schema_1.landlords.userId,
            cognitoId: schema_1.landlords.cognitoId,
            createdAt: schema_1.landlords.createdAt,
            propertiesCount: (0, drizzle_orm_1.sql) `COUNT(${schema_1.properties.id})`
        })
            .from(schema_1.landlords)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, schema_1.properties.landlordCognitoId))
            .where(whereClause)
            .groupBy(schema_1.landlords.id);
        res.json({ success: true, data: rows });
    }
    catch (error) {
        res.status(500).json({ message: `Error listing landlords: ${error.message}` });
    }
};
exports.listLandlords = listLandlords;
const impersonateLandlord = async (req, res) => {
    try {
        const { userId: paramId } = req.params;
        console.log(`Attempting to impersonate user/landlord with ID: ${paramId}`);
        console.log(`Requester: ${JSON.stringify(req.user)}`);
        let targetUserId = paramId;
        const landlordResult = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, paramId));
        if (landlordResult.length > 0 && landlordResult[0].userId) {
            targetUserId = landlordResult[0].userId;
            console.log(`Resolved landlord cognitoId ${paramId} to userId ${targetUserId}`);
        }
        const session = await auth_1.auth.api.impersonateUser({
            body: { userId: targetUserId },
            headers: req.headers
        });
        try {
            await database_1.db.insert(schema_1.activityFeeds).values({
                type: 'AgentAssigned',
                title: 'Admin/Agent quick login',
                description: `User ${req.user?.email || req.user?.id} impersonated landlord ${paramId}`,
                actorId: req.user?.id || 'system',
                actorType: req.user?.role || 'admin',
                actorName: req.user?.name || 'Admin',
                targetId: null,
                targetType: 'landlord',
                metadata: { landlordUserId: targetUserId, originalParamId: paramId },
                isPublic: false,
            });
        }
        catch { }
        res.json({ success: true, data: session });
    }
    catch (error) {
        console.error("Impersonation error details:", error);
        if (error.body) {
            console.error("Error body:", error.body);
        }
        res.status(500).json({
            message: `Error impersonating landlord: ${error.message}`,
            details: error.toString(),
            stack: error.stack
        });
    }
};
exports.impersonateLandlord = impersonateLandlord;
const registerLandlordWithCode = async (req, res) => {
    try {
        const { cognitoId, name, email, phoneNumber, registrationCode } = req.body;
        const codeRecordResult = await database_1.db.select().from(schema_1.landlordRegistrationCodes).where((0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.code, registrationCode));
        const codeRecord = codeRecordResult[0];
        if (!codeRecord) {
            res.status(400).json({ message: "Invalid registration code" });
            return;
        }
        if (codeRecord.isUsed) {
            res.status(400).json({ message: "Registration code has already been used" });
            return;
        }
        const landlordResult = await database_1.db.insert(schema_1.landlords).values({
            cognitoId,
            name,
            email,
            phoneNumber,
            registrationCodeId: codeRecord.id,
        }).returning();
        const landlord = landlordResult[0];
        await database_1.db.update(schema_1.landlordRegistrationCodes)
            .set({
            isUsed: true,
            usedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.id, codeRecord.id));
        try {
            await (0, emailSubscriptionService_1.sendLandlordWelcomeEmail)(landlord.email, landlord.name);
            console.log(`Welcome email sent to landlord: ${landlord.email}`);
        }
        catch (emailError) {
            console.error('Error sending landlord welcome email:', emailError);
        }
        try {
            await (0, emailSubscriptionService_1.addToEmailList)({
                email: landlord.email,
                fullName: landlord.name,
                subscriptionType: 'newsletter'
            });
            console.log(`Added landlord ${landlord.email} to email list`);
        }
        catch (emailError) {
            console.error('Error adding landlord to email list:', emailError);
        }
        res.status(201).json(landlord);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error creating landlord: ${error.message}` });
    }
};
exports.registerLandlordWithCode = registerLandlordWithCode;
const updateLandlord = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const { name, email, phoneNumber, currentAddress, city, state, country, postalCode, bankName, accountNumber, accountName, bankCode, businessName, businessType, taxId, dateOfBirth, nationality, occupation, emergencyContactName, emergencyContactPhone } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (email !== undefined)
            updateData.email = email;
        if (phoneNumber !== undefined)
            updateData.phoneNumber = phoneNumber;
        if (currentAddress !== undefined)
            updateData.currentAddress = currentAddress;
        if (city !== undefined)
            updateData.city = city;
        if (state !== undefined)
            updateData.state = state;
        if (country !== undefined)
            updateData.country = country;
        if (postalCode !== undefined)
            updateData.postalCode = postalCode;
        if (bankName !== undefined)
            updateData.bankName = bankName;
        if (accountNumber !== undefined)
            updateData.accountNumber = accountNumber;
        if (accountName !== undefined)
            updateData.accountName = accountName;
        if (bankCode !== undefined)
            updateData.bankCode = bankCode;
        if (businessName !== undefined)
            updateData.businessName = businessName;
        if (businessType !== undefined)
            updateData.businessType = businessType;
        if (taxId !== undefined)
            updateData.taxId = taxId;
        if (dateOfBirth !== undefined)
            updateData.dateOfBirth = dateOfBirth;
        if (nationality !== undefined)
            updateData.nationality = nationality;
        if (occupation !== undefined)
            updateData.occupation = occupation;
        if (emergencyContactName !== undefined)
            updateData.emergencyContactName = emergencyContactName;
        if (emergencyContactPhone !== undefined)
            updateData.emergencyContactPhone = emergencyContactPhone;
        updateData.updatedAt = new Date();
        const landlordResult = await database_1.db.update(schema_1.landlords)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId))
            .returning();
        const landlord = landlordResult[0];
        res.json(landlord);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error updating landlord: ${error.message}` });
    }
};
exports.updateLandlord = updateLandlord;
const getLandlordProperties = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const propertiesResult = await database_1.db.select()
            .from(schema_1.properties)
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId));
        const formattedProperties = propertiesResult.map(row => ({
            ...row.Property,
            location: row.Location
        }));
        const propertiesWithFormattedLocation = await Promise.all(formattedProperties.map(async (property) => {
            if (property.location?.id) {
                const coordinates = await database_1.db.execute((0, drizzle_orm_1.sql) `SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`);
                const coordinateValue = coordinates.rows[0]?.coordinates || "POINT(0 0)";
                const geoJSON = (0, wkt_1.wktToGeoJSON)(coordinateValue);
                const longitude = geoJSON.coordinates[0];
                const latitude = geoJSON.coordinates[1];
                return {
                    ...property,
                    location: {
                        ...property.location,
                        coordinates: {
                            longitude,
                            latitude,
                        },
                    },
                };
            }
            return property;
        }));
        res.json(propertiesWithFormattedLocation);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: `Error retrieving landlord properties: ${err.message}` });
    }
};
exports.getLandlordProperties = getLandlordProperties;
const generateTenantRegistrationLink = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const { propertyId } = req.body;
        const tenantRegistrationLink = crypto_1.default.randomBytes(32).toString('hex');
        const updatedLandlordResult = await database_1.db.update(schema_1.landlords)
            .set({
            tenantRegistrationLink,
            linkGeneratedAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId))
            .returning();
        const updatedLandlord = updatedLandlordResult[0];
        if (!updatedLandlord) {
            res.status(404).json({ message: "Landlord not found" });
            return;
        }
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        try {
            let qrCodeData;
            if (propertyId) {
                qrCodeData = await qrCodeService_1.QRCodeService.generatePropertyTenantRegistrationQR(tenantRegistrationLink, propertyId, baseUrl);
            }
            else {
                qrCodeData = await qrCodeService_1.QRCodeService.generateTenantRegistrationQR(tenantRegistrationLink, baseUrl);
            }
            res.json({
                message: "Tenant registration link generated successfully",
                tenantRegistrationLink: updatedLandlord.tenantRegistrationLink,
                linkGeneratedAt: updatedLandlord.linkGeneratedAt,
                qrCode: {
                    dataURL: qrCodeData.dataURL,
                    svg: qrCodeData.svg,
                    fullUrl: qrCodeData.fullUrl
                }
            });
        }
        catch (qrError) {
            console.error('Error generating QR code:', qrError);
            res.json({
                message: "Tenant registration link generated successfully (QR code generation failed)",
                tenantRegistrationLink: updatedLandlord.tenantRegistrationLink,
                linkGeneratedAt: updatedLandlord.linkGeneratedAt,
                qrCode: null
            });
        }
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error generating tenant registration link: ${error.message}` });
    }
};
exports.generateTenantRegistrationLink = generateTenantRegistrationLink;
const getTenantRegistrationLink = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const { propertyId, regenerateQR } = req.query;
        const landlordResult = await database_1.db.select({
            tenantRegistrationLink: schema_1.landlords.tenantRegistrationLink,
            linkGeneratedAt: schema_1.landlords.linkGeneratedAt,
        }).from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId));
        const landlord = landlordResult[0];
        if (!landlord) {
            res.status(404).json({ message: "Landlord not found" });
            return;
        }
        if (!landlord.tenantRegistrationLink) {
            res.status(404).json({ message: "No tenant registration link found for this landlord" });
            return;
        }
        let qrCodeData = null;
        if (regenerateQR === 'true') {
            const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
            try {
                if (propertyId && typeof propertyId === 'string') {
                    qrCodeData = await qrCodeService_1.QRCodeService.generatePropertyTenantRegistrationQR(landlord.tenantRegistrationLink, propertyId, baseUrl);
                }
                else {
                    qrCodeData = await qrCodeService_1.QRCodeService.generateTenantRegistrationQR(landlord.tenantRegistrationLink, baseUrl);
                }
            }
            catch (qrError) {
                console.error('Error generating QR code:', qrError);
            }
        }
        res.json({
            tenantRegistrationLink: landlord.tenantRegistrationLink,
            linkGeneratedAt: landlord.linkGeneratedAt,
            qrCode: qrCodeData
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving tenant registration link: ${error.message}` });
    }
};
exports.getTenantRegistrationLink = getTenantRegistrationLink;
const getLandlordTenants = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const landlordResult = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId));
        const landlord = landlordResult[0];
        if (!landlord) {
            res.status(404).json({ message: "Landlord not found" });
            return;
        }
        const tenantsWithRentalInfo = await database_1.db
            .select({
            tenantId: schema_1.tenants.id,
            cognitoId: schema_1.tenants.cognitoId,
            firstName: schema_1.tenants.name,
            lastName: schema_1.tenants.name,
            email: schema_1.tenants.email,
            phoneNumber: schema_1.tenants.phoneNumber,
            houseAddress: schema_1.tenants.houseAddress,
            registrationSource: schema_1.tenants.registrationSource,
            registeredByLandlordId: schema_1.tenants.registeredByLandlordId,
            rentAmount: schema_1.landlordTenantRentals.rentAmount,
            rentDueDate: schema_1.landlordTenantRentals.rentDueDate,
            paymentMethod: schema_1.landlordTenantRentals.paymentMethod,
            propertyAddress: schema_1.landlordTenantRentals.propertyAddress,
            isRentOverdue: schema_1.landlordTenantRentals.isRentOverdue,
            hasBeenEditedByLandlord: schema_1.landlordTenantRentals.hasBeenEditedByLandlord,
        })
            .from(schema_1.tenants)
            .leftJoin(schema_1.landlordTenantRentals, (0, drizzle_orm_1.eq)(schema_1.tenants.id, schema_1.landlordTenantRentals.tenantId))
            .where((0, drizzle_orm_1.eq)(schema_1.tenants.registeredByLandlordId, landlord.id));
        const transformedTenants = tenantsWithRentalInfo.map(tenant => {
            let leaseStartDate = null;
            let leaseEndDate = null;
            if (tenant.rentDueDate) {
                leaseEndDate = new Date(tenant.rentDueDate);
                leaseStartDate = new Date(leaseEndDate);
                leaseStartDate.setFullYear(leaseStartDate.getFullYear() - 1);
            }
            return {
                ...tenant,
                propertyTitle: tenant.propertyAddress || "Property Address Not Set",
                annualRent: tenant.hasBeenEditedByLandlord ? (tenant.rentAmount || 0) : 0,
                hasBeenEdited: tenant.hasBeenEditedByLandlord || false,
                leaseStartDate: leaseStartDate ? leaseStartDate.toISOString() : null,
                leaseEndDate: leaseEndDate ? leaseEndDate.toISOString() : null,
            };
        });
        res.json(transformedTenants);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving landlord tenants: ${error.message}` });
    }
};
exports.getLandlordTenants = getLandlordTenants;
const editTenantInfo = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const { tenantId, fieldName, newValue } = req.body;
        const landlordResult = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId));
        const landlord = landlordResult[0];
        if (!landlord) {
            res.status(404).json({ message: "Landlord not found" });
            return;
        }
        const tenantResult = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.id, tenantId));
        const tenant = tenantResult[0];
        if (!tenant) {
            res.status(404).json({ message: "Tenant not found" });
            return;
        }
        if (tenant.registeredByLandlordId !== landlord.id) {
            res.status(403).json({ message: "Unauthorized: Tenant does not belong to this landlord" });
            return;
        }
        const rentalResult = await database_1.db.select().from(schema_1.landlordTenantRentals).where((0, drizzle_orm_1.eq)(schema_1.landlordTenantRentals.tenantId, tenantId));
        const rental = rentalResult[0];
        if (!rental) {
            res.status(404).json({ message: "Rental record not found" });
            return;
        }
        if (rental.hasBeenEditedByLandlord) {
            res.status(403).json({ message: "You have already edited this tenant's information. Only one edit is allowed per tenant." });
            return;
        }
        const rentalFields = ['rentAmount', 'rentDueDate', 'paymentMethod', 'propertyAddress'];
        const tenantFields = ['houseAddress'];
        const leaseFields = ['leaseStartDate', 'leaseEndDate'];
        const allowedFields = [...rentalFields, ...tenantFields, ...leaseFields];
        if (!allowedFields.includes(fieldName)) {
            res.status(400).json({ message: "Invalid field name" });
            return;
        }
        let updateData = {};
        let tenantUpdateData = {};
        if (rentalFields.includes(fieldName)) {
            if (fieldName === 'rentAmount') {
                updateData[fieldName] = parseFloat(newValue);
            }
            else if (fieldName === 'rentDueDate') {
                updateData[fieldName] = new Date(newValue);
            }
            else {
                updateData[fieldName] = newValue;
            }
        }
        else if (tenantFields.includes(fieldName)) {
            tenantUpdateData[fieldName] = newValue;
        }
        else if (leaseFields.includes(fieldName)) {
            const dateValue = new Date(newValue);
            if (isNaN(dateValue.getTime())) {
                res.status(400).json({ error: 'Invalid date format' });
                return;
            }
            updateData[fieldName] = dateValue;
        }
        const currentDate = new Date();
        const rentDueDate = fieldName === 'rentDueDate' ? new Date(newValue) : rental.rentDueDate;
        const isOverdue = rentDueDate < currentDate;
        if (isOverdue && !rental.applicationFeeAdded && !rental.securityDepositAdded) {
            const rentAmount = fieldName === 'rentAmount' ? parseFloat(newValue) : rental.rentAmount;
            const applicationFee = rentAmount * 0.15;
            const securityDeposit = rentAmount * 0.1;
            updateData.isRentOverdue = true;
            updateData.applicationFeeAdded = true;
            updateData.securityDepositAdded = true;
            console.log(`Rent is overdue. Adding application fee (₦${applicationFee}) and security deposit (₦${securityDeposit})`);
        }
        updateData.hasBeenEditedByLandlord = true;
        const updatedRentalResult = await database_1.db.update(schema_1.landlordTenantRentals)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.landlordTenantRentals.tenantId, tenantId))
            .returning();
        const updatedRental = updatedRentalResult[0];
        if (!updatedRental) {
            res.status(500).json({ message: "Failed to update rental information" });
            return;
        }
        await database_1.db.insert(schema_1.tenantEditAuditLog).values({
            tenantId: tenantId,
            landlordId: landlord.id,
            fieldName: fieldName,
            oldValue: rental[fieldName]?.toString() || '',
            newValue: newValue.toString(),
            editedBy: cognitoId,
            isOneTimeEdit: true,
            editedAt: new Date(),
        });
        console.log(`Landlord ${cognitoId} edited tenant ${tenantId} field ${fieldName} to:`, newValue);
        res.json({
            message: "Tenant rental information updated successfully",
            rental: updatedRental,
            feesAdded: isOverdue && !rental.applicationFeeAdded && !rental.securityDepositAdded,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error editing tenant information: ${error.message}` });
    }
};
exports.editTenantInfo = editTenantInfo;
