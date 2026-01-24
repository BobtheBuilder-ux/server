const axios = require('axios');

async function testTenantRegistration() {
  try {
    console.log('🧪 Testing tenant registration via landlord link with user creation...');
    
    // Use a unique email to avoid conflicts
    const uniqueEmail = `test-tenant-${Date.now()}@example.com`;
    
    const response = await axios.post('http://localhost:3001/tenants/register-via-link', {
      registrationLink: 'dec5b014ad546e0bfcd418efb8ab57f1a9813755398483cca02f8487f614a508',
      name: 'Test Tenant Fixed',
      email: uniqueEmail,
      phoneNumber: '08012345678',
      houseAddress: 'Test Address 123',
      rentAmount: 600000,
      rentDueDate: '2025-12-31',
      paymentMethod: 'bank_transfer',
      propertyAddress: 'Test Property Address'
    });

    console.log('✅ Registration successful!');
    console.log('Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Check if userId is properly set
    if (response.data.tenant && response.data.tenant.userId) {
      console.log('✅ userId is properly set:', response.data.tenant.userId);
    } else {
      console.log('❌ userId is still undefined or missing');
    }
    
  } catch (error) {
    console.error('❌ Registration failed:');
    console.error('Status:', error.response?.status);
    console.error('Error message:', error.response?.data?.message || error.message);
    console.error('Full error data:', error.response?.data);
  }
}

testTenantRegistration();