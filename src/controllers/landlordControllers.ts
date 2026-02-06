import { Request, Response } from "express";
import { wktToGeoJSON } from "@terraformer/wkt";
import { addToEmailList, sendLandlordWelcomeEmail } from "../utils/emailSubscriptionService";
import { sendEmail } from "../utils/emailService";
import { db } from "../utils/database";
import { landlords, properties, locations, landlordRegistrationCodes, tenants, users, landlordTenantRentals, tenantEditAuditLog, activityFeeds, activityTypeEnum, agents, sessions } from "../db/schema";
import { eq, sql, and, or } from "drizzle-orm";
import crypto from "crypto";
import { QRCodeService } from "../services/qrCodeService";
import { auth } from "../auth";

export const getLandlord = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const landlordResult = await db.select().from(landlords).where(or(eq(landlords.cognitoId, cognitoId), eq(landlords.userId, cognitoId)));
    const landlord = landlordResult[0];

    if (landlord) {
      res.json(landlord);
    } else {
      res.status(404).json({ message: "Landlord not found" });
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving landlord: ${error.message}` });
  }
};

export const createLandlord = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId, name, email, phoneNumber } = req.body;

    const landlordResult = await db.insert(landlords).values({
      cognitoId,
      name,
      email,
      phoneNumber,
    }).returning();
    const landlord = landlordResult[0];

    // Send welcome email and add landlord to email list
    try {
      await sendLandlordWelcomeEmail(landlord.email, landlord.name);
      console.log(`Welcome email sent to landlord: ${landlord.email}`);
    } catch (emailError) {
      console.error('Error sending landlord welcome email:', emailError);
      // Don't fail the landlord creation if email fails
    }

    try {
      await addToEmailList({
        email: landlord.email,
        fullName: landlord.name,
        subscriptionType: 'newsletter'
      });
      console.log(`Added landlord ${landlord.email} to email list`);
    } catch (emailError) {
      console.error('Error adding landlord to email list:', emailError);
      // Don't fail the landlord creation if email subscription fails
    }

    res.status(201).json(landlord);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error creating landlord: ${error.message}` });
  }
};

export const adminCreateLandlord = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      email,
      phoneNumber,
      password: providedPassword,
      currentAddress,
      city,
      state,
      postalCode,
      country,
      accountName,
      accountNumber,
      bankName
    } = req.body;

    // Bank details are now optional for agent-created landlords
    if (!name || !email || !phoneNumber) {
      res.status(400).json({ message: "Missing required fields: Name, Email, and Phone Number are required." });
      return;
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser[0]) {
      const existingLandlord = await db.select().from(landlords).where(eq(landlords.userId, existingUser[0].id)).limit(1);
      if (existingLandlord[0]) {
        res.status(409).json({ message: "Landlord already exists" });
        return;
      }
    }

    // Use provided password or generate one
    const password = providedPassword || crypto.randomBytes(12).toString("base64");

    const created = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: "landlord",
        phoneNumber,
        callbackURL: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/verify-email`,
      },
      headers: {
        ...req.headers,
        "x-admin-create": "true"
      } as any
    });

    if (!created || !(created as any).user) {
      res.status(500).json({ message: "Failed to create user" });
      return;
    }

    const user = (created as any).user;

    await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, user.id));

    let createdByAgentId: number | undefined;
    if (req.user?.role === 'agent') {
        const agentRecord = await db.select().from(agents).where(eq(agents.userId, req.user.id)).limit(1);
        if (agentRecord[0]) {
            createdByAgentId = agentRecord[0].id;
        }
    }

    const landlordProfileResult = await db.insert(landlords).values({
      cognitoId: user.legacyCognitoId || user.id,
      userId: user.id,
      name,
      email,
      phoneNumber,
      currentAddress,
      city,
      state,
      postalCode,
      country,
      bankName,
      accountNumber,
      accountName,
      createdByAgentId
    }).returning();

    const landlordProfile = landlordProfileResult[0];

    try {
      await db.insert(activityFeeds).values({
        type: 'LandlordRegistered',
        title: 'Landlord onboarded',
        description: `Landlord ${name} (${email}) was created`,
        actorId: req.user?.id || 'system',
        actorType: req.user?.role || 'admin',
        actorName: req.user?.name || 'Admin',
        targetId: landlordProfile.id,
        targetType: 'landlord',
        metadata: { phoneNumber, address: currentAddress },
        isPublic: false,
      });
    } catch {}

    // Only send email if password was auto-generated or if we want to confirm creation
    await sendEmail({
      to: email,
      subject: "Welcome to HomeMatch",
      body: `
        <html>
          <body>
            <h2>Welcome to HomeMatch</h2>
            <p>Your landlord account has been created.</p>
            <p>Email: ${email}</p>
            ${!providedPassword ? `<p>Password: ${password}</p>` : '<p>Please log in with the password provided during registration.</p>'}
          </body>
        </html>
      `,
    });

    res.status(201).json({ success: true, landlord: landlordProfile });
  } catch (error: any) {
    res.status(500).json({ message: `Error creating landlord: ${error.message}` });
  }
};

export const listLandlords = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let whereClause = undefined;
    if (req.user?.role === 'agent') {
        const agentRecord = await db.select().from(agents).where(eq(agents.userId, req.user.id)).limit(1);
        if (agentRecord[0]) {
             whereClause = eq(landlords.createdByAgentId, agentRecord[0].id);
        } else {
             res.json({ success: true, data: [] });
             return;
        }
    }

    const rows = await db.select({
      id: landlords.id,
      name: landlords.name,
      email: landlords.email,
      phoneNumber: landlords.phoneNumber,
      userId: landlords.userId,
      cognitoId: landlords.cognitoId,
      createdAt: landlords.createdAt,
      propertiesCount: sql`COUNT(${properties.id})`
    })
    .from(landlords)
    .leftJoin(properties, eq(landlords.cognitoId, properties.landlordCognitoId))
    .where(whereClause)
    .groupBy(landlords.id);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ message: `Error listing landlords: ${error.message}` });
  }
};

export const impersonateLandlord = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId: paramId } = req.params as any;
    console.log(`Attempting to impersonate user/landlord with ID: ${paramId}`);
    console.log(`Requester: ${JSON.stringify(req.user)}`);

    let targetUserId = paramId;

    // Check if the provided ID is a landlord's cognitoId
    // This is necessary because the frontend might pass the landlord's cognitoId instead of the internal user ID
    const landlordResult = await db.select().from(landlords).where(eq(landlords.cognitoId, paramId));
    
    if (landlordResult.length > 0 && landlordResult[0].userId) {
      targetUserId = landlordResult[0].userId;
      console.log(`Resolved landlord cognitoId ${paramId} to userId ${targetUserId}`);

      // Security Check: If requester is an agent, ensure they created this landlord
      if (req.user?.role === 'agent') {
        const agentRecord = await db.select().from(agents).where(eq(agents.userId, req.user.id)).limit(1);
        
        if (!agentRecord[0]) {
           res.status(403).json({ message: "Access Denied - Agent profile not found" });
           return;
        }

        if (landlordResult[0].createdByAgentId !== agentRecord[0].id) {
           res.status(403).json({ message: "Access Denied - You can only impersonate landlords you created" });
           return;
        }
      }
    } else {
        // If we couldn't resolve via cognitoId, maybe paramId is userId directly.
        // We should verify if that user is a landlord and if the agent owns them.
        // But for now, if the lookup above failed to find a landlord, we might proceed blindly with paramId,
        // which is risky if paramId is indeed a userId but we didn't check ownership.
        
        // Let's do a reverse lookup: Check if there is a landlord with this userId
        const landlordByUserId = await db.select().from(landlords).where(eq(landlords.userId, paramId)).limit(1);
        
        if (landlordByUserId[0]) {
            if (req.user?.role === 'agent') {
                const agentRecord = await db.select().from(agents).where(eq(agents.userId, req.user.id)).limit(1);
                if (!agentRecord[0] || landlordByUserId[0].createdByAgentId !== agentRecord[0].id) {
                    res.status(403).json({ message: "Access Denied - You can only impersonate landlords you created" });
                    return;
                }
            }
        } else {
            // If the target is NOT a landlord, and requester is an agent, we should probably BLOCK it
            // because agents can "only create landlord profile" and thus should only manage landlords.
            if (req.user?.role === 'agent') {
                 res.status(403).json({ message: "Access Denied - Agents can only impersonate landlords" });
                 return;
            }
        }
    }

    // Clean headers to avoid issues with content-length/type mismatch
    const { "content-length": cl, "content-type": ct, ...cleanHeaders } = req.headers;

    // Manually create a session for the target user since better-auth doesn't expose createSession easily
    // and we need to bypass admin role checks
    const crypto = require("crypto");
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(sessions).values({
      id: crypto.randomUUID(),
      userId: targetUserId,
      token: token,
      expiresAt: expiresAt,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      impersonatedBy: req.user?.id
    });

    const session = {
        session: {
            token: token,
            expiresAt: expiresAt,
            user: {
                id: targetUserId
            }
        }
    };

    try {
      await db.insert(activityFeeds).values({
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
    } catch {}

    res.json({ success: true, data: session });
  } catch (error: any) {
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

export const registerLandlordWithCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId, name, email, phoneNumber, registrationCode } = req.body;

    // Find and validate the registration code
    const codeRecordResult = await db.select().from(landlordRegistrationCodes).where(eq(landlordRegistrationCodes.code, registrationCode));
    const codeRecord = codeRecordResult[0];

    if (!codeRecord) {
      res.status(400).json({ message: "Invalid registration code" });
      return;
    }

    if (codeRecord.isUsed) {
      res.status(400).json({ message: "Registration code has already been used" });
      return;
    }

    // Create the landlord and mark the code as used
    const landlordResult = await db.insert(landlords).values({
      cognitoId,
      name,
      email,
      phoneNumber,
      registrationCodeId: codeRecord.id,
    }).returning();
    const landlord = landlordResult[0];

    // Mark the code as used
    await db.update(landlordRegistrationCodes)
      .set({
        isUsed: true,
        usedAt: new Date(),
      })
      .where(eq(landlordRegistrationCodes.id, codeRecord.id));

    // Send welcome email and add landlord to email list
    try {
      await sendLandlordWelcomeEmail(landlord.email, landlord.name);
      console.log(`Welcome email sent to landlord: ${landlord.email}`);
    } catch (emailError) {
      console.error('Error sending landlord welcome email:', emailError);
      // Don't fail the landlord creation if email fails
    }

    try {
      await addToEmailList({
        email: landlord.email,
        fullName: landlord.name,
        subscriptionType: 'newsletter'
      });
      console.log(`Added landlord ${landlord.email} to email list`);
    } catch (emailError) {
      console.error('Error adding landlord to email list:', emailError);
      // Don't fail the landlord creation if email subscription fails
    }

    res.status(201).json(landlord);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error creating landlord: ${error.message}` });
  }
};

export const updateLandlord = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const {
      name,
      email,
      phoneNumber,
      currentAddress,
      city,
      state,
      country,
      postalCode,
      bankName,
      accountNumber,
      accountName,
      bankCode,
      businessName,
      businessType,
      taxId,
      dateOfBirth,
      nationality,
      occupation,
      emergencyContactName,
      emergencyContactPhone
    } = req.body;

    // Create update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (currentAddress !== undefined) updateData.currentAddress = currentAddress;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (accountName !== undefined) updateData.accountName = accountName;
    if (bankCode !== undefined) updateData.bankCode = bankCode;
    if (businessName !== undefined) updateData.businessName = businessName;
    if (businessType !== undefined) updateData.businessType = businessType;
    if (taxId !== undefined) updateData.taxId = taxId;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (nationality !== undefined) updateData.nationality = nationality;
    if (occupation !== undefined) updateData.occupation = occupation;
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone;

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    const landlordResult = await db.update(landlords)
      .set(updateData)
      .where(or(eq(landlords.cognitoId, cognitoId), eq(landlords.userId, cognitoId)))
      .returning();
    const landlord = landlordResult[0];

    res.json(landlord);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error updating landlord: ${error.message}` });
  }
};



export const getLandlordProperties = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const propertiesResult = await db.select()
      .from(properties)
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .where(or(eq(landlords.cognitoId, cognitoId), eq(landlords.userId, cognitoId)));

    const formattedProperties = propertiesResult.map(row => ({
      ...row.Property,
        location: row.Location
    }));

    const propertiesWithFormattedLocation = await Promise.all(
      formattedProperties.map(async (property) => {
        if (property.location?.id) {
          const coordinates = await db.execute(
            sql`SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`
          );

          const coordinateValue = coordinates.rows[0]?.coordinates as string || "POINT(0 0)";
          const geoJSON: any = wktToGeoJSON(coordinateValue);
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
      })
    );

    res.json(propertiesWithFormattedLocation);
  } catch (err: any) {
    res
      .status(500)
      .json({ message: `Error retrieving landlord properties: ${err.message}` });
  }
};

// Generate new tenant registration link for landlord
export const generateTenantRegistrationLink = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const { propertyId } = req.body; // Optional property ID for property-specific registration

    // Generate new unique tenant registration link
    const tenantRegistrationLink = crypto.randomBytes(32).toString('hex');

    const updatedLandlordResult = await db.update(landlords)
      .set({
        tenantRegistrationLink,
        linkGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(or(eq(landlords.cognitoId, cognitoId), eq(landlords.userId, cognitoId)))
      .returning();
    
    const updatedLandlord = updatedLandlordResult[0];

    if (!updatedLandlord) {
      res.status(404).json({ message: "Landlord not found" });
      return;
    }

    // Generate QR code for the registration link
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    
    try {
      let qrCodeData;
      
      if (propertyId) {
        // Generate property-specific QR code
        qrCodeData = await QRCodeService.generatePropertyTenantRegistrationQR(
          tenantRegistrationLink,
          propertyId,
          baseUrl
        );
      } else {
        // Generate general QR code
        qrCodeData = await QRCodeService.generateTenantRegistrationQR(
          tenantRegistrationLink,
          baseUrl
        );
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
    } catch (qrError) {
      console.error('Error generating QR code:', qrError);
      // Still return the link even if QR generation fails
      res.json({
        message: "Tenant registration link generated successfully (QR code generation failed)",
        tenantRegistrationLink: updatedLandlord.tenantRegistrationLink,
        linkGeneratedAt: updatedLandlord.linkGeneratedAt,
        qrCode: null
      });
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error generating tenant registration link: ${error.message}` });
  }
};

// Get landlord's tenant registration link
export const getTenantRegistrationLink = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const { propertyId, regenerateQR } = req.query; // Optional query parameters

    const landlordResult = await db.select({
      id: landlords.id,
      cognitoId: landlords.cognitoId,
      tenantRegistrationLink: landlords.tenantRegistrationLink,
      linkGeneratedAt: landlords.linkGeneratedAt,
      createdByAgentId: landlords.createdByAgentId,
    }).from(landlords).where(or(eq(landlords.cognitoId, cognitoId), eq(landlords.userId, cognitoId)));
    
    const landlord = landlordResult[0];

    if (!landlord) {
      res.status(404).json({ message: "Landlord not found" });
      return;
    }

    // Agent access control
    if (req.user?.role === 'agent') {
        const agentResult = await db.select().from(agents).where(eq(agents.userId, req.user.id)).limit(1);
        const agent = agentResult[0];
        
        if (!agent || landlord.createdByAgentId !== agent.id) {
             res.status(403).json({ message: "Access Denied - You can only view landlords you created" });
             return;
        }
    }

    if (!landlord.tenantRegistrationLink) {
      res.status(404).json({ message: "No tenant registration link found for this landlord" });
      return;
    }

    // Generate QR code if requested
    let qrCodeData = null;
    if (regenerateQR === 'true') {
      const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      
      try {
        if (propertyId && typeof propertyId === 'string') {
          // Generate property-specific QR code
          qrCodeData = await QRCodeService.generatePropertyTenantRegistrationQR(
            landlord.tenantRegistrationLink,
            propertyId,
            baseUrl
          );
        } else {
          // Generate general QR code
          qrCodeData = await QRCodeService.generateTenantRegistrationQR(
            landlord.tenantRegistrationLink,
            baseUrl
          );
        }
      } catch (qrError) {
        console.error('Error generating QR code:', qrError);
        // Continue without QR code
      }
    }

    res.json({
      tenantRegistrationLink: landlord.tenantRegistrationLink,
      linkGeneratedAt: landlord.linkGeneratedAt,
      qrCode: qrCodeData
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving tenant registration link: ${error.message}` });
  }
};

// Get landlord's tenants
export const getLandlordTenants = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;

    // First, get the landlord to verify they exist
    const landlordResult = await db.select().from(landlords).where(or(eq(landlords.cognitoId, cognitoId), eq(landlords.userId, cognitoId)));
    const landlord = landlordResult[0];

    if (!landlord) {
      res.status(404).json({ message: "Landlord not found" });
      return;
    }

    // Get all tenants registered by this landlord with their rental information
    const tenantsWithRentalInfo = await db
      .select({
        tenantId: tenants.id,
        cognitoId: tenants.cognitoId,
        firstName: tenants.name,
        lastName: tenants.name, // Using name for both first and last for now
        email: tenants.email,
        phoneNumber: tenants.phoneNumber,
        houseAddress: tenants.houseAddress,
        registrationSource: tenants.registrationSource,
        registeredByLandlordId: tenants.registeredByLandlordId,
        // Rental information
        rentAmount: landlordTenantRentals.rentAmount,
        rentDueDate: landlordTenantRentals.rentDueDate,
        paymentMethod: landlordTenantRentals.paymentMethod,
        propertyAddress: landlordTenantRentals.propertyAddress,
        isRentOverdue: landlordTenantRentals.isRentOverdue,
        hasBeenEditedByLandlord: landlordTenantRentals.hasBeenEditedByLandlord,
      })
      .from(tenants)
      .leftJoin(landlordTenantRentals, eq(tenants.id, landlordTenantRentals.tenantId))
      .where(eq(tenants.registeredByLandlordId, landlord.id));

    // Transform the data to match the expected format
    const transformedTenants = tenantsWithRentalInfo.map(tenant => {
      // Calculate lease period based on rent due date (assuming yearly lease)
      let leaseStartDate = null;
      let leaseEndDate = null;
      
      if (tenant.rentDueDate) {
        // Assume lease started one year before the rent due date
        leaseEndDate = new Date(tenant.rentDueDate);
        leaseStartDate = new Date(leaseEndDate);
        leaseStartDate.setFullYear(leaseStartDate.getFullYear() - 1);
      }

      return {
        ...tenant,
        propertyTitle: tenant.propertyAddress || "Property Address Not Set",
        // Don't pre-fill annual rent - let landlord set it
        annualRent: tenant.hasBeenEditedByLandlord ? (tenant.rentAmount || 0) : 0,
        hasBeenEdited: tenant.hasBeenEditedByLandlord || false,
        leaseStartDate: leaseStartDate ? leaseStartDate.toISOString() : null,
        leaseEndDate: leaseEndDate ? leaseEndDate.toISOString() : null,
      };
    });

    res.json(transformedTenants);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving landlord tenants: ${error.message}` });
  }
};

// Edit tenant information (one-time edit)
export const editTenantInfo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const { tenantId, fieldName, newValue } = req.body;

    // Verify landlord exists
    const landlordResult = await db.select().from(landlords).where(eq(landlords.cognitoId, cognitoId));
    const landlord = landlordResult[0];

    if (!landlord) {
      res.status(404).json({ message: "Landlord not found" });
      return;
    }

    // Check if tenant exists and belongs to this landlord
    const tenantResult = await db.select().from(tenants).where(
      eq(tenants.id, tenantId)
    );
    const tenant = tenantResult[0];

    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }

    if (tenant.registeredByLandlordId !== landlord.id) {
      res.status(403).json({ message: "Unauthorized: Tenant does not belong to this landlord" });
      return;
    }

    // Check if rental record exists
    const rentalResult = await db.select().from(landlordTenantRentals).where(
      eq(landlordTenantRentals.tenantId, tenantId)
    );
    const rental = rentalResult[0];

    if (!rental) {
      res.status(404).json({ message: "Rental record not found" });
      return;
    }

    // Check if landlord has already edited this tenant (one-time edit restriction)
    if (rental.hasBeenEditedByLandlord) {
      res.status(403).json({ message: "You have already edited this tenant's information. Only one edit is allowed per tenant." });
      return;
    }

    // Validate field name for rental information and tenant information
    const rentalFields = ['rentAmount', 'rentDueDate', 'paymentMethod', 'propertyAddress'];
    const tenantFields = ['houseAddress'];
    const leaseFields = ['leaseStartDate', 'leaseEndDate'];
    const allowedFields = [...rentalFields, ...tenantFields, ...leaseFields];
    
    if (!allowedFields.includes(fieldName)) {
      res.status(400).json({ message: "Invalid field name" });
      return;
    }

    // Handle different types of updates
    let updateData: any = {};
    let tenantUpdateData: any = {};
    
    if (rentalFields.includes(fieldName)) {
      // Prepare update object for rental table
      if (fieldName === 'rentAmount') {
        updateData[fieldName] = parseFloat(newValue);
      } else if (fieldName === 'rentDueDate') {
        updateData[fieldName] = new Date(newValue);
      } else {
        updateData[fieldName] = newValue;
      }
    } else if (tenantFields.includes(fieldName)) {
      // Prepare update object for tenant table
      tenantUpdateData[fieldName] = newValue;
    } else if (leaseFields.includes(fieldName)) {
      // Handle lease fields
      const dateValue = new Date(newValue);
      if (isNaN(dateValue.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }
      // Prepare update object for rental table (lease dates are stored there)
      updateData[fieldName] = dateValue;
    }

    // Check if rent is overdue and add fees if necessary
    const currentDate = new Date();
    const rentDueDate = fieldName === 'rentDueDate' ? new Date(newValue) : rental.rentDueDate;
    const isOverdue = rentDueDate < currentDate;

    if (isOverdue && !rental.applicationFeeAdded && !rental.securityDepositAdded) {
      // Add application fee and security deposit for overdue rent
      const rentAmount = fieldName === 'rentAmount' ? parseFloat(newValue) : rental.rentAmount;
      const applicationFee = rentAmount * 0.15; // 15% application fee
      const securityDeposit = rentAmount * 0.1; // 10% security deposit
      
      updateData.isRentOverdue = true;
      updateData.applicationFeeAdded = true;
      updateData.securityDepositAdded = true;
      
      console.log(`Rent is overdue. Adding application fee (₦${applicationFee}) and security deposit (₦${securityDeposit})`);
    }

    // Mark as edited by landlord
    updateData.hasBeenEditedByLandlord = true;

    // Update rental information
    const updatedRentalResult = await db.update(landlordTenantRentals)
      .set(updateData)
      .where(eq(landlordTenantRentals.tenantId, tenantId))
      .returning();

    const updatedRental = updatedRentalResult[0];

    if (!updatedRental) {
      res.status(500).json({ message: "Failed to update rental information" });
      return;
    }

    // Create audit log entry
    await db.insert(tenantEditAuditLog).values({
      tenantId: tenantId,
      landlordId: landlord.id,
      fieldName: fieldName,
      oldValue: rental[fieldName as keyof typeof rental]?.toString() || '',
      newValue: newValue.toString(),
      editedBy: cognitoId, // Add the required editedBy field
      isOneTimeEdit: true,
      editedAt: new Date(),
    });

    // Log the edit for audit purposes
    console.log(`Landlord ${cognitoId} edited tenant ${tenantId} field ${fieldName} to:`, newValue);

    res.json({
      message: "Tenant rental information updated successfully",
      rental: updatedRental,
      feesAdded: isOverdue && !rental.applicationFeeAdded && !rental.securityDepositAdded,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error editing tenant information: ${error.message}` });
  }
};
