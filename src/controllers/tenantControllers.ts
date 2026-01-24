import { Request, Response } from "express";
import { wktToGeoJSON } from "@terraformer/wkt";
import { addToEmailList, sendTenantWelcomeEmail } from "../utils/emailSubscriptionService";
import { db } from "../utils/database";
import { tenants, tenantFavorites, properties, locations, leases, landlords, landlordTenantRentals, users } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "../auth";

export const getTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { authId } = req.params;
    const tenantResult = await db.select().from(tenants).where(eq(tenants.cognitoId, authId));
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
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving tenant: ${error.message}` });
  }
};

export const createTenant = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId, name, email, phoneNumber, userId } = req.body;

    const newTenant = await db.insert(tenants).values({
      cognitoId,
      name,
      email,
      phoneNumber,
      userId,
    }).returning();

    // Add to email list
    try {
      await addToEmailList({
        email,
        fullName: name,
        subscriptionType: 'newsletter'
      });
    } catch (emailError) {
      console.error("Failed to add to email list:", emailError);
    }

    res.status(201).json({
      message: "Tenant created successfully",
      tenant: newTenant[0],
    });
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ message: "Tenant with this email already exists" });
    } else {
      res.status(500).json({ message: `Error creating tenant: ${error.message}` });
    }
  }
};

export const updateTenant = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId } = req.params;
    const updateData = req.body;

    const updatedTenant = await db.update(tenants)
      .set(updateData)
      .where(eq(tenants.cognitoId, authId))
      .returning();

    if (updatedTenant.length === 0) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }

    res.json({
      message: "Tenant updated successfully",
      tenant: updatedTenant[0],
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error updating tenant: ${error.message}` });
  }
};

export const getCurrentResidences = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId } = req.params;

    const tenantResult = await db.select().from(tenants).where(eq(tenants.cognitoId, authId));
    let tenant = tenantResult[0];

    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }

    // First try rental information from LandlordTenantRental table
    const rentalResult = await db.select()
      .from(landlordTenantRentals)
      .leftJoin(landlords, eq(landlordTenantRentals.landlordId, landlords.id))
      .where(eq(landlordTenantRentals.tenantId, tenant.id));

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

    // Fallback: derive current residences from leases created via payment
    const leaseResults = await db.select()
      .from(leases)
      .leftJoin(properties, eq(leases.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .where(eq(leases.tenantCognitoId, authId));

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
        photoUrls: (property?.photoUrls as string[]) || [],
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
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving current residences: ${error.message}` });
  }
};

export const addFavoriteProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId, propertyId } = req.params;

    const tenantResult = await db.select().from(tenants).where(eq(tenants.cognitoId, authId));
    const tenant = tenantResult[0];

    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }

    await db.insert(tenantFavorites).values({
      tenantId: tenant.id,
      propertyId: parseInt(propertyId),
    });

    res.status(201).json({ message: "Property added to favorites" });
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ message: "Property already in favorites" });
    } else {
      res.status(500).json({ message: `Error adding favorite property: ${error.message}` });
    }
  }
};

export const removeFavoriteProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId, propertyId } = req.params;

    const tenantResult = await db.select().from(tenants).where(eq(tenants.cognitoId, authId));
    const tenant = tenantResult[0];

    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }

    await db.delete(tenantFavorites).where(
      and(
        eq(tenantFavorites.tenantId, tenant.id),
        eq(tenantFavorites.propertyId, parseInt(propertyId))
      )
    );

    res.json({ message: "Property removed from favorites" });
  } catch (error: any) {
    res.status(500).json({ message: `Error removing favorite property: ${error.message}` });
  }
};

export const createTenantViaLandlordLink = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { 
      registrationLink,
      cognitoId, 
      name, 
      email, 
      phoneNumber, 
      userId, 
      houseAddress,
      rentAmount,
      rentDueDate,
      paymentMethod,
      propertyAddress,
      propertyId
    } = req.body;

    console.log('🔍 DEBUG: createTenantViaLandlordLink called with:', {
      registrationLink,
      cognitoId,
      name,
      email,
      phoneNumber,
      userId,
      houseAddress
    });

    // Validate landlord registration link
    const landlordResult = await db.select().from(landlords).where(
      eq(landlords.tenantRegistrationLink, registrationLink)
    );
    
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

    // First, create a user account in Better Auth if userId is not provided
    let finalUserId = userId;
    
    if (!finalUserId) {
      console.log('🔍 DEBUG: No userId provided, creating user account first');
      
      try {
        // Create user account using Better Auth
        const userResult = await auth.api.signUpEmail({
          body: {
            email,
            password: Math.random().toString(36).substring(2, 15), // Generate random password
            name,
            role: "tenant",
            phoneNumber,
          },
          headers: {
            'x-registration-source': 'landlord-link',
            'x-landlord-id': landlord.id,
            'x-house-address': houseAddress,
          } as any,
        });

        if (userResult.user) {
          finalUserId = userResult.user.id;
          console.log('✅ DEBUG: User account created successfully:', {
            userId: finalUserId,
            email: userResult.user.email
          });
        } else {
          console.log('❌ DEBUG: Failed to create user account');
          res.status(500).json({ message: "Failed to create user account" });
          return;
        }
      } catch (userError: any) {
        console.error('❌ DEBUG: Error creating user account:', userError);
        
        // Check if user already exists
        if (userError.message && userError.message.includes('already exists')) {
          // Try to find existing user
          const existingUserResult = await db.select().from(users).where(eq(users.email, email));
          const existingUser = existingUserResult[0];
          
          if (existingUser) {
            finalUserId = existingUser.id;
            console.log('✅ DEBUG: Using existing user account:', {
              userId: finalUserId,
              email: existingUser.email
            });
          } else {
            res.status(409).json({ message: "User with this email already exists but could not be found" });
            return;
          }
        } else {
          res.status(500).json({ message: `Error creating user account: ${userError.message}` });
          return;
        }
      }
    }

    // Check if tenant already exists (created by Better Auth hook)
    const [existingTenant] = await db.select().from(tenants).where(eq(tenants.userId, finalUserId)).limit(1);
    
    let newTenant;
    if (existingTenant) {
      console.log('🔍 DEBUG: Updating existing tenant with landlord link data');
      // Update existing tenant with landlord link information
      newTenant = await db.update(tenants)
        .set({
          houseAddress,
          registrationSource: 'landlord_link',
          registeredByLandlordId: landlord.id,
          currentPropertyId: propertyId ? Number(propertyId) : null,
        })
        .where(eq(tenants.userId, finalUserId))
        .returning();
    } else {
      // Create new tenant with landlord association
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
      newTenant = await db.insert(tenants).values(tenantData).returning();
    }

    console.log('✅ DEBUG: Tenant created successfully:', {
      tenantId: newTenant[0].id,
      registeredByLandlordId: newTenant[0].registeredByLandlordId,
      registrationSource: newTenant[0].registrationSource
    });

    // Create rental record in LandlordTenantRental table
    console.log('🔍 DEBUG: Creating rental record with data:', {
      tenantId: newTenant[0].id,
      landlordId: landlord.id,
      rentAmount: rentAmount || 500000,
      rentDueDate: rentDueDate ? new Date(rentDueDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      paymentMethod: paymentMethod || 'bank_transfer',
      propertyAddress: propertyAddress || houseAddress || 'Address to be updated'
    });

    const rentalResult = await db.insert(landlordTenantRentals).values({
      tenantId: newTenant[0].id,
      landlordId: landlord.id,
      rentAmount: rentAmount || 500000, // Default rent amount in Naira
      rentDueDate: rentDueDate ? new Date(rentDueDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Convert string to Date or default to 1 year from now
      paymentMethod: paymentMethod || 'bank_transfer',
      propertyAddress: propertyAddress || houseAddress || 'Address to be updated',
      isRentOverdue: false,
      applicationFeeAdded: false,
      securityDepositAdded: false,
      hasBeenEditedByLandlord: false,
    }).returning();

    console.log('✅ DEBUG: Rental record created successfully:', rentalResult[0]);

    // Add to email list
    try {
      await addToEmailList({
        email,
        fullName: name,
        subscriptionType: 'newsletter'
      });
    } catch (emailError) {
      console.error("Failed to add to email list:", emailError);
    }

    // Send welcome email
    try {
      await sendTenantWelcomeEmail(email, name);
    } catch (emailError) {
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
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ message: "Tenant with this email already exists" });
    } else {
      res.status(500).json({ message: `Error creating tenant via landlord link: ${error.message}` });
    }
  }
};

export const getTenantLandlordInfo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId } = req.params;

    console.log(`🔍 getTenantLandlordInfo called with authId: ${authId}`);

    // Get tenant information
    const tenantResult = await db.select().from(tenants).where(eq(tenants.cognitoId, authId));
    let tenant = tenantResult[0];

    console.log(`🔍 Found tenant:`, tenant ? { id: tenant.id, cognitoId: tenant.cognitoId, name: tenant.name } : 'null');

    if (!tenant) {
      // Also try to find tenant by userId field as fallback
      const tenantByUserIdResult = await db.select().from(tenants).where(eq(tenants.userId, authId));
      const tenantByUserId = tenantByUserIdResult[0];
      
      console.log(`🔍 Fallback search by userId:`, tenantByUserId ? { id: tenantByUserId.id, userId: tenantByUserId.userId, name: tenantByUserId.name } : 'null');
      
      if (tenantByUserId) {
        // Use the tenant found by userId
        tenant = tenantByUserId;
      } else {
        res.status(404).json({ message: "Tenant not found" });
        return;
      }
    }

    // Determine landlord and rental information
    if (tenant.registeredByLandlordId) {
      // Original path: tenant registered via landlord link
      const landlordResult = await db.select({
        id: landlords.id,
        name: landlords.name,
        email: landlords.email,
        phoneNumber: landlords.phoneNumber,
        currentAddress: landlords.currentAddress,
        cognitoId: landlords.cognitoId,
      }).from(landlords).where(eq(landlords.id, tenant.registeredByLandlordId));

      const landlord = landlordResult[0];

      // If landlord record is missing, continue with null landlord

      const rentalResult = await db.select().from(landlordTenantRentals).where(
        eq(landlordTenantRentals.tenantId, tenant.id)
      );

      const rental = rentalResult[0];

      // If rental record is missing, continue with null rental

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
    } else {
      // Fallback path: derive landlord via rental join for general tenants
      const rentalJoin = await db.select()
        .from(landlordTenantRentals)
        .leftJoin(landlords, eq(landlordTenantRentals.landlordId, landlords.id))
        .where(eq(landlordTenantRentals.tenantId, tenant.id));

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
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving tenant landlord info: ${error.message}` });
  }
};

export const validateLandlordRegistrationLink = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { registrationLink } = req.params;
    const { property: propertyId } = req.query;

    console.log(`Validating registration link: ${registrationLink}`);

    const landlordResult = await db.select({
      id: landlords.id,
      name: landlords.name,
      email: landlords.email,
      cognitoId: landlords.cognitoId,
      linkGeneratedAt: landlords.linkGeneratedAt,
    }).from(landlords).where(eq(landlords.tenantRegistrationLink, registrationLink));
    
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

    // Note: Registration links never expire - they remain valid indefinitely
    // This ensures tenants can always use the link provided by their landlord

    let propertyInfo = null;
    let landlordProperties = [];

    // If propertyId is provided, get specific property info
    if (propertyId) {
      const propertyResult = await db.select()
        .from(properties)
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .where(and(
          eq(properties.id, Number(propertyId)),
          eq(properties.landlordCognitoId, landlord.cognitoId)
        ));

      if (propertyResult.length > 0) {
        const property = propertyResult[0].Property;
        const location = propertyResult[0].Location;

        // Get coordinates if location exists
        let coordinates = null;
        if (location?.id) {
          try {
            const coordResult = await db.execute(
              sql`SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${location.id}`
            );
            const coordinateValue = coordResult.rows[0]?.coordinates as string || "POINT(0 0)";
            const geoJSON: any = wktToGeoJSON(coordinateValue);
            coordinates = {
              longitude: geoJSON.coordinates[0],
              latitude: geoJSON.coordinates[1],
            };
          } catch (coordError) {
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

    // Always get all landlord properties for selection
    const propertiesResult = await db.select()
      .from(properties)
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(eq(properties.landlordCognitoId, landlord.cognitoId));

    landlordProperties = await Promise.all(
      propertiesResult.map(async (result) => {
        const property = result.Property;
        const location = result.Location;

        let coordinates = null;
        if (location?.id) {
          try {
            const coordResult = await db.execute(
              sql`SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${location.id}`
            );
            const coordinateValue = coordResult.rows[0]?.coordinates as string || "POINT(0 0)";
            const geoJSON: any = wktToGeoJSON(coordinateValue);
            coordinates = {
              longitude: geoJSON.coordinates[0],
              latitude: geoJSON.coordinates[1],
            };
          } catch (coordError) {
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
      })
    );

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
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error validating registration link: ${error.message}` });
  }
};
