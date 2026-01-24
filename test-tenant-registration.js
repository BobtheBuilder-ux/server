const fetch = require('node-fetch');

async function testTenantRegistration() {
  try {
    console.log('🧪 Testing tenant registration via landlord link...\n');

    const registrationLink = '2f28b827bfc61f83df66a2fd705347eb5ca85482e2efe51a23570021ff5bd875';
    const testTenantData = {
      registrationLink: registrationLink,
      cognitoId: 'test-tenant-' + Date.now(),
      name: 'Test Tenant',
      email: 'test.tenant.' + Date.now() + '@example.com',
      phoneNumber: '+2348087654321',
      houseAddress: '456 Test Avenue, Lagos, Nigeria',
      rentAmount: 600000,
      rentDueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'bank_transfer',
      propertyAddress: '456 Test Avenue, Lagos, Nigeria'
    };

    console.log('📤 Sending tenant registration request with data:', testTenantData);

    const response = await fetch('http://localhost:3001/tenants/register-via-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testTenantData),
    });

    const responseData = await response.json();

    console.log('\n📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Tenant registration successful!');
      console.log('🔍 Check server logs for debug information about registeredByLandlordId');
    } else {
      console.log('\n❌ Tenant registration failed!');
    }

  } catch (error) {
    console.error('❌ Error testing tenant registration:', error);
  }
}

testTenantRegistration();