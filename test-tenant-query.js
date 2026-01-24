const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testTenantQuery() {
  try {
    // Query all tenants to see what cognitoId values exist
    const result = await pool.query(`
      SELECT id, "cognitoId", name, email, "registrationSource", "registeredByLandlordId"
      FROM "Tenant"
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log('Recent tenants in database:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Also check users table to see the relationship
    const usersResult = await pool.query(`
      SELECT id, email, name, role
      FROM "User"
      ORDER BY "createdAt" DESC
      LIMIT 10
    `);
    
    console.log('\nRecent users in database:');
    console.log(JSON.stringify(usersResult.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testTenantQuery();