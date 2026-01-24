import { eq, and } from "drizzle-orm";
import { db } from "./database.js";
import { leases, tenants, properties, tenantProperties } from "../db/schema.js";

/**
 * This script fixes the issue where tenants who have paid for properties
 * are not connected to those properties in the database.
 * It finds all leases and ensures the tenant is connected to the property.
 */
export const fixTenantPropertyConnections = async () => {
  try {
    console.log("Starting to fix tenant-property connections...");
    
    // Find all leases
    const allLeases = await db.select().from(leases);
    
    let fixedCount = 0;
    
    for (const lease of allLeases) {
      // Get tenant details first to get the tenant ID
      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.cognitoId, lease.tenantCognitoId))
        .limit(1);
        
      if (!tenant) {
        console.log(`Tenant with cognitoId ${lease.tenantCognitoId} not found, skipping...`);
        continue;
      }
      
      // Check if tenant is already connected to this property
      const [existingConnection] = await db.select()
        .from(tenantProperties)
        .where(and(
          eq(tenantProperties.propertyId, lease.propertyId),
          eq(tenantProperties.tenantId, tenant.id)
        ))
        .limit(1);
      
      if (!existingConnection) {
        // Get property details for logging
        const [property] = await db.select().from(properties)
          .where(eq(properties.id, lease.propertyId))
          .limit(1);
          
        console.log(`Connecting tenant ${tenant.name} to property ${property?.name}`);
        
        // Connect tenant to property
        await db.insert(tenantProperties)
          .values({
            propertyId: lease.propertyId,
            tenantId: tenant.id
          });
        
        fixedCount++;
      }
    }
    
    console.log(`Fixed ${fixedCount} tenant-property connections.`);
    return { success: true, fixedCount };
    
  } catch (error: any) {
    console.error("Error fixing tenant-property connections:", error);
    return { success: false, error: error.message };
  } finally {
    // No need to disconnect with Drizzle
  }
};

// Run the script if called directly
if (require.main === module) {
  fixTenantPropertyConnections()
    .then((result) => {
      console.log("Script completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}