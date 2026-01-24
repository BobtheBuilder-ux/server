const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyUser() {
  try {
    const result = await pool.query(
      'UPDATE "User" SET "emailVerified" = true WHERE email = $1 RETURNING id, email, "emailVerified"',
      ['testlord@example.com']
    );
    
    console.log('User verified:', result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyUser();
