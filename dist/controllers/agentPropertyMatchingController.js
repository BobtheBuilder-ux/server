"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPropertyAgent = exports.getAgentProperties = exports.assignPropertyToAgentEndpoint = exports.assignPropertyToAgent = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const assignPropertyToAgent = async (propertyId) => {
    try {
        const propertyData = await database_1.db.select()
            .from(schema_1.properties)
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
            .limit(1);
        if (propertyData.length === 0) {
            return { success: false, message: "Property not found" };
        }
        const property = {
            ...propertyData[0].Property,
            location: propertyData[0].Location
        };
        if (!property.location) {
            return { success: false, message: "Property location not found" };
        }
        const propertyLocationKeywords = [
            ...property.location.address.toLowerCase().split(/\s+/),
            ...property.location.city.toLowerCase().split(/\s+/),
            property.location.state.toLowerCase()
        ].filter(keyword => keyword.length > 2);
        const allAgents = await database_1.db.select()
            .from(schema_1.agents)
            .where((0, drizzle_orm_1.isNotNull)(schema_1.agents.address));
        const matchingAgents = allAgents.filter((agent) => {
            if (!agent.address)
                return false;
            const agentAddressLower = agent.address.toLowerCase();
            return propertyLocationKeywords.some(keyword => agentAddressLower.includes(keyword));
        });
        if (matchingAgents.length === 0) {
            return {
                success: false,
                message: "No agents found matching the property location"
            };
        }
        let selectedAgent = matchingAgents[0];
        if (matchingAgents.length > 1) {
            const agentPropertyCounts = await Promise.all(matchingAgents.map(async (agent) => {
                const countResult = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                    .from(schema_1.agentProperties)
                    .where((0, drizzle_orm_1.eq)(schema_1.agentProperties.agentId, agent.id));
                return { agent, count: countResult[0]?.count || 0 };
            }));
            agentPropertyCounts.sort((a, b) => a.count - b.count);
            selectedAgent = agentPropertyCounts[0].agent;
        }
        await database_1.db.insert(schema_1.agentProperties).values({
            agentId: selectedAgent.id,
            propertyId: propertyId,
            assignedAt: new Date()
        });
        return {
            success: true,
            agentId: selectedAgent.id,
            message: `Property assigned to agent ${selectedAgent.name}`
        };
    }
    catch (error) {
        console.error("Error assigning property to agent:", error);
        return {
            success: false,
            message: `Error assigning property: ${error.message}`
        };
    }
};
exports.assignPropertyToAgent = assignPropertyToAgent;
const assignPropertyToAgentEndpoint = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const result = await (0, exports.assignPropertyToAgent)(Number(propertyId));
        if (result.success) {
            res.json({
                message: result.message,
                agentId: result.agentId
            });
        }
        else {
            res.status(400).json({ message: result.message });
        }
    }
    catch (error) {
        res.status(500).json({ message: `Error: ${error.message}` });
    }
};
exports.assignPropertyToAgentEndpoint = assignPropertyToAgentEndpoint;
const getAgentProperties = async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentPropertiesData = await database_1.db.select()
            .from(schema_1.agentProperties)
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.agentProperties.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .leftJoin(schema_1.agents, (0, drizzle_orm_1.eq)(schema_1.agentProperties.agentId, schema_1.agents.id))
            .where((0, drizzle_orm_1.eq)(schema_1.agentProperties.agentId, Number(agentId)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.agentProperties.assignedAt));
        const agentPropertiesWithRelations = agentPropertiesData.map(row => ({
            ...row.AgentProperty,
            property: {
                ...row.Property,
                location: row.Location,
                landlord: row.Landlord
            },
            agent: row.Agent
        }));
        res.json(agentPropertiesWithRelations);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching agent properties: ${error.message}` });
    }
};
exports.getAgentProperties = getAgentProperties;
const getPropertyAgent = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const agentPropertyData = await database_1.db.select()
            .from(schema_1.agentProperties)
            .leftJoin(schema_1.agents, (0, drizzle_orm_1.eq)(schema_1.agentProperties.agentId, schema_1.agents.id))
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.agentProperties.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.eq)(schema_1.agentProperties.propertyId, Number(propertyId)))
            .limit(1);
        if (agentPropertyData.length === 0) {
            res.status(404).json({ message: "No agent assigned to this property" });
            return;
        }
        const agentProperty = {
            ...agentPropertyData[0].AgentProperty,
            agent: agentPropertyData[0].Agent,
            property: {
                ...agentPropertyData[0].Property,
                location: agentPropertyData[0].Location
            }
        };
        res.json(agentProperty);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching property agent: ${error.message}` });
    }
};
exports.getPropertyAgent = getPropertyAgent;
