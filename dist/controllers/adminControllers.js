"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminActivityLog = exports.checkUserPrivilege = exports.getPrivilegeMatrix = exports.getAllPrivileges = exports.updateUserRole = exports.getUserPrivileges = exports.getTaskStats = exports.deleteTask = exports.updateTask = exports.getTasks = exports.createTask = exports.assignCodeToAgent = exports.getAgentRegistrationStats = exports.getAgentRegistrations = exports.getLandlordRegistrationStats = exports.getLandlordRegistrations = exports.getAllAgents = exports.getAgent = exports.getAdmin = exports.createAdmin = exports.createAgent = exports.updateAdminSettings = exports.getAdminSettings = exports.deleteProperty = exports.updatePropertyStatus = exports.deleteUser = exports.updateUserStatus = exports.getAllProperties = exports.getAllUsers = exports.getAnalytics = exports.createUser = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const emailSubscriptionService_1 = require("../utils/emailSubscriptionService");
const agentPropertyMatchingController_1 = require("./agentPropertyMatchingController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const auth_1 = require("../auth");
const emailService_1 = require("../utils/emailService");
const createUser = async (req, res) => {
    try {
        const { email, role } = req.body;
        const adminUser = req.user;
        if (!email || !role) {
            res.status(400).json({ message: "Email and role are required" });
            return;
        }
        if (!['agent', 'blogger'].includes(role)) {
            res.status(400).json({ message: "Invalid role. Only 'agent' and 'blogger' are allowed." });
            return;
        }
        const existingUser = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email)).limit(1);
        if (existingUser.length > 0) {
            res.status(400).json({ message: "User with this email already exists" });
            return;
        }
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
        const headers = { ...req.headers };
        delete headers['content-length'];
        const result = await auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name: email.split('@')[0],
                role,
                callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
            },
            headers: headers,
        });
        if (!result.user) {
            res.status(500).json({ message: "Failed to create user" });
            return;
        }
        if (role === 'agent') {
            await database_1.db.insert(schema_1.agents).values({
                cognitoId: result.user.id,
                name: email.split('@')[0],
                email,
                userId: result.user.id,
            });
        }
        else if (role === 'blogger') {
            await database_1.db.insert(schema_1.bloggers).values({
                userId: result.user.id,
                displayName: email.split('@')[0],
            });
        }
        try {
            await database_1.db.insert(schema_1.adminAuditLogs).values({
                adminUserId: adminUser?.id || 'system',
                action: 'CREATE_USER',
                targetUserId: result.user.id,
                details: { email, role, createdByEmail: adminUser?.email },
                ipAddress: req.ip || req.socket.remoteAddress,
            });
        }
        catch (auditError) {
            console.error("Failed to create audit log:", auditError);
        }
        try {
            await (0, emailService_1.sendEmail)({
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
        }
        catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
        }
        res.status(201).json({ message: "User created successfully", user: result.user });
    }
    catch (error) {
        console.error("Create user error:", error);
        res.status(500).json({ message: `Error creating user: ${error.message}` });
    }
};
exports.createUser = createUser;
const getAnalytics = async (_req, res) => {
    try {
        const [totalPropertiesResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.properties);
        const [totalTenantsResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.tenants);
        const [totalLandlordsResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.landlords);
        const [totalApplicationsResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.applications);
        const totalProperties = totalPropertiesResult.count;
        const totalUsers = totalTenantsResult.count + totalLandlordsResult.count;
        const totalApplications = totalApplicationsResult.count;
        const paidPayments = await database_1.db.select().from(schema_1.payments).where((0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, "Paid"));
        const totalRevenue = paidPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyPayments = await database_1.db.select()
            .from(schema_1.payments)
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.payments.paymentDate, sixMonthsAgo), (0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, "Paid")));
        const monthlyRevenue = monthlyPayments.reduce((acc, result) => {
            const payment = result.Payment;
            const month = payment.paymentDate.toISOString().slice(0, 7);
            const existing = acc.find(item => item.month === month);
            if (existing) {
                existing.revenue += payment.amountPaid;
            }
            else {
                acc.push({ month, revenue: payment.amountPaid });
            }
            return acc;
        }, []);
        const propertyTypesResult = await database_1.db.select({
            propertyType: schema_1.properties.propertyType,
            count: (0, drizzle_orm_1.count)()
        }).from(schema_1.properties).groupBy(schema_1.properties.propertyType);
        const propertyTypesData = propertyTypesResult.map(type => ({
            name: type.propertyType,
            count: type.count,
        }));
        const applicationsByStatusResult = await database_1.db.select({
            status: schema_1.applications.status,
            count: (0, drizzle_orm_1.count)()
        }).from(schema_1.applications).groupBy(schema_1.applications.status);
        const applicationsData = applicationsByStatusResult.map(status => ({
            status: status.status,
            count: status.count,
        }));
        const analytics = {
            totalProperties,
            totalUsers,
            totalApplications,
            totalRevenue,
            propertiesGrowth: '',
            usersGrowth: '',
            applicationsGrowth: '',
            revenueGrowth: '',
            monthlyRevenue,
            propertyTypes: propertyTypesData,
            applicationsByStatus: applicationsData,
        };
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching analytics: ${error.message}` });
    }
};
exports.getAnalytics = getAnalytics;
const getAllUsers = async (_req, res) => {
    try {
        const tenantsResult = await database_1.db.select({
            id: schema_1.tenants.id,
            cognitoId: schema_1.tenants.cognitoId,
            name: schema_1.tenants.name,
            email: schema_1.tenants.email,
            phoneNumber: schema_1.tenants.phoneNumber,
        }).from(schema_1.tenants);
        const landlordsResult = await database_1.db.select({
            id: schema_1.landlords.id,
            cognitoId: schema_1.landlords.cognitoId,
            name: schema_1.landlords.name,
            email: schema_1.landlords.email,
            phoneNumber: schema_1.landlords.phoneNumber,
        }).from(schema_1.landlords);
        const agentsResult = await database_1.db.select({
            id: schema_1.agents.id,
            cognitoId: schema_1.agents.cognitoId,
            name: schema_1.agents.name,
            email: schema_1.agents.email,
            phoneNumber: schema_1.agents.phoneNumber,
        }).from(schema_1.agents);
        const bloggersResult = await database_1.db.select({
            id: schema_1.bloggers.id,
            userId: schema_1.bloggers.userId,
            name: schema_1.bloggers.displayName,
            email: schema_1.users.email,
        })
            .from(schema_1.bloggers)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.bloggers.userId, schema_1.users.id));
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
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching users: ${error.message}` });
    }
};
exports.getAllUsers = getAllUsers;
const getAllProperties = async (_req, res) => {
    try {
        const propertiesResult = await database_1.db.select()
            .from(schema_1.properties)
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId));
        const formattedProperties = propertiesResult.map(result => ({
            ...result.Property,
            location: result.Location,
            landlord: result.Landlord
        }));
        res.json(formattedProperties);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching properties: ${error.message}` });
    }
};
exports.getAllProperties = getAllProperties;
const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        res.json({ message: "User status updated successfully", userId, status });
    }
    catch (error) {
        res.status(500).json({ message: `Error updating user status: ${error.message}` });
    }
};
exports.updateUserStatus = updateUserStatus;
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const tenant = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, userId)).limit(1);
        const landlord = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, userId)).limit(1);
        if (tenant.length > 0) {
            await database_1.db.delete(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, userId));
        }
        else if (landlord.length > 0) {
            await database_1.db.delete(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, userId));
        }
        else {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({ message: "User deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: `Error deleting user: ${error.message}` });
    }
};
exports.deleteUser = deleteUser;
const updatePropertyStatus = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { status } = req.body;
        const validStatuses = ['PendingApproval', 'Available', 'Closed', 'Rejected'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ message: "Invalid status. Must be one of: PendingApproval, Available, Closed, Rejected" });
            return;
        }
        await database_1.db.update(schema_1.properties)
            .set({ status })
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, Number(propertyId)));
        const updatedPropertyResult = await database_1.db.select()
            .from(schema_1.properties)
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, Number(propertyId)))
            .limit(1);
        const updatedProperty = updatedPropertyResult[0] ? {
            ...updatedPropertyResult[0].Property,
            location: updatedPropertyResult[0].Location,
            landlord: updatedPropertyResult[0].Landlord
        } : null;
        if (status === 'Available') {
            try {
                await (0, agentPropertyMatchingController_1.assignPropertyToAgent)(Number(propertyId));
                console.log(`Property ${propertyId} successfully assigned to an agent`);
            }
            catch (assignmentError) {
                console.error(`Failed to assign property ${propertyId} to agent:`, assignmentError.message);
            }
        }
        res.json({
            message: "Property status updated successfully",
            property: updatedProperty
        });
    }
    catch (error) {
        if (error.code === 'P2025') {
            res.status(404).json({ message: "Property not found" });
        }
        else {
            res.status(500).json({ message: `Error updating property status: ${error.message}` });
        }
    }
};
exports.updatePropertyStatus = updatePropertyStatus;
const deleteProperty = async (req, res) => {
    try {
        const { propertyId } = req.params;
        await database_1.db.delete(schema_1.properties)
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, Number(propertyId)));
        res.json({ message: "Property deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: `Error deleting property: ${error.message}` });
    }
};
exports.deleteProperty = deleteProperty;
const getAdminSettings = async (_req, res) => {
    try {
        let settingsResult = await database_1.db.select().from(schema_1.adminSettings).limit(1);
        let settings = settingsResult[0];
        if (!settings) {
            const newSettingsResult = await database_1.db.insert(schema_1.adminSettings)
                .values({})
                .returning();
            settings = newSettingsResult[0];
        }
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching settings: ${error.message}` });
    }
};
exports.getAdminSettings = getAdminSettings;
const updateAdminSettings = async (req, res) => {
    try {
        const settingsData = req.body;
        let settingsResult = await database_1.db.select().from(schema_1.adminSettings).limit(1);
        let settings = settingsResult[0];
        if (!settings) {
            const newSettingsResult = await database_1.db.insert(schema_1.adminSettings)
                .values(settingsData)
                .returning();
            settings = newSettingsResult[0];
        }
        else {
            const updatedSettingsResult = await database_1.db.update(schema_1.adminSettings)
                .set(settingsData)
                .where((0, drizzle_orm_1.eq)(schema_1.adminSettings.id, settings.id))
                .returning();
            settings = updatedSettingsResult[0];
        }
        res.json({ message: "Settings updated successfully", settings });
    }
    catch (error) {
        res.status(500).json({ message: `Error updating settings: ${error.message}` });
    }
};
exports.updateAdminSettings = updateAdminSettings;
const createAgent = async (req, res) => {
    try {
        console.log("Creating agent with request body:", req.body);
        const { cognitoId, name, email, phoneNumber, address } = req.body;
        if (!name || !email) {
            console.log("Missing required fields - name:", name, "email:", email);
            res.status(400).json({ message: "Name and email are required" });
            return;
        }
        console.log("Checking for existing agent with email:", email);
        const existingAgentResult = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.email, email)).limit(1);
        const existingAgent = existingAgentResult[0] || null;
        let agent;
        if (existingAgent) {
            console.log("Agent already exists:", existingAgent);
            if (cognitoId && existingAgent.cognitoId !== cognitoId) {
                console.log("Updating existing agent's cognitoId from", existingAgent.cognitoId, "to", cognitoId);
                const agentResult = await database_1.db.update(schema_1.agents)
                    .set({
                    cognitoId: cognitoId,
                    name,
                    phoneNumber: phoneNumber || existingAgent.phoneNumber,
                    address: address || existingAgent.address,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.agents.id, existingAgent.id))
                    .returning();
                agent = agentResult[0];
                console.log("Agent updated in database:", agent);
            }
            else {
                console.log("Agent already exists with same cognitoId, returning existing agent");
                agent = existingAgent;
            }
        }
        else {
            console.log("No existing agent found, proceeding with creation");
            const finalCognitoId = cognitoId || `temp-agent-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            console.log("Using cognitoId for agent:", finalCognitoId);
            if (!req.user) {
                req.user = {
                    id: finalCognitoId,
                    role: 'agent',
                    email: email,
                    name: name
                };
            }
            console.log("User object for agent creation:", req.user);
            console.log("Creating agent in database with cognitoId:", finalCognitoId);
            const agentResult = await database_1.db.insert(schema_1.agents).values({
                cognitoId: finalCognitoId,
                name,
                email,
                phoneNumber: phoneNumber || '',
                address: address || '',
            }).returning();
            agent = agentResult[0];
            console.log("Agent created in database:", agent);
        }
        try {
            await (0, emailSubscriptionService_1.addToEmailList)({
                email: agent.email,
                fullName: agent.name,
                subscriptionType: 'newsletter'
            });
            console.log(`Added agent ${agent.email} to email list`);
        }
        catch (emailError) {
            console.error('Error adding agent to email list:', emailError);
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
    }
    catch (error) {
        console.error("Error creating agent:", error);
        res.status(500).json({ message: `Error creating agent: ${error.message}` });
    }
};
exports.createAgent = createAgent;
const createAdmin = async (req, res) => {
    try {
        console.log("Creating admin with request body:", req.body);
        const { cognitoId, name, email, phoneNumber } = req.body;
        if (!name || !email) {
            console.log("Missing required fields - name:", name, "email:", email);
            res.status(400).json({ message: "Name and email are required" });
            return;
        }
        if (!email.endsWith('@homematch.ng')) {
            console.log("Invalid email domain:", email);
            res.status(400).json({ message: "Admin registration is only allowed for emails ending with @homematch.ng" });
            return;
        }
        console.log("Checking for existing admin with email:", email);
        const existingAdminResult = await database_1.db.select().from(schema_1.admins).where((0, drizzle_orm_1.eq)(schema_1.admins.email, email)).limit(1);
        const existingAdmin = existingAdminResult[0] || null;
        let admin;
        if (existingAdmin) {
            console.log("Admin already exists:", existingAdmin);
            if (cognitoId && existingAdmin.cognitoId !== cognitoId) {
                console.log("Updating existing admin's cognitoId from", existingAdmin.cognitoId, "to", cognitoId);
                const adminResult = await database_1.db.update(schema_1.admins)
                    .set({
                    cognitoId: cognitoId,
                    name,
                    phoneNumber: phoneNumber || existingAdmin.phoneNumber,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.admins.id, existingAdmin.id))
                    .returning();
                admin = adminResult[0];
                console.log("Admin updated in database:", admin);
            }
            else {
                console.log("Admin already exists with same cognitoId, returning existing admin");
                admin = existingAdmin;
            }
        }
        else {
            console.log("No existing admin found, proceeding with creation");
            const finalCognitoId = cognitoId || `temp-admin-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            console.log("Using cognitoId for admin:", finalCognitoId);
            console.log("Creating admin in database with cognitoId:", finalCognitoId);
            const adminResult = await database_1.db.insert(schema_1.admins).values({
                cognitoId: finalCognitoId,
                name,
                email,
                phoneNumber: phoneNumber || '',
            }).returning();
            admin = adminResult[0];
            console.log("Admin created in database:", admin);
        }
        try {
            await (0, emailSubscriptionService_1.addToEmailList)({
                email: admin.email,
                fullName: admin.name,
                subscriptionType: 'newsletter'
            });
            console.log(`Admin ${admin.email} added to email list`);
        }
        catch (emailError) {
            console.error('Error adding admin to email list:', emailError);
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
    }
    catch (error) {
        console.error("Error creating admin:", error);
        res.status(500).json({ message: `Error creating admin: ${error.message}` });
    }
};
exports.createAdmin = createAdmin;
const getAdmin = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        console.log("Getting admin with cognitoId:", cognitoId);
        const adminResult = await database_1.db.select({
            cognitoId: schema_1.admins.cognitoId,
            name: schema_1.admins.name,
            email: schema_1.admins.email,
            phoneNumber: schema_1.admins.phoneNumber,
        }).from(schema_1.admins).where((0, drizzle_orm_1.eq)(schema_1.admins.cognitoId, cognitoId)).limit(1);
        const admin = adminResult[0] || null;
        console.log("Admin found:", admin);
        if (!admin) {
            console.log("Admin not found for cognitoId:", cognitoId);
            res.status(404).json({ message: "Admin not found" });
            return;
        }
        res.json(admin);
    }
    catch (error) {
        console.error("Error retrieving admin:", error);
        res.status(500).json({ message: `Error retrieving admin: ${error.message}` });
    }
};
exports.getAdmin = getAdmin;
const getAgent = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        if (req.user?.role === 'agent' && req.user.id !== cognitoId) {
            res.status(403).json({ message: "Access denied: You can only view your own profile" });
            return;
        }
        console.log("Getting agent with cognitoId:", cognitoId);
        const agentResult = await database_1.db.select({
            id: schema_1.agents.id,
            cognitoId: schema_1.agents.cognitoId,
            name: schema_1.agents.name,
            email: schema_1.agents.email,
            phoneNumber: schema_1.agents.phoneNumber,
            address: schema_1.agents.address,
            isOnboardingComplete: schema_1.users.isOnboardingComplete,
        })
            .from(schema_1.agents)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.agents.cognitoId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.agents.cognitoId, cognitoId))
            .limit(1);
        const agent = agentResult[0] || null;
        console.log("Agent found:", agent);
        if (!agent) {
            console.log("Agent not found for cognitoId:", cognitoId);
            res.status(404).json({ message: "Agent not found" });
            return;
        }
        res.json(agent);
    }
    catch (error) {
        console.error("Error retrieving agent:", error);
        res.status(500).json({ message: `Error retrieving agent: ${error.message}` });
    }
};
exports.getAgent = getAgent;
const getAllAgents = async (_req, res) => {
    try {
        const allAgents = await database_1.db.select().from(schema_1.agents);
        res.json(allAgents);
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving agents: ${error.message}` });
    }
};
exports.getAllAgents = getAllAgents;
const getLandlordRegistrations = async (req, res) => {
    try {
        const { codeFilter, usedFilter } = req.query;
        let whereClause = {};
        if (codeFilter && typeof codeFilter === 'string') {
            whereClause.code = {
                contains: codeFilter,
                mode: 'insensitive'
            };
        }
        if (usedFilter !== undefined) {
            whereClause.isUsed = usedFilter === 'true';
        }
        const registrationCodes = await database_1.db.select()
            .from(schema_1.landlordRegistrationCodes)
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.id, schema_1.landlords.registrationCodeId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.landlordRegistrationCodes.createdAt));
        res.json(registrationCodes);
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving landlord registrations: ${error.message}` });
    }
};
exports.getLandlordRegistrations = getLandlordRegistrations;
const getLandlordRegistrationStats = async (_req, res) => {
    try {
        const [totalCodesResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.landlordRegistrationCodes);
        const [usedCodesResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.landlordRegistrationCodes).where((0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.isUsed, true));
        const totalCodes = totalCodesResult.count;
        const usedCodes = usedCodesResult.count;
        const availableCodes = totalCodes - usedCodes;
        const recentRegistrations = await database_1.db.select()
            .from(schema_1.landlordRegistrationCodes)
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.id, schema_1.landlords.registrationCodeId))
            .where((0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.isUsed, true))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.landlordRegistrationCodes.usedAt))
            .limit(5);
        res.json({
            totalCodes,
            usedCodes,
            availableCodes,
            recentRegistrations
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving landlord registration stats: ${error.message}` });
    }
};
exports.getLandlordRegistrationStats = getLandlordRegistrationStats;
const getAgentRegistrations = async (req, res) => {
    try {
        const { codeFilter, usedFilter } = req.query;
        let whereClause = {};
        if (codeFilter && typeof codeFilter === 'string') {
            whereClause.code = {
                contains: codeFilter,
                mode: 'insensitive'
            };
        }
        if (usedFilter !== undefined) {
            whereClause.isUsed = usedFilter === 'true';
        }
        const registrationCodes = await database_1.db.select()
            .from(schema_1.agentRegistrationCodes)
            .where(whereClause)
            .leftJoin(schema_1.agents, (0, drizzle_orm_1.eq)(schema_1.agentRegistrationCodes.id, schema_1.agents.registrationCodeId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.agentRegistrationCodes.createdAt));
        res.json(registrationCodes);
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving agent registrations: ${error.message}` });
    }
};
exports.getAgentRegistrations = getAgentRegistrations;
const getAgentRegistrationStats = async (_req, res) => {
    try {
        const [totalCodesResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.agentRegistrationCodes);
        const [usedCodesResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.agentRegistrationCodes).where((0, drizzle_orm_1.eq)(schema_1.agentRegistrationCodes.isUsed, true));
        const totalCodes = totalCodesResult.count;
        const usedCodes = usedCodesResult.count;
        const availableCodes = totalCodes - usedCodes;
        const recentRegistrations = await database_1.db.select()
            .from(schema_1.agentRegistrationCodes)
            .leftJoin(schema_1.agents, (0, drizzle_orm_1.eq)(schema_1.agentRegistrationCodes.id, schema_1.agents.registrationCodeId))
            .where((0, drizzle_orm_1.eq)(schema_1.agentRegistrationCodes.isUsed, true))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.agentRegistrationCodes.usedAt))
            .limit(5);
        res.json({
            totalCodes,
            usedCodes,
            availableCodes,
            recentRegistrations
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving agent registration stats: ${error.message}` });
    }
};
exports.getAgentRegistrationStats = getAgentRegistrationStats;
const assignCodeToAgent = async (req, res) => {
    try {
        const { codeId, agentId } = req.body;
        const adminCognitoId = req.user?.id;
        if (!adminCognitoId) {
            res.status(401).json({ message: 'Admin authentication required' });
            return;
        }
        const codeResult = await database_1.db.select().from(schema_1.agentRegistrationCodes).where((0, drizzle_orm_1.eq)(schema_1.agentRegistrationCodes.id, codeId)).limit(1);
        const code = codeResult[0];
        if (!code) {
            res.status(404).json({ message: 'Registration code not found' });
            return;
        }
        if (code.isUsed) {
            res.status(400).json({ message: 'Registration code is already used' });
            return;
        }
        const agentResult = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.id, agentId)).limit(1);
        const agent = agentResult[0];
        if (!agent) {
            res.status(404).json({ message: 'Agent not found' });
            return;
        }
        await database_1.db.update(schema_1.agentRegistrationCodes)
            .set({
            assignedBy: adminCognitoId,
            usedAt: new Date(),
            isUsed: true
        })
            .where((0, drizzle_orm_1.eq)(schema_1.agentRegistrationCodes.id, codeId));
        await database_1.db.update(schema_1.agents)
            .set({
            registrationCodeId: codeId
        })
            .where((0, drizzle_orm_1.eq)(schema_1.agents.id, agentId));
        res.json({ message: 'Code successfully assigned to agent' });
    }
    catch (error) {
        res.status(500).json({ message: `Error assigning code to agent: ${error.message}` });
    }
};
exports.assignCodeToAgent = assignCodeToAgent;
const createTask = async (req, res) => {
    try {
        const { title, description, priority, dueDate, agentId } = req.body;
        const adminCognitoId = req.user?.id;
        if (!adminCognitoId) {
            res.status(401).json({ message: 'Admin authentication required' });
            return;
        }
        const agentResult = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.id, agentId)).limit(1);
        const agent = agentResult[0];
        if (!agent) {
            res.status(404).json({ message: 'Agent not found' });
            return;
        }
        const taskResult = await database_1.db.insert(schema_1.tasks).values({
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
    }
    catch (error) {
        res.status(500).json({ message: `Error creating task: ${error.message}` });
    }
};
exports.createTask = createTask;
const getTasks = async (req, res) => {
    try {
        const { status, priority, agentId } = req.query;
        let whereClause = {};
        if (status && typeof status === 'string') {
            whereClause.status = status;
        }
        if (priority && typeof priority === 'string') {
            whereClause.priority = priority;
        }
        if (agentId && typeof agentId === 'string') {
            whereClause.agentId = parseInt(agentId);
        }
        const tasksResult = await database_1.db.select()
            .from(schema_1.tasks)
            .leftJoin(schema_1.agents, (0, drizzle_orm_1.eq)(schema_1.tasks.agentId, schema_1.agents.id))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.tasks.createdAt));
        const tasksData = tasksResult.map(result => ({
            ...result.Task,
            agent: result.Agent ? {
                name: result.Agent.name,
                email: result.Agent.email
            } : null
        }));
        res.json(tasksData);
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving tasks: ${error.message}` });
    }
};
exports.getTasks = getTasks;
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, dueDate } = req.body;
        const updateData = {};
        if (title)
            updateData.title = title;
        if (description)
            updateData.description = description;
        if (status)
            updateData.status = status;
        if (priority)
            updateData.priority = priority;
        if (dueDate)
            updateData.dueDate = new Date(dueDate);
        const taskResult = await database_1.db.update(schema_1.tasks)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.tasks.id, parseInt(id)))
            .returning();
        const agentResult = await database_1.db.select({
            name: schema_1.agents.name,
            email: schema_1.agents.email
        }).from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.id, taskResult[0].agentId)).limit(1);
        const task = {
            ...taskResult[0],
            agent: agentResult[0] || null
        };
        res.json(task);
    }
    catch (error) {
        res.status(500).json({ message: `Error updating task: ${error.message}` });
    }
};
exports.updateTask = updateTask;
const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.db.delete(schema_1.tasks).where((0, drizzle_orm_1.eq)(schema_1.tasks.id, parseInt(id)));
        res.json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: `Error deleting task: ${error.message}` });
    }
};
exports.deleteTask = deleteTask;
const getTaskStats = async (_req, res) => {
    try {
        const [totalTasksResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.tasks);
        const [pendingTasksResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.tasks).where((0, drizzle_orm_1.eq)(schema_1.tasks.status, 'Pending'));
        const [inProgressTasksResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.tasks).where((0, drizzle_orm_1.eq)(schema_1.tasks.status, 'InProgress'));
        const [completedTasksResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.tasks).where((0, drizzle_orm_1.eq)(schema_1.tasks.status, 'Completed'));
        const [overdueTasksResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.tasks)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_1.tasks.dueDate} < ${new Date()}`, (0, drizzle_orm_1.sql) `${schema_1.tasks.status} != 'Completed'`));
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
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving task stats: ${error.message}` });
    }
};
exports.getTaskStats = getTaskStats;
const getUserPrivileges = async (req, res) => {
    try {
        const { userId } = req.params;
        const userResult = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        const user = userResult[0] || null;
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const userRole = user.role || 'tenant';
        const privileges = (0, authMiddleware_1.getRolePrivileges)(userRole);
        res.json({
            userId,
            role: userRole,
            privileges,
            privilegeDescriptions: {
                [authMiddleware_1.AdminPrivilege.USER_MANAGEMENT]: "Manage user accounts, roles, and permissions",
                [authMiddleware_1.AdminPrivilege.PROPERTY_MANAGEMENT]: "Manage property listings, approvals, and status",
                [authMiddleware_1.AdminPrivilege.FINANCIAL_MANAGEMENT]: "Access financial data, payments, and revenue",
                [authMiddleware_1.AdminPrivilege.SYSTEM_SETTINGS]: "Configure system settings and preferences",
                [authMiddleware_1.AdminPrivilege.ANALYTICS_ACCESS]: "View analytics, reports, and statistics",
                [authMiddleware_1.AdminPrivilege.AGENT_MANAGEMENT]: "Manage agents, assignments, and codes",
                [authMiddleware_1.AdminPrivilege.TASK_MANAGEMENT]: "Create, assign, and manage tasks",
                [authMiddleware_1.AdminPrivilege.SUPER_ADMIN]: "Full administrative access to all features"
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving user privileges: ${error.message}` });
    }
};
exports.getUserPrivileges = getUserPrivileges;
const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newRole } = req.body;
        const currentUser = req.user;
        if (!currentUser || !(0, authMiddleware_1.hasPrivilege)(currentUser.role, authMiddleware_1.AdminPrivilege.SUPER_ADMIN)) {
            res.status(403).json({ message: "Insufficient privileges to update user roles" });
            return;
        }
        const validRoles = ['tenant', 'landlord', 'agent', 'admin'];
        if (!validRoles.includes(newRole)) {
            res.status(400).json({ message: "Invalid role specified" });
            return;
        }
        const updatedUserResult = await database_1.db.update(schema_1.users)
            .set({ role: newRole })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        const updatedUser = updatedUserResult[0];
        if (!updatedUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        console.log(`User ${userId} role updated to ${newRole} by admin ${currentUser.id}`);
        res.json({
            message: "User role updated successfully",
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: newRole,
                privileges: (0, authMiddleware_1.getRolePrivileges)(newRole)
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error updating user role: ${error.message}` });
    }
};
exports.updateUserRole = updateUserRole;
const getAllPrivileges = async (_req, res) => {
    try {
        const privileges = Object.values(authMiddleware_1.AdminPrivilege).map(privilege => ({
            name: privilege,
            description: {
                [authMiddleware_1.AdminPrivilege.USER_MANAGEMENT]: "Manage user accounts, roles, and permissions",
                [authMiddleware_1.AdminPrivilege.PROPERTY_MANAGEMENT]: "Manage property listings, approvals, and status",
                [authMiddleware_1.AdminPrivilege.FINANCIAL_MANAGEMENT]: "Access financial data, payments, and revenue",
                [authMiddleware_1.AdminPrivilege.SYSTEM_SETTINGS]: "Configure system settings and preferences",
                [authMiddleware_1.AdminPrivilege.ANALYTICS_ACCESS]: "View analytics, reports, and statistics",
                [authMiddleware_1.AdminPrivilege.AGENT_MANAGEMENT]: "Manage agents, assignments, and codes",
                [authMiddleware_1.AdminPrivilege.TASK_MANAGEMENT]: "Create, assign, and manage tasks",
                [authMiddleware_1.AdminPrivilege.SUPER_ADMIN]: "Full administrative access to all features"
            }[privilege]
        }));
        res.json({ privileges });
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving privileges: ${error.message}` });
    }
};
exports.getAllPrivileges = getAllPrivileges;
const getPrivilegeMatrix = async (_req, res) => {
    try {
        const roles = ['tenant', 'landlord', 'agent', 'admin'];
        const matrix = roles.map(role => ({
            role,
            privileges: (0, authMiddleware_1.getRolePrivileges)(role)
        }));
        res.json({ matrix });
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving privilege matrix: ${error.message}` });
    }
};
exports.getPrivilegeMatrix = getPrivilegeMatrix;
const checkUserPrivilege = async (req, res) => {
    try {
        const { privilege } = req.params;
        const currentUser = req.user;
        if (!currentUser) {
            res.status(401).json({ message: "User not authenticated" });
            return;
        }
        if (!Object.values(authMiddleware_1.AdminPrivilege).includes(privilege)) {
            res.status(400).json({ message: "Invalid privilege specified" });
            return;
        }
        const hasAccess = (0, authMiddleware_1.hasPrivilege)(currentUser.role, privilege);
        res.json({
            userId: currentUser.id,
            role: currentUser.role,
            privilege,
            hasAccess
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error checking user privilege: ${error.message}` });
    }
};
exports.checkUserPrivilege = checkUserPrivilege;
const getAdminActivityLog = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const activities = {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            offset: skip,
            activities: []
        };
        res.json(activities);
    }
    catch (error) {
        res.status(500).json({ message: `Error retrieving admin activity log: ${error.message}` });
    }
};
exports.getAdminActivityLog = getAdminActivityLog;
