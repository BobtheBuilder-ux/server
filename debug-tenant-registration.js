const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { tenants, landlords } = require('./src/db/schema');
const { eq, desc, sql } = require('drizzle-orm');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const db = drizzle(pool);

async function debugTenantRegistration() {
  try {
    console.log('🔍 Debugging tenant registration...\n');

    // Get recent tenants with null registeredByLandlordId
    console.log('1. Recent tenants with null registeredByLandlordId:');
    const nullLandlordTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        email: tenants.email,
        registrationSource: tenants.registrationSource,
        registeredByLandlordId: tenants.registeredByLandlordId,
        createdAt: tenants.createdAt
      })
      .from(tenants)
      .where(sql`${tenants.registeredByLandlordId} IS NULL`)
      .orderBy(desc(tenants.createdAt))
      .limit(10);

    console.log(`Found ${nullLandlordTenants.length} tenants with null registeredByLandlordId:`);
    nullLandlordTenants.forEach(tenant => {
      console.log(`  - ID: ${tenant.id}, Name: ${tenant.name}, Email: ${tenant.email}`);
      console.log(`    Registration Source: ${tenant.registrationSource}, Created: ${tenant.createdAt}`);
    });

    console.log('\n2. Recent tenants with registrationSource = "landlord_link":');
    const landlordLinkTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        email: tenants.email,
        registrationSource: tenants.registrationSource,
        registeredByLandlordId: tenants.registeredByLandlordId,
        createdAt: tenants.createdAt
      })
      .from(tenants)
      .where(eq(tenants.registrationSource, 'landlord_link'))
      .orderBy(desc(tenants.createdAt))
      .limit(10);

    console.log(`Found ${landlordLinkTenants.length} tenants with registrationSource = "landlord_link":`);
    landlordLinkTenants.forEach(tenant => {
      console.log(`  - ID: ${tenant.id}, Name: ${tenant.name}, Email: ${tenant.email}`);
      console.log(`    Registered By Landlord ID: ${tenant.registeredByLandlordId}, Created: ${tenant.createdAt}`);
    });

    console.log('\n3. All recent tenants (last 20):');
    const recentTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        email: tenants.email,
        registrationSource: tenants.registrationSource,
        registeredByLandlordId: tenants.registeredByLandlordId,
        createdAt: tenants.createdAt
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt))
      .limit(20);

    console.log(`Found ${recentTenants.length} recent tenants:`);
    recentTenants.forEach(tenant => {
      console.log(`  - ID: ${tenant.id}, Name: ${tenant.name}, Email: ${tenant.email}`);
      console.log(`    Source: ${tenant.registrationSource}, Landlord ID: ${tenant.registeredByLandlordId}, Created: ${tenant.createdAt}`);
    });

    console.log('\n4. Available landlords with registration links:');
    const landlordsWithLinks = await db
      .select({
        id: landlords.id,
        name: landlords.name,
        email: landlords.email,
        tenantRegistrationLink: landlords.tenantRegistrationLink
      })
      .from(landlords)
      .limit(10);

    console.log(`Found ${landlordsWithLinks.length} landlords:`);
    landlordsWithLinks.forEach(landlord => {
      console.log(`  - ID: ${landlord.id}, Name: ${landlord.name}, Email: ${landlord.email}`);
      console.log(`    Registration Link: ${landlord.tenantRegistrationLink}`);
    });

  } catch (error) {
    console.error('❌ Error debugging tenant registration:', error);
  } finally {
    await pool.end();
  }
}

debugTenantRegistration();