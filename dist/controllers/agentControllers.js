"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentApplications = exports.getAgentProperties = exports.updateAgentSettings = exports.updateTaskStatus = exports.updateLeadStatus = exports.getAgentTasks = exports.getAgentClients = exports.getAgentLeads = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const getAgentLeads = async (_req, res) => {
    try {
        const leads = [];
        res.json(leads);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching leads: ${error.message}` });
    }
};
exports.getAgentLeads = getAgentLeads;
const getAgentClients = async (_req, res) => {
    try {
        const landlordsResult = await database_1.db.select()
            .from(schema_1.landlords)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId));
        const tenantsResult = await database_1.db.select()
            .from(schema_1.tenants)
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id));
        const landlordsWithProperties = landlordsResult.reduce((acc, result) => {
            const landlord = result.Landlord;
            const property = result.Property;
            let existingLandlord = acc.find(l => l.id === landlord.id);
            if (!existingLandlord) {
                existingLandlord = {
                    ...landlord,
                    managedProperties: []
                };
                acc.push(existingLandlord);
            }
            if (property) {
                existingLandlord.managedProperties.push(property);
            }
            return acc;
        }, []);
        const tenantsWithProperties = tenantsResult.reduce((acc, result) => {
            const tenant = result.Tenant;
            const property = result.Property;
            let existingTenant = acc.find(t => t.id === tenant.id);
            if (!existingTenant) {
                existingTenant = {
                    ...tenant,
                    properties: []
                };
                acc.push(existingTenant);
            }
            if (property) {
                existingTenant.properties.push(property);
            }
            return acc;
        }, []);
        const clients = [
            ...landlordsWithProperties.map(landlord => ({
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                phoneNumber: landlord.phoneNumber,
                type: "landlord",
                status: "active",
                propertiesCount: landlord.managedProperties.length,
                totalValue: landlord.managedProperties.reduce((sum, prop) => sum + prop.pricePerYear, 0),
                lastContact: new Date(),
            })),
            ...tenantsWithProperties.map(tenant => ({
                id: tenant.id,
                name: tenant.name,
                email: tenant.email,
                phoneNumber: tenant.phoneNumber,
                type: "tenant",
                status: "active",
                propertiesCount: tenant.properties.length,
                totalValue: tenant.properties.reduce((sum, prop) => sum + prop.pricePerYear, 0),
                lastContact: new Date(),
            })),
        ];
        res.json(clients);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching clients: ${error.message}` });
    }
};
exports.getAgentClients = getAgentClients;
const getAgentTasks = async (req, res) => {
    try {
        const agentCognitoId = req.user?.id;
        if (!agentCognitoId) {
            res.status(401).json({ message: 'Agent authentication required' });
            return;
        }
        const agentResult = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.cognitoId, agentCognitoId)).limit(1);
        if (!agentResult || agentResult.length === 0) {
            res.status(404).json({ message: 'Agent not found' });
            return;
        }
        const agent = agentResult[0];
        const { status, priority } = req.query;
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.tasks.agentId, agent.id)];
        if (status && typeof status === 'string') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.tasks.status, status));
        }
        if (priority && typeof priority === 'string') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.tasks.priority, priority));
        }
        const tasksResult = await database_1.db.select().from(schema_1.tasks).where((0, drizzle_orm_1.and)(...whereConditions)).orderBy((0, drizzle_orm_1.desc)(schema_1.tasks.createdAt));
        res.json(tasksResult);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching tasks: ${error.message}` });
    }
};
exports.getAgentTasks = getAgentTasks;
const updateLeadStatus = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { status } = req.body;
        res.json({ message: "Lead status updated successfully", leadId, status });
    }
    catch (error) {
        res.status(500).json({ message: `Error updating lead status: ${error.message}` });
    }
};
exports.updateLeadStatus = updateLeadStatus;
const updateTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, description } = req.body;
        const agentCognitoId = req.user?.id;
        if (!agentCognitoId) {
            res.status(401).json({ message: 'Agent authentication required' });
            return;
        }
        const agentResult = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.cognitoId, agentCognitoId)).limit(1);
        if (!agentResult || agentResult.length === 0) {
            res.status(404).json({ message: 'Agent not found' });
            return;
        }
        const agent = agentResult[0];
        const existingTaskResult = await database_1.db.select().from(schema_1.tasks).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.tasks.id, parseInt(taskId)), (0, drizzle_orm_1.eq)(schema_1.tasks.agentId, agent.id))).limit(1);
        if (!existingTaskResult || existingTaskResult.length === 0) {
            res.status(404).json({ message: 'Task not found or not assigned to this agent' });
            return;
        }
        const updateData = {};
        if (status)
            updateData.status = status;
        if (description)
            updateData.description = description;
        const updatedTaskResult = await database_1.db.update(schema_1.tasks)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.tasks.id, parseInt(taskId)))
            .returning();
        res.json(updatedTaskResult[0]);
    }
    catch (error) {
        res.status(500).json({ message: `Error updating task status: ${error.message}` });
    }
};
exports.updateTaskStatus = updateTaskStatus;
const updateAgentSettings = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const { name, email, phoneNumber, address } = req.body;
        const updatedAgentResult = await database_1.db.update(schema_1.agents)
            .set({
            name,
            email,
            phoneNumber,
            address,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.agents.cognitoId, cognitoId))
            .returning();
        const updatedAgent = updatedAgentResult[0];
        await database_1.db.update(schema_1.users)
            .set({ isOnboardingComplete: true })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, cognitoId));
        res.json({
            message: "Agent settings updated successfully",
            agent: {
                cognitoId: updatedAgent.cognitoId,
                name: updatedAgent.name,
                email: updatedAgent.email,
                phoneNumber: updatedAgent.phoneNumber,
                address: updatedAgent.address,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: `Error updating agent settings: ${error.message}` });
    }
};
exports.updateAgentSettings = updateAgentSettings;
const getAgentProperties = async (_req, res) => {
    try {
        const leads = [];
        res.json(leads);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching leads: ${error.message}` });
    }
};
exports.getAgentProperties = getAgentProperties;
const getAgentApplications = async (_req, res) => {
    try {
        const landlordsResult = await database_1.db.select()
            .from(schema_1.landlords)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId));
        const tenantsResult = await database_1.db.select()
            .from(schema_1.tenants)
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id));
        const landlordsWithProperties = landlordsResult.reduce((acc, result) => {
            const landlord = result.Landlord;
            const property = result.Property;
            let existingLandlord = acc.find(l => l.id === landlord.id);
            if (!existingLandlord) {
                existingLandlord = {
                    ...landlord,
                    managedProperties: []
                };
                acc.push(existingLandlord);
            }
            if (property) {
                existingLandlord.managedProperties.push(property);
            }
            return acc;
        }, []);
        const tenantsWithProperties = tenantsResult.reduce((acc, result) => {
            const tenant = result.Tenant;
            const property = result.Property;
            let existingTenant = acc.find(t => t.id === tenant.id);
            if (!existingTenant) {
                existingTenant = {
                    ...tenant,
                    properties: []
                };
                acc.push(existingTenant);
            }
            if (property) {
                existingTenant.properties.push(property);
            }
            return acc;
        }, []);
        const clients = [
            ...landlordsWithProperties.map(landlord => ({
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                phoneNumber: landlord.phoneNumber,
                type: "landlord",
                status: "active",
                propertiesCount: landlord.managedProperties.length,
                totalValue: landlord.managedProperties.reduce((sum, prop) => sum + prop.pricePerYear, 0),
                lastContact: new Date(),
            })),
            ...tenantsWithProperties.map(tenant => ({
                id: tenant.id,
                name: tenant.name,
                email: tenant.email,
                phoneNumber: tenant.phoneNumber,
                type: "tenant",
                status: "active",
                propertiesCount: tenant.properties.length,
                totalValue: tenant.properties.reduce((sum, prop) => sum + prop.pricePerYear, 0),
                lastContact: new Date(),
            })),
        ];
        res.json(clients);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching clients: ${error.message}` });
    }
};
exports.getAgentApplications = getAgentApplications;
