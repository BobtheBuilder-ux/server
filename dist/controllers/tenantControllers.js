"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLandlordRegistrationLink = exports.getTenantLandlordInfo = exports.createTenantViaLandlordLink = exports.removeFavoriteProperty = exports.addFavoriteProperty = exports.getCurrentResidences = exports.updateTenant = exports.createTenant = exports.getTenant = void 0;
const wkt_1 = require("@terraformer/wkt");
const emailSubscriptionService_1 = require("../utils/emailSubscriptionService");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../auth");
const getTenant = async (req, res) => {
    try {
        const { authId } = req.params;
        const tenantResult = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, authId));
        let tenant = tenantResult[0];
        if (!tenant) {
            res.status(404).json({ message: "Tenant not found" });
            return;
        }
        res.json({
            id: tenant.id,
            cognitoId: tenant.cognitoId,
            name: tenant.name,
            email: tenant.email,
            phoneNumber: tenant.phoneNumber,
            userId: tenant.userId,
            houseAddress: tenant.houseAddress,
            registrationSource: tenant.registrationSource,
            registeredByLandlordId: tenant.registeredByLandlordId,
            currentPropertyId: tenant.currentPropertyId,
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving tenant: ${error.message}` });
    }
};
exports.getTenant = getTenant;
const createTenant = async (req, res) => {
    try {
        const { cognitoId, name, email, phoneNumber, userId } = req.body;
        const newTenant = await database_1.db.insert(schema_1.tenants).values({
            cognitoId,
            name,
            email,
            phoneNumber,
            userId,
        }).returning();
        try {
            await (0, emailSubscriptionService_1.addToEmailList)({
                email,
                fullName: name,
                subscriptionType: 'newsletter'
            });
        }
        catch (emailError) {
            console.error("Failed to add to email list:", emailError);
        }
        res.status(201).json({
            message: "Tenant created successfully",
            tenant: newTenant[0],
        });
    }
    catch (error) {
        if (error.code === "23505") {
            res.status(409).json({ message: "Tenant with this email already exists" });
        }
        else {
            res.status(500).json({ message: `Error creating tenant: ${error.message}` });
        }
    }
};
exports.createTenant = createTenant;
const updateTenant = async (req, res) => {
    try {
        const { authId } = req.params;
        const updateData = req.body;
        const updatedTenant = await database_1.db.update(schema_1.tenants)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, authId))
            .returning();
        if (updatedTenant.length === 0) {
            res.status(404).json({ message: "Tenant not found" });
            return;
        }
        res.json({
            message: "Tenant updated successfully",
            tenant: updatedTenant[0],
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error updating tenant: ${error.message}` });
    }
};
exports.updateTenant = updateTenant;
const getCurrentResidences = async (req, res) => {
    try {
        const { authId } = req.params;
        const tenantResult = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, authId));
        let tenant = tenantResult[0];
        if (!tenant) {
            res.status(404).json({ message: "Tenant not found" });
            return;
        }
        const rentalResult = await database_1.db.select()
            .from(schema_1.landlordTenantRentals)
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.landlordTenantRentals.landlordId, schema_1.landlords.id))
            .where((0, drizzle_orm_1.eq)(schema_1.landlordTenantRentals.tenantId, tenant.id));
        if (rentalResult.length > 0 && rentalResult[0].LandlordTenantRental) {
            const rental = rentalResult[0].LandlordTenantRental;
            const landlord = rentalResult[0].Landlord;
            const residence = {
                id: rental.id,
                leaseId: null,
                name: `Residence at ${rental.propertyAddress}`,
                description: `Rental property managed by ${landlord?.name || 'Landlord'}`,
                pricePerYear: rental.rentAmount,
                beds: null,
                baths: null,
                propertyType: 'Rental',
                photoUrls: [],
                amenities: null,
                postedDate: rental.createdAt,
                landlordCognitoId: landlord?.cognitoId,
                status: 'Available',
                location: {
                    id: null,
                    address: rental.propertyAddress,
                    city: null,
                    state: null,
                    country: null,
                    postalCode: null,
                    coordinates: { longitude: 0, latitude: 0 }
                },
                rental: {
                    rentAmount: rental.rentAmount,
                    rentDueDate: rental.rentDueDate,
                    paymentMethod: rental.paymentMethod,
                    isRentOverdue: rental.isRentOverdue,
                    leaseStartDate: rental.leaseStartDate,
                    leaseEndDate: rental.leaseEndDate
                },
                landlord: landlord ? {
                    id: landlord.id,
                    name: landlord.name,
                    email: landlord.email,
                    phoneNumber: landlord.phoneNumber
                } : null
            };
            res.json({ residences: [residence] });
            return;
        }
        const leaseResults = await database_1.db.select()
            .from(schema_1.leases)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .where((0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, authId));
        if (!leaseResults.length) {
            res.json({ residences: [] });
            return;
        }
        const residences = leaseResults.map(result => {
            const lease = result.Lease;
            const property = result.Property;
            const location = result.Location;
            const landlord = result.Landlord;
            return {
                id: property?.id || lease.id,
                leaseId: lease.id,
                name: property?.name || `Residence at ${location?.address || 'N/A'}`,
                description: landlord?.name ? `Rental property managed by ${landlord.name}` : 'Rental property',
                pricePerYear: lease.rent,
                beds: property?.beds ?? null,
                baths: property?.baths ?? null,
                propertyType: property?.propertyType || 'Rental',
                photoUrls: property?.photoUrls || [],
                amenities: property?.amenities ?? null,
                postedDate: lease.startDate,
                landlordCognitoId: landlord?.cognitoId,
                status: property?.status || 'Closed',
                location: {
                    id: location?.id ?? null,
                    address: location?.address || 'N/A',
                    city: location?.city || null,
                    state: location?.state || null,
                    country: location?.country || null,
                    postalCode: location?.postalCode || null,
                    coordinates: { longitude: 0, latitude: 0 },
                },
                rental: {
                    rentAmount: lease.rent,
                    rentDueDate: new Date(new Date(lease.startDate).setFullYear(new Date(lease.startDate).getFullYear() + 1)),
                    paymentMethod: 'Paystack',
                    isRentOverdue: false,
                    leaseStartDate: lease.startDate,
                    leaseEndDate: lease.endDate,
                },
                landlord: landlord ? {
                    id: landlord.id,
                    name: landlord.name,
                    email: landlord.email,
                    phoneNumber: landlord.phoneNumber
                } : null
            };
        });
        res.json({ residences });
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving current residences: ${error.message}` });
    }
};
exports.getCurrentResidences = getCurrentResidences;
const addFavoriteProperty = async (req, res) => {
    try {
        const { authId, propertyId } = req.params;
        const tenantResult = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, authId));
        const tenant = tenantResult[0];
        if (!tenant) {
            res.status(404).json({ message: "Tenant not found" });
            return;
        }
        await database_1.db.insert(schema_1.tenantFavorites).values({
            tenantId: tenant.id,
            propertyId: parseInt(propertyId),
        });
        res.status(201).json({ message: "Property added to favorites" });
    }
    catch (error) {
        if (error.code === "23505") {
            res.status(409).json({ message: "Property already in favorites" });
        }
        else {
            res.status(500).json({ message: `Error adding favorite property: ${error.message}` });
        }
    }
};
exports.addFavoriteProperty = addFavoriteProperty;
const removeFavoriteProperty = async (req, res) => {
    try {
        const { authId, propertyId } = req.params;
        const tenantResult = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, authId));
        const tenant = tenantResult[0];
        if (!tenant) {
            res.status(404).json({ message: "Tenant not found" });
            return;
        }
        await database_1.db.delete(schema_1.tenantFavorites).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.tenantFavorites.tenantId, tenant.id), (0, drizzle_orm_1.eq)(schema_1.tenantFavorites.propertyId, parseInt(propertyId))));
        res.json({ message: "Property removed from favorites" });
    }
    catch (error) {
        res.status(500).json({ message: `Error removing favorite property: ${error.message}` });
    }
};
exports.removeFavoriteProperty = removeFavoriteProperty;
const createTenantViaLandlordLink = async (req, res) => {
    try {
        const { registrationLink, cognitoId, name, email, phoneNumber, userId, houseAddress, rentAmount, rentDueDate, paymentMethod, propertyAddress, propertyId } = req.body;
        console.log('🔍 DEBUG: createTenantViaLandlordLink called with:', {
            registrationLink,
            cognitoId,
            name,
            email,
            phoneNumber,
            userId,
            houseAddress
        });
        const landlordResult = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.tenantRegistrationLink, registrationLink));
        const landlord = landlordResult[0];
        console.log('🔍 DEBUG: Landlord lookup result:', {
            registrationLink,
            landlordFound: !!landlord,
            landlordId: landlord?.id,
            landlordName: landlord?.name
        });
        if (!landlord) {
            console.log('❌ DEBUG: Invalid registration link:', registrationLink);
            res.status(404).json({ message: "Invalid or expired registration link" });
            return;
        }
        let finalUserId = userId;
        if (!finalUserId) {
            console.log('🔍 DEBUG: No userId provided, creating user account first');
            try {
                const userResult = await auth_1.auth.api.signUpEmail({
                    body: {
                        email,
                        password: Math.random().toString(36).substring(2, 15),
                        name,
                        role: "tenant",
                        phoneNumber,
                    },
                    headers: {
                        'x-registration-source': 'landlord-link',
                        'x-landlord-id': landlord.id,
                        'x-house-address': houseAddress,
                    },
                });
                if (userResult.user) {
                    finalUserId = userResult.user.id;
                    console.log('✅ DEBUG: User account created successfully:', {
                        userId: finalUserId,
                        email: userResult.user.email
                    });
                }
                else {
                    console.log('❌ DEBUG: Failed to create user account');
                    res.status(500).json({ message: "Failed to create user account" });
                    return;
                }
            }
            catch (userError) {
                console.error('❌ DEBUG: Error creating user account:', userError);
                if (userError.message && userError.message.includes('already exists')) {
                    const existingUserResult = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
                    const existingUser = existingUserResult[0];
                    if (existingUser) {
                        finalUserId = existingUser.id;
                        console.log('✅ DEBUG: Using existing user account:', {
                            userId: finalUserId,
                            email: existingUser.email
                        });
                    }
                    else {
                        res.status(409).json({ message: "User with this email already exists but could not be found" });
                        return;
                    }
                }
                else {
                    res.status(500).json({ message: `Error creating user account: ${userError.message}` });
                    return;
                }
            }
        }
        const [existingTenant] = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.userId, finalUserId)).limit(1);
        let newTenant;
        if (existingTenant) {
            console.log('🔍 DEBUG: Updating existing tenant with landlord link data');
            newTenant = await database_1.db.update(schema_1.tenants)
                .set({
                houseAddress,
                registrationSource: 'landlord_link',
                registeredByLandlordId: landlord.id,
                currentPropertyId: propertyId ? Number(propertyId) : null,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.tenants.userId, finalUserId))
                .returning();
        }
        else {
            const tenantData = {
                cognitoId: cognitoId || `tenant-${finalUserId}`,
                name,
                email,
                phoneNumber,
                userId: finalUserId,
                houseAddress,
                registrationSource: 'landlord_link',
                registeredByLandlordId: landlord.id,
                currentPropertyId: propertyId ? Number(propertyId) : null,
            };
            console.log('🔍 DEBUG: Creating tenant with data:', tenantData);
            newTenant = await database_1.db.insert(schema_1.tenants).values(tenantData).returning();
        }
        console.log('✅ DEBUG: Tenant created successfully:', {
            tenantId: newTenant[0].id,
            registeredByLandlordId: newTenant[0].registeredByLandlordId,
            registrationSource: newTenant[0].registrationSource
        });
        console.log('🔍 DEBUG: Creating rental record with data:', {
            tenantId: newTenant[0].id,
            landlordId: landlord.id,
            rentAmount: rentAmount || 500000,
            rentDueDate: rentDueDate ? new Date(rentDueDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            paymentMethod: paymentMethod || 'bank_transfer',
            propertyAddress: propertyAddress || houseAddress || 'Address to be updated'
        });
        const rentalResult = await database_1.db.insert(schema_1.landlordTenantRentals).values({
            tenantId: newTenant[0].id,
            landlordId: landlord.id,
            rentAmount: rentAmount || 500000,
            rentDueDate: rentDueDate ? new Date(rentDueDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            paymentMethod: paymentMethod || 'bank_transfer',
            propertyAddress: propertyAddress || houseAddress || 'Address to be updated',
            isRentOverdue: false,
            applicationFeeAdded: false,
            securityDepositAdded: false,
            hasBeenEditedByLandlord: false,
        }).returning();
        console.log('✅ DEBUG: Rental record created successfully:', rentalResult[0]);
        try {
            await (0, emailSubscriptionService_1.addToEmailList)({
                email,
                fullName: name,
                subscriptionType: 'newsletter'
            });
        }
        catch (emailError) {
            console.error("Failed to add to email list:", emailError);
        }
        try {
            await (0, emailSubscriptionService_1.sendTenantWelcomeEmail)(email, name);
        }
        catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
        }
        res.status(201).json({
            message: "Tenant created successfully via landlord link",
            tenant: newTenant[0],
            landlordInfo: {
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                address: landlord.currentAddress,
            },
            rentalInfo: rentalResult[0],
        });
    }
    catch (error) {
        if (error.code === "23505") {
            res.status(409).json({ message: "Tenant with this email already exists" });
        }
        else {
            res.status(500).json({ message: `Error creating tenant via landlord link: ${error.message}` });
        }
    }
};
exports.createTenantViaLandlordLink = createTenantViaLandlordLink;
const getTenantLandlordInfo = async (req, res) => {
    try {
        const { authId } = req.params;
        console.log(`🔍 getTenantLandlordInfo called with authId: ${authId}`);
        const tenantResult = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, authId));
        let tenant = tenantResult[0];
        console.log(`🔍 Found tenant:`, tenant ? { id: tenant.id, cognitoId: tenant.cognitoId, name: tenant.name } : 'null');
        if (!tenant) {
            const tenantByUserIdResult = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.userId, authId));
            const tenantByUserId = tenantByUserIdResult[0];
            console.log(`🔍 Fallback search by userId:`, tenantByUserId ? { id: tenantByUserId.id, userId: tenantByUserId.userId, name: tenantByUserId.name } : 'null');
            if (tenantByUserId) {
                tenant = tenantByUserId;
            }
            else {
                res.status(404).json({ message: "Tenant not found" });
                return;
            }
        }
        if (tenant.registeredByLandlordId) {
            const landlordResult = await database_1.db.select({
                id: schema_1.landlords.id,
                name: schema_1.landlords.name,
                email: schema_1.landlords.email,
                phoneNumber: schema_1.landlords.phoneNumber,
                currentAddress: schema_1.landlords.currentAddress,
                cognitoId: schema_1.landlords.cognitoId,
            }).from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.id, tenant.registeredByLandlordId));
            const landlord = landlordResult[0];
            const rentalResult = await database_1.db.select().from(schema_1.landlordTenantRentals).where((0, drizzle_orm_1.eq)(schema_1.landlordTenantRentals.tenantId, tenant.id));
            const rental = rentalResult[0];
            res.json({
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    email: tenant.email,
                    phoneNumber: tenant.phoneNumber,
                    houseAddress: tenant.houseAddress,
                    registrationSource: tenant.registrationSource,
                },
                landlord: landlord ? {
                    id: landlord.id,
                    name: landlord.name,
                    email: landlord.email,
                    phoneNumber: landlord.phoneNumber,
                    address: landlord.currentAddress,
                } : null,
                rental: rental ? {
                    rentAmount: rental.rentAmount,
                    rentDueDate: rental.rentDueDate,
                    paymentMethod: rental.paymentMethod,
                    propertyAddress: rental.propertyAddress,
                    isRentOverdue: rental.isRentOverdue,
                    applicationFeeAdded: rental.applicationFeeAdded,
                    securityDepositAdded: rental.securityDepositAdded,
                    hasBeenEditedByLandlord: rental.hasBeenEditedByLandlord,
                } : null
            });
        }
        else {
            const rentalJoin = await database_1.db.select()
                .from(schema_1.landlordTenantRentals)
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.landlordTenantRentals.landlordId, schema_1.landlords.id))
                .where((0, drizzle_orm_1.eq)(schema_1.landlordTenantRentals.tenantId, tenant.id));
            const rental = rentalJoin[0]?.LandlordTenantRental || null;
            const landlord = rentalJoin[0]?.Landlord || null;
            res.json({
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    email: tenant.email,
                    phoneNumber: tenant.phoneNumber,
                    houseAddress: tenant.houseAddress,
                    registrationSource: tenant.registrationSource,
                },
                landlord: landlord ? {
                    id: landlord.id,
                    name: landlord.name,
                    email: landlord.email,
                    phoneNumber: landlord.phoneNumber,
                    address: landlord.currentAddress,
                } : null,
                rental: rental ? {
                    rentAmount: rental.rentAmount,
                    rentDueDate: rental.rentDueDate,
                    paymentMethod: rental.paymentMethod,
                    propertyAddress: rental.propertyAddress,
                    isRentOverdue: rental.isRentOverdue,
                    applicationFeeAdded: rental.applicationFeeAdded,
                    securityDepositAdded: rental.securityDepositAdded,
                    hasBeenEditedByLandlord: rental.hasBeenEditedByLandlord,
                } : null
            });
        }
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving tenant landlord info: ${error.message}` });
    }
};
exports.getTenantLandlordInfo = getTenantLandlordInfo;
const validateLandlordRegistrationLink = async (req, res) => {
    try {
        const { registrationLink } = req.params;
        const { property: propertyId } = req.query;
        console.log(`Validating registration link: ${registrationLink}`);
        const landlordResult = await database_1.db.select({
            id: schema_1.landlords.id,
            name: schema_1.landlords.name,
            email: schema_1.landlords.email,
            cognitoId: schema_1.landlords.cognitoId,
            linkGeneratedAt: schema_1.landlords.linkGeneratedAt,
        }).from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.tenantRegistrationLink, registrationLink));
        const landlord = landlordResult[0];
        if (!landlord) {
            console.log(`No landlord found for registration link: ${registrationLink}`);
            res.status(404).json({
                message: "Invalid registration link. Please contact your landlord for a new link.",
                isValid: false
            });
            return;
        }
        console.log(`Found landlord: ${landlord.name} for registration link`);
        let propertyInfo = null;
        let landlordProperties = [];
        if (propertyId) {
            const propertyResult = await database_1.db.select()
                .from(schema_1.properties)
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.properties.id, Number(propertyId)), (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, landlord.cognitoId)));
            if (propertyResult.length > 0) {
                const property = propertyResult[0].Property;
                const location = propertyResult[0].Location;
                let coordinates = null;
                if (location?.id) {
                    try {
                        const coordResult = await database_1.db.execute((0, drizzle_orm_1.sql) `SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${location.id}`);
                        const coordinateValue = coordResult.rows[0]?.coordinates || "POINT(0 0)";
                        const geoJSON = (0, wkt_1.wktToGeoJSON)(coordinateValue);
                        coordinates = {
                            longitude: geoJSON.coordinates[0],
                            latitude: geoJSON.coordinates[1],
                        };
                    }
                    catch (coordError) {
                        console.error('Error getting coordinates:', coordError);
                    }
                }
                propertyInfo = {
                    ...property,
                    location: location ? {
                        ...location,
                        coordinates
                    } : null
                };
            }
        }
        const propertiesResult = await database_1.db.select()
            .from(schema_1.properties)
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, landlord.cognitoId));
        landlordProperties = await Promise.all(propertiesResult.map(async (result) => {
            const property = result.Property;
            const location = result.Location;
            let coordinates = null;
            if (location?.id) {
                try {
                    const coordResult = await database_1.db.execute((0, drizzle_orm_1.sql) `SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${location.id}`);
                    const coordinateValue = coordResult.rows[0]?.coordinates || "POINT(0 0)";
                    const geoJSON = (0, wkt_1.wktToGeoJSON)(coordinateValue);
                    coordinates = {
                        longitude: geoJSON.coordinates[0],
                        latitude: geoJSON.coordinates[1],
                    };
                }
                catch (coordError) {
                    console.error('Error getting coordinates:', coordError);
                }
            }
            return {
                ...property,
                location: location ? {
                    ...location,
                    coordinates
                } : null
            };
        }));
        res.json({
            isValid: true,
            landlord: {
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                cognitoId: landlord.cognitoId,
                linkGeneratedAt: landlord.linkGeneratedAt,
            },
            propertyInfo,
            landlordProperties
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error validating registration link: ${error.message}` });
    }
};
exports.validateLandlordRegistrationLink = validateLandlordRegistrationLink;
