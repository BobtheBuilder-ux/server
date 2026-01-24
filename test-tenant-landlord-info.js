const fetch = require('node-fetch');

async function testTenantLandlordInfo() {
  try {
    console.log('🧪 Testing tenant landlord info endpoint...\n');

    const tenantId = 17; // The tenant ID from the previous registration
    
    console.log(`📤 Requesting landlord info for tenant ID: ${tenantId}`);

    const response = await fetch(`http://localhost:3001/tenants/${tenantId}/landlord-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseData = await response.json();

    console.log('\n📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Tenant landlord info retrieved successfully!');
      console.log('🏠 Landlord info:', responseData.landlordInfo);
      console.log('🏡 Rental info:', responseData.rentalInfo);
    } else {
      console.log('\n❌ Failed to retrieve tenant landlord info!');
    }

  } catch (error) {
    console.error('❌ Error testing tenant landlord info:', error);
  }
}

testTenantLandlordInfo();