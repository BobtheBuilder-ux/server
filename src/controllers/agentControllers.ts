import { Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../utils/database";
import { properties, tenants, landlords, leases, agents, tasks } from "../db/schema";

export const getAgentLeads = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Return empty array - no demo content
    const leads: any[] = [];

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching leads: ${error.message}` });
  }
};

export const getAgentClients = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get landlords and tenants as clients
    const landlordsResult = await db.select()
      .from(landlords)
      .leftJoin(properties, eq(properties.landlordCognitoId, landlords.cognitoId));

    const tenantsResult = await db.select()
      .from(tenants)
      .leftJoin(leases, eq(leases.tenantCognitoId, tenants.cognitoId))
      .leftJoin(properties, eq(leases.propertyId, properties.id));

    // Group landlords with their properties
    const landlordsWithProperties = landlordsResult.reduce((acc: any[], result) => {
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

    // Group tenants with their properties
    const tenantsWithProperties = tenantsResult.reduce((acc: any[], result) => {
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
        totalValue: landlord.managedProperties.reduce((sum: number, prop: any) => sum + prop.pricePerYear, 0),
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
        totalValue: tenant.properties.reduce((sum: number, prop: any) => sum + prop.pricePerYear, 0),
        lastContact: new Date(),
      })),
    ];

    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching clients: ${error.message}` });
  }
};

export const getAgentTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const agentCognitoId = req.user?.id;
    
    if (!agentCognitoId) {
      res.status(401).json({ message: 'Agent authentication required' });
      return;
    }
    
    // Find the agent by cognitoId
    const agentResult = await db.select().from(agents).where(eq(agents.cognitoId, agentCognitoId)).limit(1);
    
    if (!agentResult || agentResult.length === 0) {
      res.status(404).json({ message: 'Agent not found' });
      return;
    }
    
    const agent = agentResult[0];
    const { status, priority } = req.query;
    
    let whereConditions = [eq(tasks.agentId, agent.id)];
    
    if (status && typeof status === 'string') {
      whereConditions.push(eq(tasks.status, status as any));
    }
    
    if (priority && typeof priority === 'string') {
      whereConditions.push(eq(tasks.priority, priority as any));
    }
    
    const tasksResult = await db.select().from(tasks).where(and(...whereConditions)).orderBy(desc(tasks.createdAt));

    res.json(tasksResult);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching tasks: ${error.message}` });
  }
};

export const updateLeadStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    // In a real implementation, you'd update the lead status in the database
    res.json({ message: "Lead status updated successfully", leadId, status });
  } catch (error: any) {
    res.status(500).json({ message: `Error updating lead status: ${error.message}` });
  }
};

export const updateTaskStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { status, description } = req.body;
    const agentCognitoId = req.user?.id;
    
    if (!agentCognitoId) {
      res.status(401).json({ message: 'Agent authentication required' });
      return;
    }
    
    // Find the agent by cognitoId
    const agentResult = await db.select().from(agents).where(eq(agents.cognitoId, agentCognitoId)).limit(1);
    
    if (!agentResult || agentResult.length === 0) {
      res.status(404).json({ message: 'Agent not found' });
      return;
    }
    
    const agent = agentResult[0];
    
    // Check if the task exists and belongs to this agent
    const existingTaskResult = await db.select().from(tasks).where(
      and(
        eq(tasks.id, parseInt(taskId)),
        eq(tasks.agentId, agent.id)
      )
    ).limit(1);
    
    if (!existingTaskResult || existingTaskResult.length === 0) {
      res.status(404).json({ message: 'Task not found or not assigned to this agent' });
      return;
    }
    
    // Update the task
    const updateData: any = {};
    if (status) updateData.status = status;
    if (description) updateData.description = description;
    
    const updatedTaskResult = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, parseInt(taskId)))
      .returning();

    res.json(updatedTaskResult[0]);
  } catch (error: any) {
    res.status(500).json({ message: `Error updating task status: ${error.message}` });
  }
};

export const updateAgentSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const { name, email, phoneNumber, address } = req.body;

    // Update agent in database
    const updatedAgentResult = await db.update(agents)
      .set({
        name,
        email,
        phoneNumber,
        address,
      })
      .where(eq(agents.cognitoId, cognitoId))
      .returning();

    const updatedAgent = updatedAgentResult[0];

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
  } catch (error: any) {
    res.status(500).json({ message: `Error updating agent settings: ${error.message}` });
  }
};

export const getAgentProperties = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Return empty array - no demo content
    const leads: any[] = [];

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching leads: ${error.message}` });
  }
};

export const getAgentApplications = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get landlords and tenants as clients
    const landlordsResult = await db.select()
      .from(landlords)
      .leftJoin(properties, eq(properties.landlordCognitoId, landlords.cognitoId));

    const tenantsResult = await db.select()
      .from(tenants)
      .leftJoin(leases, eq(leases.tenantCognitoId, tenants.cognitoId))
      .leftJoin(properties, eq(leases.propertyId, properties.id));

    // Group landlords with their properties
    const landlordsWithProperties = landlordsResult.reduce((acc: any[], result) => {
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

    // Group tenants with their properties
    const tenantsWithProperties = tenantsResult.reduce((acc: any[], result) => {
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
        totalValue: landlord.managedProperties.reduce((sum: number, prop: any) => sum + prop.pricePerYear, 0),
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
        totalValue: tenant.properties.reduce((sum: number, prop: any) => sum + prop.pricePerYear, 0),
        lastContact: new Date(),
      })),
    ];

    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching clients: ${error.message}` });
  }
};