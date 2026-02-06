import { Request, Response } from "express";
import { eq, and, gte, desc, count, sql } from "drizzle-orm";
import { db } from "../utils/database";
import { properties, tenants, landlords, applications, payments, leases, agents, admins, adminSettings, landlordRegistrationCodes, agentRegistrationCodes, tasks, users, locations, bloggers, adminAuditLogs } from "../db/schema";
import { addToEmailList } from "../utils/emailSubscriptionService";
import { assignPropertyToAgent } from "./agentPropertyMatchingController";
import { AdminPrivilege, getRolePrivileges, hasPrivilege } from "../middleware/authMiddleware";
import { auth } from "../auth";
import { sendEmail } from "../utils/emailService";
import crypto from "crypto";

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, role } = req.body;
    const adminUser = req.user; // Assuming req.user is populated by authMiddleware

    if (!email || !role) {
      res.status(400).json({ message: "Email and role are required" });
      return;
    }

    if (!['agent', 'blogger'].includes(role)) {
      res.status(400).json({ message: "Invalid role. Only 'agent' and 'blogger' are allowed." });
      return;
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      res.status(400).json({ message: "User with this email already exists" });
      return;
    }

    // Generate secure random password
    // Minimum 8 chars, at least one uppercase, one lowercase, one number, one special char
    const generatePassword = () => {
      const length = 12;
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      let retVal = "";
      for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
      }
      return retVal;
    };

    const password = generatePassword();

    // Sanitize headers to avoid Content-Length mismatch
    const headers = { ...req.headers };
    delete headers['content-length'];
    
    // Create user using Better Auth
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: email.split('@')[0], // Default name from email
        role,
        callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
      },
      headers: headers as any,
    });

    if (!result.user) {
      res.status(500).json({ message: "Failed to create user" });
      return;
    }

    // If agent, create agent record
    if (role === 'agent') {
      await db.insert(agents).values({
        cognitoId: result.user.id,
        name: email.split('@')[0],
        email,
        userId: result.user.id,
      });
    } else if (role === 'blogger') {
      await db.insert(bloggers).values({
        userId: result.user.id,
        displayName: email.split('@')[0],
      });
    }

    // Audit Log
    try {
      await db.insert(adminAuditLogs).values({
        adminUserId: adminUser?.id || 'system',
        action: 'CREATE_USER',
        targetUserId: result.user.id,
        details: { email, role, createdByEmail: adminUser?.email },
        ipAddress: req.ip || (req.socket.remoteAddress as string),
      });
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError);
    }

    // Send email with credentials
    try {
      await sendEmail({
        to: email,
        subject: "Welcome to HomeMatch - Your Account Credentials",
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #059669; margin: 0;">HomeMatch</h1>
                <p style="color: #6b7280; margin: 5px 0 0 0;">Your Rental Platform</p>
              </div>
              
              <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
                <h2 style="color: #111827; margin: 0 0 20px 0;">Account Created</h2>
                <p style="color: #374151; margin: 0 0 15px 0;">An account has been created for you with the role: <strong>${role}</strong>.</p>
                
                <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
                  <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                  <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
                </div>
                
                <p style="color: #374151; margin: 0 0 25px 0;">Please log in and change your password immediately.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.CLIENT_URL}/signin" style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Login to Dashboard</a>
                </div>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Continue execution, but maybe warn?
    }

    res.status(201).json({ message: "User created successfully", user: result.user });
  } catch (error: any) {
    console.error("Create user error:", error);
    res.status(500).json({ message: `Error creating user: ${error.message}` });
  }
};

export const getAnalytics = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get total counts
    const [totalPropertiesResult] = await db.select({ count: count() }).from(properties);
    const [totalTenantsResult] = await db.select({ count: count() }).from(tenants);
    const [totalLandlordsResult] = await db.select({ count: count() }).from(landlords);
    const [totalApplicationsResult] = await db.select({ count: count() }).from(applications);
    
    const totalProperties = totalPropertiesResult.count;
    const totalUsers = totalTenantsResult.count + totalLandlordsResult.count;
    const totalApplications = totalApplicationsResult.count;

    // Calculate revenue from payments
    const paidPayments = await db.select().from(payments).where(eq(payments.paymentStatus, "Paid"));
    const totalRevenue = paidPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);

    // Get monthly revenue data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyPayments = await db.select()
      .from(payments)
      .leftJoin(leases, eq(payments.leaseId, leases.id))
      .where(and(
        gte(payments.paymentDate, sixMonthsAgo),
        eq(payments.paymentStatus, "Paid")
      ));

    const monthlyRevenue = monthlyPayments.reduce((acc: { month: string; revenue: number }[], result) => {
      const payment = result.Payment;
      const month = payment.paymentDate.toISOString().slice(0, 7);
      const existing = acc.find(item => item.month === month);
      if (existing) {
        existing.revenue += payment.amountPaid;
      } else {
        acc.push({ month, revenue: payment.amountPaid });
      }
      return acc;
    }, []);

    // Get property types distribution
    const propertyTypesResult = await db.select({
      propertyType: properties.propertyType,
      count: count()
    }).from(properties).groupBy(properties.propertyType);

    const propertyTypesData = propertyTypesResult.map(type => ({
      name: type.propertyType,
      count: type.count,
    }));

    // Get applications by status
    const applicationsByStatusResult = await db.select({
      status: applications.status,
      count: count()
    }).from(applications).groupBy(applications.status);

    const applicationsData = applicationsByStatusResult.map(status => ({
      status: status.status,
      count: status.count,
    }));

    const analytics = {
      totalProperties,
      totalUsers,
      totalApplications,
      totalRevenue,
      propertiesGrowth: '', // Mock data - you can calculate actual growth
      usersGrowth:'',
      applicationsGrowth: '',
      revenueGrowth: '',
      monthlyRevenue,
      propertyTypes: propertyTypesData,
      applicationsByStatus: applicationsData,
    };

    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching analytics: ${error.message}` });
  }
};

export const getAllUsers = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const tenantsResult = await db.select({
      id: tenants.id,
      cognitoId: tenants.cognitoId,
      name: tenants.name,
      email: tenants.email,
      phoneNumber: tenants.phoneNumber,
    }).from(tenants);

    const landlordsResult = await db.select({
      id: landlords.id,
      cognitoId: landlords.cognitoId,
      name: landlords.name,
      email: landlords.email,
      phoneNumber: landlords.phoneNumber,
    }).from(landlords);

    const agentsResult = await db.select({
      id: agents.id,
      cognitoId: agents.cognitoId,
      name: agents.name,
      email: agents.email,
      phoneNumber: agents.phoneNumber,
    }).from(agents);

    const bloggersResult = await db.select({
      id: bloggers.id,
      userId: bloggers.userId,
      name: bloggers.displayName,
      email: users.email,
    })
    .from(bloggers)
    .leftJoin(users, eq(bloggers.userId, users.id));

    const usersList = [
      ...tenantsResult.map(tenant => ({ ...tenant, role: 'tenant', status: 'active', createdAt: new Date() })),
      ...landlordsResult.map(landlord => ({ ...landlord, role: 'landlord', status: 'active', createdAt: new Date() })),
      ...agentsResult.map(agent => ({ ...agent, role: 'agent', status: 'active', createdAt: new Date() })),
      ...bloggersResult.map(blogger => ({
        id: blogger.id,
        cognitoId: blogger.userId,
        name: blogger.name,
        email: blogger.email,
        phoneNumber: null,
        role: 'blogger',
        status: 'active',
        createdAt: new Date()
      })),
    ];

    res.json(usersList);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching users: ${error.message}` });
  }
};

export const getAllProperties = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const propertiesResult = await db.select()
      .from(properties)
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId));

    const formattedProperties = propertiesResult.map(result => ({
      ...result.Property,
      location: result.Location,
      landlord: result.Landlord
    }));

    res.json(formattedProperties);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching properties: ${error.message}` });
  }
};

export const updateUserStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    // Note: In a real implementation, you'd update the user status in your database
    // For now, we'll just return success
    res.json({ message: "User status updated successfully", userId, status });
  } catch (error: any) {
    res.status(500).json({ message: `Error updating user status: ${error.message}` });
  }
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check if user is a tenant or landlord and delete accordingly
    const tenant = await db.select().from(tenants).where(eq(tenants.cognitoId, userId)).limit(1);
    const landlord = await db.select().from(landlords).where(eq(landlords.cognitoId, userId)).limit(1);

    if (tenant.length > 0) {
      await db.delete(tenants).where(eq(tenants.cognitoId, userId));
    } else if (landlord.length > 0) {
      await db.delete(landlords).where(eq(landlords.cognitoId, userId));
    } else {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: `Error deleting user: ${error.message}` });
  }
};

export const updatePropertyStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { propertyId } = req.params;
    const { status } = req.body;

    // Validate status values
    const validStatuses = ['PendingApproval', 'Available', 'Closed', 'Rejected'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ message: "Invalid status. Must be one of: PendingApproval, Available, Closed, Rejected" });
      return;
    }

    // Update property status in database
    await db.update(properties)
      .set({ status })
      .where(eq(properties.id, Number(propertyId)));

    // Get updated property with relations
    const updatedPropertyResult = await db.select()
      .from(properties)
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .where(eq(properties.id, Number(propertyId)))
      .limit(1);

    const updatedProperty = updatedPropertyResult[0] ? {
      ...updatedPropertyResult[0].Property,
      location: updatedPropertyResult[0].Location,
      landlord: updatedPropertyResult[0].Landlord
    } : null;

    // If property is approved (Available), automatically assign to an agent
    if (status === 'Available') {
      try {
        await assignPropertyToAgent(Number(propertyId));
        console.log(`Property ${propertyId} successfully assigned to an agent`);
      } catch (assignmentError: any) {
        console.error(`Failed to assign property ${propertyId} to agent:`, assignmentError.message);
        // Don't fail the status update if agent assignment fails
      }
    }

    res.json({ 
      message: "Property status updated successfully", 
      property: updatedProperty 
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ message: "Property not found" });
    } else {
      res.status(500).json({ message: `Error updating property status: ${error.message}` });
    }
  }
};

export const deleteProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { propertyId } = req.params;

    await db.delete(properties)
      .where(eq(properties.id, Number(propertyId)));

    res.json({ message: "Property deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: `Error deleting property: ${error.message}` });
  }
};

export const getAdminSettings = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get or create admin settings
    let settingsResult = await db.select().from(adminSettings).limit(1);
    let settings = settingsResult[0];
    
    if (!settings) {
      // Create default settings if none exist
      const newSettingsResult = await db.insert(adminSettings)
        .values({})
        .returning();
      settings = newSettingsResult[0];
    }

    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching settings: ${error.message}` });
  }
};

export const updateAdminSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const settingsData = req.body;

    // Get or create admin settings
    let settingsResult = await db.select().from(adminSettings).limit(1);
    let settings = settingsResult[0];
    
    if (!settings) {
      // Create new settings if none exist
      const newSettingsResult = await db.insert(adminSettings)
        .values(settingsData)
        .returning();
      settings = newSettingsResult[0];
    } else {
      // Update existing settings
      const updatedSettingsResult = await db.update(adminSettings)
        .set(settingsData)
        .where(eq(adminSettings.id, settings.id))
        .returning();
      settings = updatedSettingsResult[0];
    }

    res.json({ message: "Settings updated successfully", settings });
  } catch (error: any) {
    res.status(500).json({ message: `Error updating settings: ${error.message}` });
  }
};

export const createAgent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("Creating agent with request body:", req.body);
    const { cognitoId, name, email, phoneNumber, address } = req.body;

    // Validate required fields
    if (!name || !email) {
      console.log("Missing required fields - name:", name, "email:", email);
      res.status(400).json({ message: "Name and email are required" });
      return;
    }

    // Check if agent with this email already exists
    console.log("Checking for existing agent with email:", email);
    const existingAgentResult = await db.select().from(agents).where(eq(agents.email, email)).limit(1);
    const existingAgent = existingAgentResult[0] || null;

    let agent;
    if (existingAgent) {
      console.log("Agent already exists:", existingAgent);
      // Update existing agent with the real cognitoId from Cognito authentication
      if (cognitoId && existingAgent.cognitoId !== cognitoId) {
        console.log("Updating existing agent's cognitoId from", existingAgent.cognitoId, "to", cognitoId);
        const agentResult = await db.update(agents)
          .set({
            cognitoId: cognitoId,
            name,
            phoneNumber: phoneNumber || existingAgent.phoneNumber,
            address: address || existingAgent.address,
          })
          .where(eq(agents.id, existingAgent.id))
          .returning();
        agent = agentResult[0];
        console.log("Agent updated in database:", agent);
      } else {
        console.log("Agent already exists with same cognitoId, returning existing agent");
        agent = existingAgent;
      }
    } else {
      console.log("No existing agent found, proceeding with creation");
      
      // Use provided cognitoId or generate a temporary one
      const finalCognitoId = cognitoId || `temp-agent-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      console.log("Using cognitoId for agent:", finalCognitoId);

      // Set user context for agent creation
      if (!req.user) {
        req.user = {
          id: finalCognitoId,
          role: 'agent',
          email: email,
          name: name
        };
      }
      console.log("User object for agent creation:", req.user);

      // Create agent in database
      console.log("Creating agent in database with cognitoId:", finalCognitoId);
      const agentResult = await db.insert(agents).values({
        cognitoId: finalCognitoId,
        name,
        email,
        phoneNumber: phoneNumber || '',
        address: address || '',
      }).returning();
      agent = agentResult[0];
      console.log("Agent created in database:", agent);
    }

    // Add agent to email list
    try {
      await addToEmailList({
        email: agent.email,
        fullName: agent.name,
        subscriptionType: 'newsletter'
      });
      console.log(`Added agent ${agent.email} to email list`);
    } catch (emailError) {
      console.error('Error adding agent to email list:', emailError);
      // Don't fail the agent creation if email subscription fails
    }

    res.status(201).json({
      message: "Agent created successfully",
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        address: agent.address,
      },
    });
  } catch (error: any) {
    console.error("Error creating agent:", error);
    res.status(500).json({ message: `Error creating agent: ${error.message}` });
  }
};

export const createAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("Creating admin with request body:", req.body);
    const { cognitoId, name, email, phoneNumber } = req.body;

    // Validate required fields
    if (!name || !email) {
      console.log("Missing required fields - name:", name, "email:", email);
      res.status(400).json({ message: "Name and email are required" });
      return;
    }

    // Validate email domain
    if (!email.endsWith('@homematch.ng')) {
      console.log("Invalid email domain:", email);
      res.status(400).json({ message: "Admin registration is only allowed for emails ending with @homematch.ng" });
      return;
    }

    // Check if admin with this email already exists
    console.log("Checking for existing admin with email:", email);
    const existingAdminResult = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    const existingAdmin = existingAdminResult[0] || null;

    let admin;
    if (existingAdmin) {
      console.log("Admin already exists:", existingAdmin);
      // Update existing admin with the real cognitoId from Cognito authentication
      if (cognitoId && existingAdmin.cognitoId !== cognitoId) {
        console.log("Updating existing admin's cognitoId from", existingAdmin.cognitoId, "to", cognitoId);
        const adminResult = await db.update(admins)
          .set({
            cognitoId: cognitoId,
            name,
            phoneNumber: phoneNumber || existingAdmin.phoneNumber,
          })
          .where(eq(admins.id, existingAdmin.id))
          .returning();
        admin = adminResult[0];
        console.log("Admin updated in database:", admin);
      } else {
        console.log("Admin already exists with same cognitoId, returning existing admin");
        admin = existingAdmin;
      }
    } else {
      console.log("No existing admin found, proceeding with creation");
      
      // Use provided cognitoId or generate a temporary one
      const finalCognitoId = cognitoId || `temp-admin-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      console.log("Using cognitoId for admin:", finalCognitoId);
      
      // Create admin in database
      console.log("Creating admin in database with cognitoId:", finalCognitoId);
      const adminResult = await db.insert(admins).values({
        cognitoId: finalCognitoId,
        name,
        email,
        phoneNumber: phoneNumber || '',
      }).returning();
      admin = adminResult[0];
      console.log("Admin created in database:", admin);
    }

    // Add admin to email list (Cognito will handle the OTP email)
    try {
      await addToEmailList({
        email: admin.email,
        fullName: admin.name,
        subscriptionType: 'newsletter'
      });
      console.log(`Admin ${admin.email} added to email list`);
    } catch (emailError) {
      console.error('Error adding admin to email list:', emailError);
      // Don't fail the admin creation if email subscription fails
    }

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        id: admin.id,
        cognitoId: admin.cognitoId,
        name: admin.name,
        email: admin.email,
        phoneNumber: admin.phoneNumber,
      },
    });
  } catch (error: any) {
    console.error("Error creating admin:", error);
    res.status(500).json({ message: `Error creating admin: ${error.message}` });
  }
};

export const getAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId } = req.params;
    console.log("Getting admin with cognitoId:", cognitoId);
    
    const adminResult = await db.select({
      cognitoId: admins.cognitoId,
      name: admins.name,
      email: admins.email,
      phoneNumber: admins.phoneNumber,
    }).from(admins).where(eq(admins.cognitoId, cognitoId)).limit(1);
    const admin = adminResult[0] || null;
    console.log("Admin found:", admin);

    if (!admin) {
      console.log("Admin not found for cognitoId:", cognitoId);
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    res.json(admin);
  } catch (error: any) {
    console.error("Error retrieving admin:", error);
    res.status(500).json({ message: `Error retrieving admin: ${error.message}` });
  }
};

export const getAgent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId } = req.params;

    // Security check: Agents can only view their own profile
    if (req.user?.role === 'agent' && req.user.id !== cognitoId) {
       res.status(403).json({ message: "Access denied: You can only view your own profile" });
       return;
    }

    console.log("Getting agent with cognitoId:", cognitoId);
    
    const agentResult = await db.select({
      id: agents.id,
      cognitoId: agents.cognitoId,
      name: agents.name,
      email: agents.email,
      phoneNumber: agents.phoneNumber,
      address: agents.address,
      isOnboardingComplete: users.isOnboardingComplete,
    })
    .from(agents)
    .leftJoin(users, eq(agents.cognitoId, users.id))
    .where(eq(agents.cognitoId, cognitoId))
    .limit(1);
    const agent = agentResult[0] || null;
    console.log("Agent found:", agent);

    if (!agent) {
      console.log("Agent not found for cognitoId:", cognitoId);
      res.status(404).json({ message: "Agent not found" });
      return;
    }

    res.json(agent);
  } catch (error: any) {
    console.error("Error retrieving agent:", error);
    res.status(500).json({ message: `Error retrieving agent: ${error.message}` });
  }
};

export const getAllAgents = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const allAgents = await db.select().from(agents);
    res.json(allAgents);
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving agents: ${error.message}` });
  }
};

export const getLandlordRegistrations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { codeFilter, usedFilter } = req.query;
    
    let whereClause: any = {};
    
    // Filter by specific code if provided
    if (codeFilter && typeof codeFilter === 'string') {
      whereClause.code = {
        contains: codeFilter,
        mode: 'insensitive'
      };
    }
    
    // Filter by used status if provided
    if (usedFilter !== undefined) {
      whereClause.isUsed = usedFilter === 'true';
    }
    
    const registrationCodes = await db.select()
      .from(landlordRegistrationCodes)
      .leftJoin(landlords, eq(landlordRegistrationCodes.id, landlords.registrationCodeId))
      .orderBy(desc(landlordRegistrationCodes.createdAt));
    
    res.json(registrationCodes);
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving landlord registrations: ${error.message}` });
  }
};

export const getLandlordRegistrationStats = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [totalCodesResult] = await db.select({ count: count() }).from(landlordRegistrationCodes);
    const [usedCodesResult] = await db.select({ count: count() }).from(landlordRegistrationCodes).where(eq(landlordRegistrationCodes.isUsed, true));
    const totalCodes = totalCodesResult.count;
    const usedCodes = usedCodesResult.count;
    const availableCodes = totalCodes - usedCodes;
    
    const recentRegistrations = await db.select()
      .from(landlordRegistrationCodes)
      .leftJoin(landlords, eq(landlordRegistrationCodes.id, landlords.registrationCodeId))
      .where(eq(landlordRegistrationCodes.isUsed, true))
      .orderBy(desc(landlordRegistrationCodes.usedAt))
      .limit(5);
    
    res.json({
       totalCodes,
       usedCodes,
       availableCodes,
       recentRegistrations
     });
   } catch (error: any) {
    res.status(500).json({ message: `Error retrieving landlord registration stats: ${error.message}` });
  }
};

// Agent Registration Code Management
export const getAgentRegistrations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { codeFilter, usedFilter } = req.query;
    
    let whereClause: any = {};
    
    // Filter by specific code if provided
    if (codeFilter && typeof codeFilter === 'string') {
      whereClause.code = {
        contains: codeFilter,
        mode: 'insensitive'
      };
    }
    
    // Filter by used status if provided
    if (usedFilter !== undefined) {
      whereClause.isUsed = usedFilter === 'true';
    }
    
    const registrationCodes = await db.select()
      .from(agentRegistrationCodes)
      .where(whereClause)
      .leftJoin(agents, eq(agentRegistrationCodes.id, agents.registrationCodeId))
      .orderBy(desc(agentRegistrationCodes.createdAt));
    
    res.json(registrationCodes);
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving agent registrations: ${error.message}` });
  }
};

export const getAgentRegistrationStats = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [totalCodesResult] = await db.select({ count: count() }).from(agentRegistrationCodes);
    const [usedCodesResult] = await db.select({ count: count() }).from(agentRegistrationCodes).where(eq(agentRegistrationCodes.isUsed, true));
    const totalCodes = totalCodesResult.count;
    const usedCodes = usedCodesResult.count;
    const availableCodes = totalCodes - usedCodes;
    
    const recentRegistrations = await db.select()
      .from(agentRegistrationCodes)
      .leftJoin(agents, eq(agentRegistrationCodes.id, agents.registrationCodeId))
      .where(eq(agentRegistrationCodes.isUsed, true))
      .orderBy(desc(agentRegistrationCodes.usedAt))
      .limit(5);
    
    res.json({
       totalCodes,
       usedCodes,
       availableCodes,
       recentRegistrations
     });
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving agent registration stats: ${error.message}` });
  }
};

export const assignCodeToAgent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { codeId, agentId } = req.body;
    const adminCognitoId = req.user?.id;
    
    if (!adminCognitoId) {
      res.status(401).json({ message: 'Admin authentication required' });
      return;
    }
    
    // Check if code exists and is available
    const codeResult = await db.select().from(agentRegistrationCodes).where(eq(agentRegistrationCodes.id, codeId)).limit(1);
    const code = codeResult[0];
    
    if (!code) {
      res.status(404).json({ message: 'Registration code not found' });
      return;
    }
    
    if (code.isUsed) {
      res.status(400).json({ message: 'Registration code is already used' });
      return;
    }
    
    // Check if agent exists
    const agentResult = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    const agent = agentResult[0];
    
    if (!agent) {
      res.status(404).json({ message: 'Agent not found' });
      return;
    }
    
    // Update the code to mark it as assigned
    await db.update(agentRegistrationCodes)
      .set({
        assignedBy: adminCognitoId,
        usedAt: new Date(),
        isUsed: true
      })
      .where(eq(agentRegistrationCodes.id, codeId));
    
    // Update the agent with the registration code
    await db.update(agents)
      .set({
        registrationCodeId: codeId
      })
      .where(eq(agents.id, agentId));
    
    res.json({ message: 'Code successfully assigned to agent' });
  } catch (error: any) {
    res.status(500).json({ message: `Error assigning code to agent: ${error.message}` });
  }
};

// Task Management
export const createTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { title, description, priority, dueDate, agentId } = req.body;
    const adminCognitoId = req.user?.id;
    
    if (!adminCognitoId) {
      res.status(401).json({ message: 'Admin authentication required' });
      return;
    }
    
    // Check if agent exists
    const agentResult = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    const agent = agentResult[0];
    
    if (!agent) {
      res.status(404).json({ message: 'Agent not found' });
      return;
    }
    
    const taskResult = await db.insert(tasks).values({
      title,
      description,
      priority: priority || 'Medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedBy: adminCognitoId,
      agentId
    }).returning();
    
    const task = {
      ...taskResult[0],
      agent: {
        name: agent.name,
        email: agent.email
      }
    };
    
    res.status(201).json(task);
  } catch (error: any) {
    res.status(500).json({ message: `Error creating task: ${error.message}` });
  }
};

export const getTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, priority, agentId } = req.query;
    
    let whereClause: any = {};
    
    if (status && typeof status === 'string') {
      whereClause.status = status;
    }
    
    if (priority && typeof priority === 'string') {
      whereClause.priority = priority;
    }
    
    if (agentId && typeof agentId === 'string') {
      whereClause.agentId = parseInt(agentId);
    }
    
    const tasksResult = await db.select()
      .from(tasks)
      .leftJoin(agents, eq(tasks.agentId, agents.id))
      .orderBy(desc(tasks.createdAt));
    
    const tasksData = tasksResult.map(result => ({
      ...result.Task,
      agent: result.Agent ? {
        name: result.Agent.name,
        email: result.Agent.email
      } : null
    }));
    
    res.json(tasksData);
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving tasks: ${error.message}` });
  }
};

export const updateTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate } = req.body;
    
    const updateData: any = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (dueDate) updateData.dueDate = new Date(dueDate);
    
    const taskResult = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, parseInt(id)))
      .returning();
    
    const agentResult = await db.select({
      name: agents.name,
      email: agents.email
    }).from(agents).where(eq(agents.id, taskResult[0].agentId)).limit(1);
    
    const task = {
      ...taskResult[0],
      agent: agentResult[0] || null
    };
    
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ message: `Error updating task: ${error.message}` });
  }
};

export const deleteTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    
    await db.delete(tasks).where(eq(tasks.id, parseInt(id)));
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: `Error deleting task: ${error.message}` });
  }
};

export const getTaskStats = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [totalTasksResult] = await db.select({ count: count() }).from(tasks);
    const [pendingTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'Pending'));
    const [inProgressTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'InProgress'));
    const [completedTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'Completed'));
    const [overdueTasksResult] = await db.select({ count: count() }).from(tasks)
      .where(and(
        sql`${tasks.dueDate} < ${new Date()}`,
        sql`${tasks.status} != 'Completed'`
      ));
    
    const totalTasks = totalTasksResult.count;
    const pendingTasks = pendingTasksResult.count;
    const inProgressTasks = inProgressTasksResult.count;
    const completedTasks = completedTasksResult.count;
    const overdueTasks = overdueTasksResult.count;
    
    res.json({
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving task stats: ${error.message}` });
  }
};

// ============ ADMIN PRIVILEGE MANAGEMENT ============

// Get user privileges based on role
export const getUserPrivileges = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    
    // Get user from database using Drizzle
    const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userResult[0] || null;
    
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    const userRole = user.role || 'tenant';
    const privileges = getRolePrivileges(userRole);
    
    res.json({
      userId,
      role: userRole,
      privileges,
      privilegeDescriptions: {
        [AdminPrivilege.USER_MANAGEMENT]: "Manage user accounts, roles, and permissions",
        [AdminPrivilege.PROPERTY_MANAGEMENT]: "Manage property listings, approvals, and status",
        [AdminPrivilege.FINANCIAL_MANAGEMENT]: "Access financial data, payments, and revenue",
        [AdminPrivilege.SYSTEM_SETTINGS]: "Configure system settings and preferences",
        [AdminPrivilege.ANALYTICS_ACCESS]: "View analytics, reports, and statistics",
        [AdminPrivilege.AGENT_MANAGEMENT]: "Manage agents, assignments, and codes",
        [AdminPrivilege.TASK_MANAGEMENT]: "Create, assign, and manage tasks",
        [AdminPrivilege.SUPER_ADMIN]: "Full administrative access to all features"
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving user privileges: ${error.message}` });
  }
};

// Update user role (requires SUPER_ADMIN privilege)
export const updateUserRole = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;
    const currentUser = req.user;
    
    // Check if current user has SUPER_ADMIN privilege
    if (!currentUser || !hasPrivilege(currentUser.role, AdminPrivilege.SUPER_ADMIN)) {
      res.status(403).json({ message: "Insufficient privileges to update user roles" });
      return;
    }
    
    // Validate new role
    const validRoles = ['tenant', 'landlord', 'agent', 'admin'];
    if (!validRoles.includes(newRole)) {
      res.status(400).json({ message: "Invalid role specified" });
      return;
    }
    
    // Update user role in database
    const updatedUserResult = await db.update(users)
      .set({ role: newRole })
      .where(eq(users.id, userId))
      .returning();
    const updatedUser = updatedUserResult[0];
    
    if (!updatedUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    // Log the role change
    console.log(`User ${userId} role updated to ${newRole} by admin ${currentUser.id}`);
    
    res.json({
      message: "User role updated successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: newRole,
        privileges: getRolePrivileges(newRole)
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error updating user role: ${error.message}` });
  }
};

// Get all available privileges and their descriptions
export const getAllPrivileges = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const privileges = Object.values(AdminPrivilege).map(privilege => ({
      name: privilege,
      description: {
        [AdminPrivilege.USER_MANAGEMENT]: "Manage user accounts, roles, and permissions",
        [AdminPrivilege.PROPERTY_MANAGEMENT]: "Manage property listings, approvals, and status",
        [AdminPrivilege.FINANCIAL_MANAGEMENT]: "Access financial data, payments, and revenue",
        [AdminPrivilege.SYSTEM_SETTINGS]: "Configure system settings and preferences",
        [AdminPrivilege.ANALYTICS_ACCESS]: "View analytics, reports, and statistics",
        [AdminPrivilege.AGENT_MANAGEMENT]: "Manage agents, assignments, and codes",
        [AdminPrivilege.TASK_MANAGEMENT]: "Create, assign, and manage tasks",
        [AdminPrivilege.SUPER_ADMIN]: "Full administrative access to all features"
      }[privilege]
    }));
    
    res.json({ privileges });
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving privileges: ${error.message}` });
  }
};

// Get role-based privilege matrix
export const getPrivilegeMatrix = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const roles = ['tenant', 'landlord', 'agent', 'admin'];
    const matrix = roles.map(role => ({
      role,
      privileges: getRolePrivileges(role)
    }));
    
    res.json({ matrix });
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving privilege matrix: ${error.message}` });
  }
};

// Check if current user has specific privilege
export const checkUserPrivilege = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { privilege } = req.params;
    const currentUser = req.user;
    
    if (!currentUser) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    
    // Validate privilege
    if (!Object.values(AdminPrivilege).includes(privilege as AdminPrivilege)) {
      res.status(400).json({ message: "Invalid privilege specified" });
      return;
    }
    
    const hasAccess = hasPrivilege(currentUser.role, privilege as AdminPrivilege);
    
    res.json({
      userId: currentUser.id,
      role: currentUser.role,
      privilege,
      hasAccess
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error checking user privilege: ${error.message}` });
  }
};

// Get admin activity log (for audit purposes)
export const getAdminActivityLog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    // This would typically come from an audit log table
    // For now, we'll return a mock response structure
    const activities = {
      total: 0,
      page: Number(page),
      limit: Number(limit),
      offset: skip,
      activities: []
    };
    
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ message: `Error retrieving admin activity log: ${error.message}` });
  }
};
