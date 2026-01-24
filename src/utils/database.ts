import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import * as relations from '../db/relations';

// Database connection pool configuration
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool = globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '20'),
    idleTimeoutMillis: 60000, // Increased from 30000 to 60000 (60 seconds)
    connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_TIMEOUT || '60000'), // Increased default from 20000 to 60000
    ssl: process.env.DATABASE_URL?.includes('ssl=true') ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

// Create Drizzle instance
export const db = drizzle(pool, { 
  schema: { ...schema, ...relations },
  logger: process.env.NODE_ENV === 'development'
});

// Connection pool configuration
const DATABASE_CONNECTION_LIMIT = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '20');
// const DATABASE_POOL_TIMEOUT = parseInt(process.env.DATABASE_POOL_TIMEOUT || '60000'); // Updated default timeout

// Enhanced Drizzle client with connection pooling
export class DatabaseService {
  private static instance: DatabaseService;
  public db = db;
  private connectionCount = 0;
  private maxConnections = DATABASE_CONNECTION_LIMIT;

  private constructor() {
    // Connection event handlers
    if (process.env.NODE_ENV === 'development') {
      console.log('Database service initialized with Drizzle ORM and query logging enabled');
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public getClient() {
    return this.db;
  }

  public async connect(): Promise<void> {
    try {
      const client = await pool.connect();
      client.release();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await pool.end();
      console.log('Database disconnected successfully');
    } catch (error) {
      console.error('Failed to disconnect from database:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
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

  public getConnectionInfo(): { count: number; max: number } {
    return {
      count: this.connectionCount,
      max: this.maxConnections,
    };
  }

  // Transaction wrapper with retry logic
  public async executeTransaction<T>(
    fn: (tx: any) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.db.transaction(fn);
      } catch (error) {
        lastError = error as Error;
        console.error(`Transaction attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Export the db instance for backward compatibility
export default db;

// Export types for use in controllers
export type Database = typeof db;
export * from '../db/schema';
export * from '../db/relations';