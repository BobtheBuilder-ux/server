"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixTenantPropertyConnections = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_js_1 = require("./database.js");
const schema_js_1 = require("../db/schema.js");
const fixTenantPropertyConnections = async () => {
    try {
        console.log("Starting to fix tenant-property connections...");
        const allLeases = await database_js_1.db.select().from(schema_js_1.leases);
        let fixedCount = 0;
        for (const lease of allLeases) {
            const [tenant] = await database_js_1.db.select().from(schema_js_1.tenants)
                .where((0, drizzle_orm_1.eq)(schema_js_1.tenants.cognitoId, lease.tenantCognitoId))
                .limit(1);
            if (!tenant) {
                console.log(`Tenant with cognitoId ${lease.tenantCognitoId} not found, skipping...`);
                continue;
            }
            const [existingConnection] = await database_js_1.db.select()
                .from(schema_js_1.tenantProperties)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.tenantProperties.propertyId, lease.propertyId), (0, drizzle_orm_1.eq)(schema_js_1.tenantProperties.tenantId, tenant.id)))
                .limit(1);
            if (!existingConnection) {
                const [property] = await database_js_1.db.select().from(schema_js_1.properties)
                    .where((0, drizzle_orm_1.eq)(schema_js_1.properties.id, lease.propertyId))
                    .limit(1);
                console.log(`Connecting tenant ${tenant.name} to property ${property?.name}`);
                await database_js_1.db.insert(schema_js_1.tenantProperties)
                    .values({
                    propertyId: lease.propertyId,
                    tenantId: tenant.id
                });
                fixedCount++;
            }
        }
        console.log(`Fixed ${fixedCount} tenant-property connections.`);
        return { success: true, fixedCount };
    }
    catch (error) {
        console.error("Error fixing tenant-property connections:", error);
        return { success: false, error: error.message };
    }
    finally {
    }
};
exports.fixTenantPropertyConnections = fixTenantPropertyConnections;
if (require.main === module) {
    (0, exports.fixTenantPropertyConnections)()
        .then((result) => {
        console.log("Script completed:", result);
        process.exit(0);
    })
        .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });
}
