import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './relations';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Create Drizzle instance
export const db = drizzle(pool, { 
  schema: { ...schema, ...relations },
  logger: process.env.NODE_ENV === 'development'
});

// Database service class to maintain compatibility
export class DatabaseService {
  private static instance: DatabaseService;
  public db = db;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async disconnect(): Promise<void> {
    await pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

// Export the singleton instance
export const databaseService = DatabaseService.getInstance();

// Export types for use in controllers
export type Database = typeof db;
export * from './schema';
export * from './relations';