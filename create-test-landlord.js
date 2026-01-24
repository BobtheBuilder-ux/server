const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { landlords } = require('./dist/db/schema');
const crypto = require('crypto');
require('dotenv').config();

// Database connection using environment variable
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ 
  connectionString
});
const db = drizzle(pool);

async function createTestLandlord() {
  try {
    console.log('Creating test landlord...');
    
    // Generate a unique registration link
    const tenantRegistrationLink = crypto.randomBytes(32).toString('hex');
    
    const testLandlord = {
      cognitoId: 'test-landlord-' + Date.now(),
      name: 'Test Landlord',
      email: 'test.landlord@homematch.com',
      phoneNumber: '+2348012345678',
      currentAddress: '123 Test Street, Lagos, Nigeria',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      postalCode: '100001',
      tenantRegistrationLink: tenantRegistrationLink,
      linkGeneratedAt: new Date(),
      isOnboardingComplete: true,
      onboardedAt: new Date(),
    };

    const [createdLandlord] = await db.insert(landlords).values(testLandlord).returning();
    
    console.log('Test landlord created successfully!');
    console.log('Landlord ID:', createdLandlord.id);
    console.log('Cognito ID:', createdLandlord.cognitoId);
    console.log('Registration Link:', createdLandlord.tenantRegistrationLink);
    console.log('Full Registration URL:', `http://localhost:3000/register-tenant/${createdLandlord.tenantRegistrationLink}`);
    
    return createdLandlord;
  } catch (error) {
    console.error('Error creating test landlord:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
createTestLandlord()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });