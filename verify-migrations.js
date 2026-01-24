const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DRIZZLE_DATABASE_URL,
});

/**
 * Verify migration files for idempotency
 * Checks if all CREATE TABLE statements have IF NOT EXISTS
 */
async function verifyMigrations() {
  try {
    console.log('🔍 Verifying migration files for idempotency...\n');
    
    const drizzleDir = path.join(__dirname, 'drizzle');
    const files = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql'));
    
    let issues = 0;
    let passed = 0;
    
    files.forEach(file => {
      const filePath = path.join(drizzleDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for CREATE TABLE without IF NOT EXISTS
      const createTableMatches = content.match(/CREATE TABLE\s+(?!IF NOT EXISTS)/gi);
      // Check for CREATE TYPE without IF NOT EXISTS (unless wrapped in DO block)
      const createTypeMatches = content.match(/CREATE TYPE\s+(?!IF NOT EXISTS)(?!"public"\..*ENUM)/gi);
      
      if (createTableMatches && createTableMatches.length > 0) {
        console.log(`❌ ${file}: Found CREATE TABLE without IF NOT EXISTS`);
        issues++;
      } else if (content.includes('CREATE TABLE')) {
        console.log(`✓ ${file}: CREATE TABLE statements use IF NOT EXISTS`);
        passed++;
      }
    });
    
    console.log(`\n📊 Results: ${passed} passed, ${issues} issues found\n`);
    
    if (issues > 0) {
      console.log('⚠️  Some migration files need to be updated with IF NOT EXISTS clauses');
    } else {
      console.log('✓ All migration files are properly configured for idempotency!');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error verifying migrations:', error.message);
    process.exit(1);
  }
}

verifyMigrations();
