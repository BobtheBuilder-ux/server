"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseService = exports.DatabaseService = exports.db = void 0;
const tslib_1 = require("tslib");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = tslib_1.__importStar(require("../db/schema"));
const relations = tslib_1.__importStar(require("../db/relations"));
const globalForDb = globalThis;
const pool = globalForDb.pool ??
    new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '20'),
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_TIMEOUT || '60000'),
        ssl: process.env.DATABASE_URL?.includes('ssl=true') ? { rejectUnauthorized: false } : false,
    });
if (process.env.NODE_ENV !== 'production')
    globalForDb.pool = pool;
exports.db = (0, node_postgres_1.drizzle)(pool, {
    schema: { ...schema, ...relations },
    logger: process.env.NODE_ENV === 'development'
});
const DATABASE_CONNECTION_LIMIT = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '20');
class DatabaseService {
    constructor() {
        this.db = exports.db;
        this.connectionCount = 0;
        this.maxConnections = DATABASE_CONNECTION_LIMIT;
        if (process.env.NODE_ENV === 'development') {
            console.log('Database service initialized with Drizzle ORM and query logging enabled');
        }
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    getClient() {
        return this.db;
    }
    async connect() {
        try {
            const client = await pool.connect();
            client.release();
            console.log('Database connected successfully');
        }
        catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await pool.end();
            console.log('Database disconnected successfully');
        }
        catch (error) {
            console.error('Failed to disconnect from database:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        }
        catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
    getConnectionInfo() {
        return {
            count: this.connectionCount,
            max: this.maxConnections,
        };
    }
    async executeTransaction(fn, maxRetries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.db.transaction(fn);
            }
            catch (error) {
                lastError = error;
                console.error(`Transaction attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }
}
exports.DatabaseService = DatabaseService;
exports.databaseService = DatabaseService.getInstance();
exports.default = exports.db;
tslib_1.__exportStar(require("../db/schema"), exports);
tslib_1.__exportStar(require("../db/relations"), exports);
