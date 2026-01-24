import { Request, Response } from "express";
import { eq, count, isNotNull, desc } from "drizzle-orm";
import { db } from "../utils/database";
import { properties, locations, agents, agentProperties, landlords } from "../db/schema";

/**
 * Assigns a property to an agent based on location matching
 * If multiple agents match the location, distributes properties equally
 */
export const assignPropertyToAgent = async (
  propertyId: number
): Promise<{ success: boolean; agentId?: number; message: string }> => {
  try {
    // Get the property with its location
    const propertyData = await db.select()
      .from(properties)
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (propertyData.length === 0) {
      return { success: false, message: "Property not found" };
    }

    const property = {
      ...propertyData[0].Property,
      location: propertyData[0].Location
    };



    // Extract location keywords from property address and city
    if (!property.location) {
      return { success: false, message: "Property location not found" };
    }
    
    const propertyLocationKeywords = [
      ...property.location.address.toLowerCase().split(/\s+/),
      ...property.location.city.toLowerCase().split(/\s+/),
      property.location.state.toLowerCase()
    ].filter(keyword => keyword.length > 2); // Filter out short words

    // Find agents whose address contains any of the property location keywords
    const allAgents = await db.select()
      .from(agents)
      .where(isNotNull(agents.address));

    const matchingAgents = allAgents.filter((agent: any) => {
      if (!agent.address) return false;
      
      const agentAddressLower = agent.address.toLowerCase();
      return propertyLocationKeywords.some(keyword => 
        agentAddressLower.includes(keyword)
      );
    });

    if (matchingAgents.length === 0) {
      return { 
        success: false, 
        message: "No agents found matching the property location" 
      };
    }

    // If multiple agents match, find the one with the least assigned properties
    // to ensure equal distribution
    let selectedAgent = matchingAgents[0];
    
    if (matchingAgents.length > 1) {
      // Count properties assigned to each matching agent
      const agentPropertyCounts = await Promise.all(
        matchingAgents.map(async (agent: any) => {
          const countResult = await db.select({ count: count() })
            .from(agentProperties)
            .where(eq(agentProperties.agentId, agent.id));
          return { agent, count: countResult[0]?.count || 0 };
        })
      );

      // Sort by property count (ascending) to get agent with least properties
      agentPropertyCounts.sort((a: any, b: any) => a.count - b.count);
      selectedAgent = agentPropertyCounts[0].agent;
    }

    // Create the agent-property assignment
    await db.insert(agentProperties).values({
      agentId: selectedAgent.id,
      propertyId: propertyId,
      assignedAt: new Date()
    });

    return {
      success: true,
      agentId: selectedAgent.id,
      message: `Property assigned to agent ${selectedAgent.name}`
    };

  } catch (error: any) {
    console.error("Error assigning property to agent:", error);
    return {
      success: false,
      message: `Error assigning property: ${error.message}`
    };
  }
};

/**
 * API endpoint to manually assign a property to an agent
 */
export const assignPropertyToAgentEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { propertyId } = req.params;
    
    const result = await assignPropertyToAgent(Number(propertyId));
    
    if (result.success) {
      res.json({
        message: result.message,
        agentId: result.agentId
      });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error: any) {
    res.status(500).json({ message: `Error: ${error.message}` });
  }
};

/**
 * Get all properties assigned to a specific agent
 */
export const getAgentProperties = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { agentId } = req.params;
    
    const agentPropertiesData = await db.select()
      .from(agentProperties)
      .leftJoin(properties, eq(agentProperties.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .leftJoin(agents, eq(agentProperties.agentId, agents.id))
      .where(eq(agentProperties.agentId, Number(agentId)))
      .orderBy(desc(agentProperties.assignedAt));

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
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching agent properties: ${error.message}` });
  }
};

/**
 * Get the agent assigned to a specific property
 */
export const getPropertyAgent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { propertyId } = req.params;
    
    const agentPropertyData = await db.select()
      .from(agentProperties)
      .leftJoin(agents, eq(agentProperties.agentId, agents.id))
      .leftJoin(properties, eq(agentProperties.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(eq(agentProperties.propertyId, Number(propertyId)))
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
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching property agent: ${error.message}` });
  }
};