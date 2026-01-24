const fetch = require('node-fetch');

async function testAuthenticatedEndpoint() {
  try {
    // First, let's try to create a session by signing in
    // We'll need to check what authentication endpoints are available
    
    // For now, let's test the endpoint with a mock session cookie
    // This will help us see the debug logs we added
    
    const response = await fetch('http://localhost:3001/tenants/test-auth-id/landlord-info', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add a mock session cookie - we'll need to get a real one
        'Cookie': 'better-auth.session_token=mock-session-token'
      }
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAuthenticatedEndpoint();